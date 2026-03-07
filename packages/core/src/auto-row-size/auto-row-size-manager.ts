// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * AutoRowSizeManager — orchestrates automatic row height measurement.
 *
 * Strategy:
 * 1. Visible rows (viewport) are measured synchronously after render
 *    for instant results on data load and column resize.
 * 2. Off-screen rows are measured asynchronously via requestIdleCallback
 *    in configurable batches to avoid blocking the main thread.
 * 3. Heights are collected from all render layers that implement
 *    measureHeights(), taking the maximum per row.
 * 4. Results are applied via the engine's setAutoRowHeights() batch API.
 * 5. Dirty tracking: only re-measures rows that changed (data edit,
 *    column resize on wrap-enabled columns, theme/font changes).
 */

import type { RenderContext, RenderLayer } from '../renderer/render-layer';
import type { RowStore } from '../model/row-store';

/** Configuration for the auto row size manager. */
export interface AutoRowSizeConfig {
  /** Batch size for off-screen async measurement. Default: 100. */
  batchSize?: number;
  /** Minimum row height (prevents rows from collapsing). Default: the grid's default row height. */
  minRowHeight?: number;
  /** Vertical padding to add to measured height per row. Default: 8. */
  cellPadding?: number;
}

/** Callback to apply measured heights into the engine. */
export type ApplyHeightsCallback = (updates: Map<number, number>) => void;

/**
 * Measurement state for progressive off-screen measurement.
 * Tracks which row we're up to in the async sweep.
 */
interface AsyncMeasurementState {
  /** Next row index to measure. */
  nextRow: number;
  /** Total row count at the time measurement started. */
  totalRows: number;
  /** requestIdleCallback handle for cancellation. */
  idleCallbackId: number;
}

export class AutoRowSizeManager {
  private readonly batchSize: number;
  private readonly minRowHeight: number;
  private readonly cellPadding: number;
  private readonly applyHeights: ApplyHeightsCallback;

  /** Render layers that can contribute height measurements. */
  private layers: RenderLayer[] = [];

  /** Current async measurement sweep (null when idle). */
  private asyncState: AsyncMeasurementState | null = null;

  /** Whether the manager has been destroyed. */
  private destroyed = false;

  /** Rows that need re-measurement. Empty = nothing dirty. */
  private readonly dirtyRows = new Set<number>();

  /** When true, all rows should be re-measured (e.g. theme/font change). */
  private allDirty = false;

  constructor(config: AutoRowSizeConfig, applyHeights: ApplyHeightsCallback) {
    this.batchSize = config.batchSize ?? 100;
    this.minRowHeight = config.minRowHeight ?? 28;
    this.cellPadding = config.cellPadding ?? 8;
    this.applyHeights = applyHeights;
  }

  /** Set the render layers to collect height measurements from. */
  setLayers(layers: RenderLayer[]): void {
    this.layers = layers;
  }

  // --- Dirty tracking ---

  /** Mark specific rows as needing re-measurement. */
  markDirtyRows(rows: Iterable<number>): void {
    for (const row of rows) {
      this.dirtyRows.add(row);
    }
  }

  /** Mark all rows as dirty (theme/font change, or first load). */
  markAllDirty(): void {
    this.allDirty = true;
  }

  /** Clear dirty state. */
  clearDirty(): void {
    this.dirtyRows.clear();
    this.allDirty = false;
  }

  /** Whether there are any dirty rows pending measurement. */
  get hasDirtyRows(): boolean {
    return this.allDirty || this.dirtyRows.size > 0;
  }

  /** Number of individually dirty rows (not counting allDirty). */
  get dirtyRowCount(): number {
    return this.dirtyRows.size;
  }

  /** Whether all rows are marked dirty. */
  get isAllDirty(): boolean {
    return this.allDirty;
  }

  /** Check if a specific row is dirty. */
  isRowDirty(row: number): boolean {
    return this.allDirty || this.dirtyRows.has(row);
  }

  /**
   * Measure visible rows synchronously using the current render context.
   * Called after each render to keep viewport heights up to date.
   * Returns the number of rows that were updated.
   */
  measureViewport(rc: RenderContext, rowStore: RowStore): number {
    if (this.destroyed) return 0;

    const heights = this.collectHeights(rc);
    if (heights.size === 0) return 0;

    // Apply min height and padding, skip manual overrides
    const updates = new Map<number, number>();
    const defaultH = this.minRowHeight;
    for (const [row, measuredH] of heights) {
      if (rowStore.isManual(row)) continue;
      const h = Math.max(measuredH + this.cellPadding, defaultH);
      updates.set(row, h);
    }

    if (updates.size === 0) return 0;
    this.applyHeights(updates);

    // Clear dirty status for measured rows
    for (const row of updates.keys()) {
      this.dirtyRows.delete(row);
    }

    return updates.size;
  }

  /**
   * Start a full async measurement sweep for all rows.
   * Measures in batches via requestIdleCallback, skipping rows with
   * manual overrides.
   *
   * @param totalRows Total number of rows in the dataset
   * @param buildRenderContext Factory that builds a RenderContext for a given row range
   * @param rowStore RowStore for manual override checks
   */
  startAsyncMeasurement(
    totalRows: number,
    buildRenderContext: (startRow: number, endRow: number) => RenderContext | null,
    rowStore: RowStore,
  ): void {
    if (this.destroyed) return;
    this.cancelAsyncMeasurement();

    if (totalRows === 0) return;

    const processNextBatch = (_deadline: IdleDeadline): void => {
      if (this.destroyed || !this.asyncState) return;

      const state = this.asyncState;
      const batchEnd = Math.min(state.nextRow + this.batchSize, state.totalRows);

      if (state.nextRow >= state.totalRows) {
        this.asyncState = null;
        return;
      }

      const rc = buildRenderContext(state.nextRow, batchEnd - 1);
      if (rc) {
        const heights = this.collectHeights(rc);
        if (heights.size > 0) {
          const updates = new Map<number, number>();
          const defaultH = this.minRowHeight;
          for (const [row, measuredH] of heights) {
            if (rowStore.isManual(row)) continue;
            const h = Math.max(measuredH + this.cellPadding, defaultH);
            updates.set(row, h);
          }
          if (updates.size > 0) {
            this.applyHeights(updates);
          }
          // Clear dirty status for measured rows
          for (const row of updates.keys()) {
            this.dirtyRows.delete(row);
          }
        }
      }

      state.nextRow = batchEnd;

      if (state.nextRow < state.totalRows) {
        state.idleCallbackId = requestIdleCallback(processNextBatch);
      } else {
        this.asyncState = null;
        this.allDirty = false;
      }
    };

    this.asyncState = {
      nextRow: 0,
      totalRows,
      idleCallbackId: requestIdleCallback(processNextBatch),
    };
  }

  /**
   * Start an async measurement sweep for only dirty rows.
   * More efficient than full sweep when few rows changed.
   *
   * @param buildRenderContext Factory that builds a RenderContext for a given row range
   * @param rowStore RowStore for manual override checks
   */
  startDirtyMeasurement(
    buildRenderContext: (startRow: number, endRow: number) => RenderContext | null,
    rowStore: RowStore,
  ): void {
    if (this.destroyed || this.dirtyRows.size === 0) return;
    this.cancelAsyncMeasurement();

    // Sort dirty rows for sequential access pattern
    const sortedDirty = Array.from(this.dirtyRows).sort((a, b) => a - b);
    let idx = 0;

    const processNextBatch = (_deadline: IdleDeadline): void => {
      if (this.destroyed || idx >= sortedDirty.length) {
        this.asyncState = null;
        return;
      }

      const batchEnd = Math.min(idx + this.batchSize, sortedDirty.length);
      const batchRows = sortedDirty.slice(idx, batchEnd);
      const startRow = batchRows[0];
      const endRow = batchRows[batchRows.length - 1];

      const rc = buildRenderContext(startRow, endRow);
      if (rc) {
        const heights = this.collectHeights(rc);
        if (heights.size > 0) {
          const updates = new Map<number, number>();
          const defaultH = this.minRowHeight;
          for (const [row, measuredH] of heights) {
            if (rowStore.isManual(row)) continue;
            const h = Math.max(measuredH + this.cellPadding, defaultH);
            updates.set(row, h);
          }
          if (updates.size > 0) {
            this.applyHeights(updates);
          }
        }
      }

      // Clear measured rows from dirty set
      for (const row of batchRows) {
        this.dirtyRows.delete(row);
      }

      idx = batchEnd;

      if (idx < sortedDirty.length) {
        this.asyncState = {
          nextRow: idx,
          totalRows: sortedDirty.length,
          idleCallbackId: requestIdleCallback(processNextBatch),
        };
      } else {
        this.asyncState = null;
      }
    };

    this.asyncState = {
      nextRow: 0,
      totalRows: sortedDirty.length,
      idleCallbackId: requestIdleCallback(processNextBatch),
    };
  }

  /** Cancel any in-progress async measurement sweep. */
  cancelAsyncMeasurement(): void {
    if (this.asyncState) {
      cancelIdleCallback(this.asyncState.idleCallbackId);
      this.asyncState = null;
    }
  }

  /** Whether an async measurement sweep is in progress. */
  get isMeasuring(): boolean {
    return this.asyncState !== null;
  }

  /** Progress of the current async sweep (0..1). Returns 1 if not measuring. */
  get progress(): number {
    if (!this.asyncState) return 1;
    const { nextRow, totalRows } = this.asyncState;
    return totalRows > 0 ? nextRow / totalRows : 1;
  }

  /** Clean up all resources. */
  destroy(): void {
    this.cancelAsyncMeasurement();
    this.layers = [];
    this.dirtyRows.clear();
    this.allDirty = false;
    this.destroyed = true;
  }

  /**
   * Collect height measurements from all registered render layers.
   * For each row, takes the maximum height across all layers.
   */
  private collectHeights(rc: RenderContext): Map<number, number> {
    const result = new Map<number, number>();

    for (const layer of this.layers) {
      if (!layer.measureHeights) continue;

      const layerHeights = layer.measureHeights(rc);
      for (const [row, height] of layerHeights) {
        const current = result.get(row);
        if (current === undefined || height > current) {
          result.set(row, height);
        }
      }
    }

    return result;
  }
}
