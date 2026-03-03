// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * FormulaComputeEngine — self-contained formula evaluation engine.
 *
 * Used inside the Web Worker for off-main-thread formula evaluation.
 * Also used directly for synchronous fallback mode.
 * Maintains its own cell data store and dependency graph.
 */

import { DependencyGraph, cellKey, parseCellKey, extractDependencies } from './dependency-graph';
import { tokenize } from './tokenizer';
import { parse } from './parser';
import { evaluate } from './evaluator';
import { FormulaError } from './types';
import type { CellValueResolver } from './types';

/** Result of formula computation. */
export interface ComputeResult {
  row: number;
  col: number;
  value: string | number | boolean;
  formula: string;
}

// ---- Worker message types (shared between Worker and bridge) ----

export type WorkerRequest =
  | { type: 'setCellValue'; row: number; col: number; value: unknown }
  | { type: 'processFormula'; id: number; row: number; col: number; formula: string }
  | { type: 'cellChanged'; id: number; row: number; col: number; value: unknown }
  | {
      type: 'recalculateAll';
      id: number;
      cells: Array<{ row: number; col: number; value: unknown; formula?: string }>;
    };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'results'; id: number; results: ComputeResult[] }
  | { type: 'error'; id: number; error: string };

// ---- Compute Engine ----

export class FormulaComputeEngine {
  private graph = new DependencyGraph();
  private cellValues = new Map<string, unknown>();
  private formulas = new Map<string, string>();

  /** Set a cell value without triggering cascade. Used for syncing data. */
  setCellValue(row: number, col: number, value: unknown): void {
    this.cellValues.set(cellKey(row, col), value);
  }

  /**
   * Process a formula entered in a cell.
   * Returns computed results for the formula cell and all cascaded dependents.
   */
  processFormula(row: number, col: number, formula: string): ComputeResult[] {
    const key = cellKey(row, col);
    const results: ComputeResult[] = [];

    try {
      const tokens = tokenize(formula.slice(1));
      const ast = parse(tokens);
      const deps = extractDependencies(ast);

      const ok = this.graph.setDependencies(key, deps);
      if (!ok) {
        this.formulas.set(key, formula);
        this.cellValues.set(key, '#REF!');
        return [{ row, col, value: '#REF!', formula }];
      }

      const resolver = this.createResolver();
      const result = evaluate(ast, resolver);
      const displayVal = result instanceof FormulaError ? result.toString() : result;

      this.formulas.set(key, formula);
      this.cellValues.set(key, displayVal);
      results.push({ row, col, value: displayVal as string | number | boolean, formula });

      results.push(...this.cascade(key));
    } catch {
      this.formulas.set(key, formula);
      this.cellValues.set(key, '#ERROR!');
      results.push({ row, col, value: '#ERROR!', formula });
    }

    return results;
  }

  /**
   * Handle a non-formula cell value change.
   * Clears any existing formula, updates value, and cascades to dependents.
   */
  cellChanged(row: number, col: number, value: unknown): ComputeResult[] {
    const key = cellKey(row, col);

    if (this.formulas.has(key)) {
      this.formulas.delete(key);
      this.graph.removeDependencies(key);
    }

    this.cellValues.set(key, value);
    return this.cascade(key);
  }

  /**
   * Full recalculation from provided cell data.
   * Used for undo/redo and initialization.
   */
  recalculateAll(
    cells: Array<{ row: number; col: number; value: unknown; formula?: string }>,
  ): ComputeResult[] {
    this.cellValues.clear();
    this.formulas.clear();
    this.graph.clear();

    const formulaKeys: string[] = [];
    for (const cell of cells) {
      const key = cellKey(cell.row, cell.col);
      this.cellValues.set(key, cell.value);
      const formulaStr =
        cell.formula ??
        (typeof cell.value === 'string' && cell.value.startsWith('=') ? cell.value : null);
      if (formulaStr) {
        this.formulas.set(key, formulaStr);
        formulaKeys.push(key);
      }
    }

    if (formulaKeys.length === 0) return [];

    for (const key of formulaKeys) {
      const formula = this.formulas.get(key)!;
      try {
        const tokens = tokenize(formula.slice(1));
        const ast = parse(tokens);
        const deps = extractDependencies(ast);
        this.graph.setDependencies(key, deps);
      } catch {
        this.graph.setDependencies(key, []);
      }
    }

    // Full topological sort: evaluate formulas in dependency order
    const formulaSet = new Set(formulaKeys);
    const inDegree = new Map<string, number>();
    for (const key of formulaKeys) {
      let count = 0;
      for (const dep of this.graph.getDirectDependencies(key)) {
        if (formulaSet.has(dep)) count++;
      }
      inDegree.set(key, count);
    }

    const ready: string[] = [];
    for (const [key, degree] of inDegree) {
      if (degree === 0) ready.push(key);
    }

    const allToEval: string[] = [];
    while (ready.length > 0) {
      const key = ready.pop()!;
      allToEval.push(key);
      for (const dep of this.graph.getDirectDependents(key)) {
        if (formulaSet.has(dep)) {
          const newDeg = (inDegree.get(dep) ?? 0) - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) ready.push(dep);
        }
      }
    }

    const resolver = this.createResolver();
    const results: ComputeResult[] = [];

    for (const key of allToEval) {
      const formula = this.formulas.get(key);
      if (!formula) continue;

      const { row, col } = parseCellKey(key);
      try {
        const tokens = tokenize(formula.slice(1));
        const ast = parse(tokens);
        const result = evaluate(ast, resolver);
        const displayVal = result instanceof FormulaError ? result.toString() : result;
        this.cellValues.set(key, displayVal);
        results.push({ row, col, value: displayVal as string | number | boolean, formula });
      } catch {
        this.cellValues.set(key, '#ERROR!');
        results.push({ row, col, value: '#ERROR!', formula });
      }
    }

    return results;
  }

  /** Reset all internal state. */
  reset(): void {
    this.graph.clear();
    this.cellValues.clear();
    this.formulas.clear();
  }

  private createResolver(): CellValueResolver {
    return {
      getCellValue: (row: number, col: number): unknown => {
        return this.cellValues.get(cellKey(row, col)) ?? null;
      },
    };
  }

  private cascade(changedKey: string): ComputeResult[] {
    const recalcOrder = this.graph.getRecalcOrder([changedKey]);
    if (recalcOrder.length === 0) return [];

    const resolver = this.createResolver();
    const results: ComputeResult[] = [];

    for (const depKey of recalcOrder) {
      const formula = this.formulas.get(depKey);
      if (!formula) continue;

      const { row, col } = parseCellKey(depKey);
      try {
        const tokens = tokenize(formula.slice(1));
        const ast = parse(tokens);
        const result = evaluate(ast, resolver);
        const displayVal = result instanceof FormulaError ? result.toString() : result;
        this.cellValues.set(depKey, displayVal);
        results.push({ row, col, value: displayVal as string | number | boolean, formula });
      } catch {
        this.cellValues.set(depKey, '#ERROR!');
        results.push({ row, col, value: '#ERROR!', formula });
      }
    }

    return results;
  }
}
