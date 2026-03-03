// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * FormulaPlugin — SpreadsheetPlugin that integrates the formula engine with SpreadsheetEngine.
 *
 * Supports two evaluation modes:
 * - Synchronous (default): evaluates on the main thread
 * - Web Worker: offloads evaluation to a background thread
 *
 * Worker mode is activated by passing a Worker instance via options.
 * When Worker is not provided or unavailable, sync mode is used automatically.
 */

import type { SpreadsheetPlugin, PluginAPI, CellValue, CellChangeEvent, CommandEvent } from '@witqq/spreadsheet';
import { evaluateFormula } from './index';
import { DependencyGraph, cellKey, parseCellKey, extractDependencies } from './dependency-graph';
import { parse } from './parser';
import { tokenize } from './tokenizer';
import { FormulaError } from './types';
import type { CellValueResolver } from './types';
import { FormulaWorkerBridge } from './formula-worker-bridge';
import type { ComputeResult } from './formula-compute-engine';

export const FORMULA_PLUGIN_NAME = 'formula';

/** Options for FormulaPlugin. */
export interface FormulaPluginOptions {
  /** Pre-created Worker instance for off-main-thread evaluation. */
  worker?: Worker;
  /** Force synchronous mode even if Worker is provided. Default: false */
  syncOnly?: boolean;
}

export class FormulaPlugin implements SpreadsheetPlugin {
  readonly name = FORMULA_PLUGIN_NAME;
  readonly version = '1.0.0';

  private api!: PluginAPI;
  private graph = new DependencyGraph();
  /** Guard against re-entrant cellChange while we update cells. */
  private processing = false;
  /** Bound handler references for cleanup. */
  private cellChangeHandler!: (event: CellChangeEvent) => void;
  private commandUndoHandler!: (event: CommandEvent) => void;
  private commandRedoHandler!: (event: CommandEvent) => void;

  // Worker mode
  private bridge: FormulaWorkerBridge | null = null;
  private workerMode = false;
  private readonly options: FormulaPluginOptions;

  constructor(options?: FormulaPluginOptions) {
    this.options = options ?? {};
  }

  install(api: PluginAPI): void {
    this.api = api;

    // Set up Worker mode if a Worker was provided
    if (!this.options.syncOnly && this.options.worker) {
      try {
        this.bridge = new FormulaWorkerBridge(this.options.worker);
        this.workerMode = true;
      } catch {
        this.workerMode = false;
        this.bridge = null;
      }
    }

    const eventBus = api.engine.getEventBus();

    this.cellChangeHandler = (event) => this.onCellChange(event);
    this.commandUndoHandler = () => this.onUndoRedo();
    this.commandRedoHandler = () => this.onUndoRedo();

    eventBus.on('cellChange', this.cellChangeHandler);
    eventBus.on('commandUndo', this.commandUndoHandler);
    eventBus.on('commandRedo', this.commandRedoHandler);

    if (this.workerMode) {
      this.initWorkerMode();
    } else {
      this.initExistingFormulas();
    }
  }

  destroy(): void {
    const eventBus = this.api.engine.getEventBus();
    eventBus.off('cellChange', this.cellChangeHandler);
    eventBus.off('commandUndo', this.commandUndoHandler);
    eventBus.off('commandRedo', this.commandRedoHandler);
    this.graph = new DependencyGraph();

    if (this.bridge) {
      this.bridge.destroy();
      this.bridge = null;
      this.workerMode = false;
    }
  }

  /** Whether the plugin is currently using a Web Worker for evaluation. */
  isUsingWorker(): boolean {
    return this.workerMode;
  }

  /** Get the dependency graph (for testing/inspection, sync mode only). */
  getDependencyGraph(): DependencyGraph {
    return this.graph;
  }

  // ---- Event Handlers ----

  private onCellChange(event: CellChangeEvent): void {
    if (this.processing) return;

    const engine = this.api.engine;
    const physRow = engine.getDataView().getPhysicalRow(event.row);

    if (this.workerMode && this.bridge) {
      this.onCellChangeWorker(physRow, event.col, event.newValue);
    } else {
      if (typeof event.newValue === 'string' && event.newValue.startsWith('=')) {
        this.processFormula(physRow, event.col, event.newValue);
      } else {
        this.clearFormula(physRow, event.col);
        this.cascadeFromCell(physRow, event.col);
      }
    }
  }

  // ---- Formula Processing ----

  private processFormula(physRow: number, col: number, formulaStr: string): void {
    const key = cellKey(physRow, col);

    try {
      const tokens = tokenize(formulaStr.slice(1));
      const ast = parse(tokens);
      const deps = extractDependencies(ast);

      // setDependencies returns false if it would create a cycle
      const ok = this.graph.setDependencies(key, deps);
      if (!ok) {
        this.storeFormulaResult(physRow, col, formulaStr, '#REF!');
        return;
      }

      const resolver = this.createResolver();
      const result = evaluateFormula(formulaStr, resolver);
      const displayVal = result instanceof FormulaError ? result.toString() : result;
      this.storeFormulaResult(physRow, col, formulaStr, displayVal as CellValue);
      this.cascadeFromCell(physRow, col);
    } catch {
      this.storeFormulaResult(physRow, col, formulaStr, '#ERROR!');
    }
  }

  private storeFormulaResult(
    physRow: number,
    col: number,
    formula: string,
    computedValue: CellValue,
  ): void {
    const cellStore = this.api.engine.getCellStore();
    const existing = cellStore.get(physRow, col);
    this.processing = true;
    cellStore.set(physRow, col, {
      ...existing,
      value: computedValue,
      formula,
      type: 'formula' as const,
    });
    this.api.engine.getDirtyTracker()?.markDirty('cell-update');
    this.processing = false;
  }

  private clearFormula(physRow: number, col: number): void {
    const cellStore = this.api.engine.getCellStore();
    const existing = cellStore.get(physRow, col);
    if (!existing?.formula) return;

    const key = cellKey(physRow, col);
    this.graph.removeDependencies(key);

    this.processing = true;
    cellStore.set(physRow, col, {
      value: existing.value,
      style: existing.style,
    });
    this.processing = false;
  }

  private cascadeFromCell(physRow: number, col: number): void {
    const key = cellKey(physRow, col);
    const recalcOrder = this.graph.getRecalcOrder([key]);
    if (recalcOrder.length === 0) return;

    const resolver = this.createResolver();
    const cellStore = this.api.engine.getCellStore();

    for (const depKey of recalcOrder) {
      const { row: depRow, col: depCol } = parseCellKey(depKey);
      const depCell = cellStore.get(depRow, depCol);
      if (!depCell?.formula) continue;

      const result = evaluateFormula(depCell.formula, resolver);
      const displayVal = result instanceof FormulaError ? result.toString() : result;
      this.storeFormulaResult(depRow, depCol, depCell.formula, displayVal as CellValue);
    }
  }

  // ---- Worker Mode ----

  private onCellChangeWorker(physRow: number, col: number, value: CellValue): void {
    if (typeof value === 'string' && value.startsWith('=')) {
      this.bridge!.processFormula(physRow, col, value).then(
        (results) => this.applyWorkerResults(results),
        () => {
          // Worker error: fall back to sync for this operation
          this.processFormula(physRow, col, value);
        },
      );
    } else {
      // Clear formula metadata on main thread
      this.clearFormula(physRow, col);
      // Notify Worker and cascade
      this.bridge!.cellChanged(physRow, col, value).then(
        (results) => this.applyWorkerResults(results),
        () => {
          this.cascadeFromCell(physRow, col);
        },
      );
    }
  }

  private applyWorkerResults(results: ComputeResult[]): void {
    if (results.length === 0) return;

    this.processing = true;
    const cellStore = this.api.engine.getCellStore();

    for (const result of results) {
      const existing = cellStore.get(result.row, result.col);
      cellStore.set(result.row, result.col, {
        ...existing,
        value: result.value,
        formula: result.formula,
        type: 'formula' as const,
      });
    }

    this.api.engine.getDirtyTracker()?.markDirty('cell-update');
    this.api.engine.render();
    this.processing = false;
  }

  /** Send all current cell data to the Worker for initialization. */
  private initWorkerMode(): void {
    const cellStore = this.api.engine.getCellStore();
    const cells: Array<{ row: number; col: number; value: unknown; formula?: string }> = [];

    for (const { row, col, data } of cellStore.entries()) {
      cells.push({
        row,
        col,
        value: data.value,
        formula: data.formula ?? undefined,
      });
    }

    if (cells.length > 0) {
      this.bridge!.recalculateAll(cells).then(
        (results) => this.applyWorkerResults(results),
        () => {
          // Worker failed: fall back to sync
          this.workerMode = false;
          this.bridge?.destroy();
          this.bridge = null;
          this.initExistingFormulas();
        },
      );
    }
  }

  // ---- Undo/Redo ----

  private onUndoRedo(): void {
    if (this.workerMode && this.bridge) {
      this.onUndoRedoWorker();
    } else {
      this.recalculateAll();
    }
  }

  private onUndoRedoWorker(): void {
    const cellStore = this.api.engine.getCellStore();
    const cells: Array<{ row: number; col: number; value: unknown; formula?: string }> = [];

    for (const { row, col, data } of cellStore.entries()) {
      cells.push({
        row,
        col,
        value: data.value,
        formula: data.formula ?? undefined,
      });
    }

    this.bridge!.recalculateAll(cells).then(
      (results) => {
        this.applyWorkerResults(results);
      },
      () => {
        this.recalculateAll();
      },
    );
  }

  // ---- Sync Mode: full recalculation ----

  private recalculateAll(): void {
    const cellStore = this.api.engine.getCellStore();
    // Collect all formula cell keys from the store
    const formulaKeys: string[] = [];

    for (const { row, col, data } of cellStore.entries()) {
      const val = data.value;
      const hasFormulaStr = typeof val === 'string' && val.startsWith('=');
      const hasFormulaMeta = !!data.formula;
      if (hasFormulaStr || hasFormulaMeta) {
        formulaKeys.push(cellKey(row, col));
      }
    }

    if (formulaKeys.length === 0) {
      this.graph.clear();
      return;
    }

    // Re-register dependencies for all formula cells
    for (const key of formulaKeys) {
      const { row, col } = parseCellKey(key);
      const cell = cellStore.get(row, col);
      if (!cell) continue;

      const formulaStr = typeof cell.value === 'string' && cell.value.startsWith('=')
        ? cell.value
        : cell.formula;
      if (!formulaStr) continue;

      try {
        const tokens = tokenize(formulaStr.slice(1));
        const ast = parse(tokens);
        const deps = extractDependencies(ast);
        this.graph.setDependencies(key, deps);
      } catch {
        this.graph.setDependencies(key, []);
      }
    }

    // Evaluate all in dependency order
    const resolver = this.createResolver();
    const order = this.graph.getRecalcOrder(formulaKeys);

    // Also include formula cells that have NO dependents (they're "roots")
    const orderedSet = new Set(order);
    const allToEval = [...order];
    for (const key of formulaKeys) {
      if (!orderedSet.has(key)) allToEval.push(key);
    }

    for (const key of allToEval) {
      const { row, col } = parseCellKey(key);
      const cell = cellStore.get(row, col);
      if (!cell) continue;

      const formulaStr = typeof cell.value === 'string' && cell.value.startsWith('=')
        ? cell.value
        : cell.formula;
      if (!formulaStr) continue;

      const result = evaluateFormula(formulaStr, resolver);
      const displayVal = result instanceof FormulaError ? result.toString() : result;
      this.storeFormulaResult(row, col, formulaStr, displayVal as CellValue);
    }

    this.api.engine.getDirtyTracker()?.markDirty('cell-update');
    this.api.engine.render();
  }

  // ---- Initialization ----

  /** Scan CellStore for existing formula cells and process them. */
  private initExistingFormulas(): void {
    const cellStore = this.api.engine.getCellStore();

    // Collect formula cells
    const formulaCells: Array<{ row: number; col: number; formula: string }> = [];
    for (const { row, col, data } of cellStore.entries()) {
      const formulaStr = data.formula
        ?? (typeof data.value === 'string' && data.value.startsWith('=') ? data.value : null);
      if (formulaStr) {
        formulaCells.push({ row, col, formula: formulaStr });
      }
    }

    if (formulaCells.length === 0) return;

    // Register dependencies first
    const keys: string[] = [];
    for (const { row, col, formula: formulaStr } of formulaCells) {
      const key = cellKey(row, col);
      keys.push(key);
      try {
        const tokens = tokenize(formulaStr.slice(1));
        const ast = parse(tokens);
        const deps = extractDependencies(ast);
        this.graph.setDependencies(key, deps);
      } catch {
        this.graph.setDependencies(key, []);
      }
    }

    // Evaluate in dependency order
    const resolver = this.createResolver();
    const order = this.graph.getRecalcOrder(keys);

    // Include root formula cells not in recalc order
    const orderedSet = new Set(order);
    const allToEval = [...order];
    for (const key of keys) {
      if (!orderedSet.has(key)) allToEval.push(key);
    }

    for (const key of allToEval) {
      const { row, col } = parseCellKey(key);
      const cell = cellStore.get(row, col);
      if (!cell) continue;
      const formulaStr = cell.formula
        ?? (typeof cell.value === 'string' && cell.value.startsWith('=') ? cell.value : null);
      if (!formulaStr) continue;

      const result = evaluateFormula(formulaStr, resolver);
      const displayVal = result instanceof FormulaError ? result.toString() : result;
      this.storeFormulaResult(row, col, formulaStr, displayVal as CellValue);
    }

    this.api.engine.getDirtyTracker()?.markDirty('cell-update');
  }

  // ---- Resolver ----

  private createResolver(): CellValueResolver {
    const cellStore = this.api.engine.getCellStore();
    return {
      getCellValue(row: number, col: number): unknown {
        const cell = cellStore.get(row, col);
        if (!cell) return null;
        return cell.value;
      },
    };
  }
}
