// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { SpreadsheetEngine } from '../engine/spreadsheet-engine';
import type { CellValue } from '../types/interfaces';

export interface StreamingAdapterOptions {
  /** Throttle window in ms for batching updates (default: 100) */
  throttleMs?: number;
  /** Column keys in order, matching engine column indices */
  columnKeys: string[];
}

interface PendingUpdate {
  type: 'push' | 'update' | 'delete';
  rows?: Record<string, unknown>[];
  index?: number;
  data?: Record<string, unknown>;
}

/**
 * StreamingAdapter enables live data updates to SpreadsheetEngine without full
 * re-initialization. Batches multiple updates within a configurable
 * throttle window before applying to CellStore and triggering render.
 */
export class StreamingAdapter {
  private engine: SpreadsheetEngine;
  private columnKeys: string[];
  private throttleMs: number;
  private pendingUpdates: PendingUpdate[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private _disposed = false;

  constructor(engine: SpreadsheetEngine, options: StreamingAdapterOptions) {
    this.engine = engine;
    this.columnKeys = options.columnKeys;
    this.throttleMs = options.throttleMs ?? 100;
  }

  /** Append rows to the end of the grid. */
  pushRows(rows: Record<string, unknown>[]): void {
    if (this._disposed || rows.length === 0) return;
    this.pendingUpdates.push({ type: 'push', rows: rows.slice() });
    this.scheduleFlush();
  }

  /** Update an existing row at the given logical index. */
  updateRow(index: number, data: Record<string, unknown>): void {
    if (this._disposed || index < 0 || index >= this.engine.getRowCount()) return;
    this.pendingUpdates.push({ type: 'update', index, data });
    this.scheduleFlush();
  }

  /** Delete a row at the given logical index. */
  deleteRow(index: number): void {
    if (this._disposed || index < 0 || index >= this.engine.getRowCount()) return;
    this.pendingUpdates.push({ type: 'delete', index });
    this.scheduleFlush();
  }

  /** Immediately flush all pending updates (bypasses throttle). */
  flush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.applyPendingUpdates();
  }

  /** Clean up: flush pending updates and prevent further scheduling. */
  dispose(): void {
    this.flush();
    this._disposed = true;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.applyPendingUpdates();
    }, this.throttleMs);
  }

  private applyPendingUpdates(): void {
    if (this.pendingUpdates.length === 0) return;
    const updates = this.pendingUpdates;
    this.pendingUpdates = [];

    const store = this.engine.getCellStore();
    const colKeys = this.columnKeys;
    let rowCountChanged = false;
    let currentRowCount = this.engine.getRowCount();

    for (const update of updates) {
      switch (update.type) {
        case 'push': {
          const rows = update.rows!;
          const startRow = currentRowCount;
          currentRowCount += rows.length;
          // Write cells directly to CellStore for bulk performance
          for (let i = 0; i < rows.length; i++) {
            const record = rows[i];
            for (let c = 0; c < colKeys.length; c++) {
              const value = record[colKeys[c]];
              if (value !== undefined && value !== null) {
                store.setValue(startRow + i, c, value as CellValue);
              }
            }
          }
          rowCountChanged = true;
          break;
        }

        case 'update': {
          const physRow = this.engine.getDataView().getPhysicalRow(update.index!);
          const record = update.data!;
          for (let c = 0; c < colKeys.length; c++) {
            const key = colKeys[c];
            if (key in record) {
              const value = record[key];
              if (value !== undefined && value !== null) {
                store.setValue(physRow, c, value as CellValue);
              } else {
                store.delete(physRow, c);
              }
            }
          }
          break;
        }

        case 'delete': {
          const physRow = this.engine.getDataView().getPhysicalRow(update.index!);
          // Clear all cells in the deleted row
          for (let c = 0; c < colKeys.length; c++) {
            store.delete(physRow, c);
          }
          // Shift subsequent rows up by moving their cell data
          for (let r = physRow; r < currentRowCount - 1; r++) {
            for (let c = 0; c < colKeys.length; c++) {
              const below = store.get(r + 1, c);
              if (below) {
                store.set(r, c, below);
              } else {
                store.delete(r, c);
              }
            }
          }
          // Clear last row (now duplicated)
          for (let c = 0; c < colKeys.length; c++) {
            store.delete(currentRowCount - 1, c);
          }
          // Shift RowStore height overrides and hidden rows
          this.engine.getRowStore().shiftRowsUp(physRow);
          currentRowCount--;
          rowCountChanged = true;
          break;
        }
      }
    }

    // Update row count across all subsystems if changed
    if (rowCountChanged) {
      this.engine.setRowCount(currentRowCount);
    }

    // Trigger re-render (markDirty + requestAnimationFrame)
    this.engine.requestRender();
    // Emit batch event for consumers (filter by source: 'streaming-adapter')
    this.engine.getEventBus().emit('cellChange', {
      row: -1,
      col: -1,
      value: null,
      column: { key: '_batch', title: '' },
      oldValue: null,
      newValue: null,
      source: 'streaming-adapter',
    });
  }
}
