// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * LayoutEngine — pre-computes cumulative row/column positions using Float64Array.
 *
 * Provides O(1) cell rectangle lookup and O(log n) binary search
 * for finding row/column at a given pixel coordinate.
 *
 * Pure computation — no rendering, no DOM, no Canvas dependency.
 */

import type { ColumnDef, CellRect } from '../types/interfaces';
import type { RowStore } from '../model/row-store';

export interface LayoutEngineConfig {
  columns: ColumnDef[];
  rowCount: number;
  rowHeight: number;
  headerHeight: number;
  rowNumberWidth: number;
  rowStore?: RowStore;
}

export class LayoutEngine {
  private readonly _columns: ColumnDef[];
  private _rowCount: number;
  private _maxRowCount: number;
  private readonly _defaultRowHeight: number;
  private readonly _headerHeight: number;
  private readonly _rowNumberWidth: number;
  private readonly _rowStore: RowStore | null;

  /**
   * Cumulative column positions. Length = visibleColumns.length + 1.
   * colPositions[i] = x-offset of column i (relative to content area, after rowNumberWidth).
   * colPositions[length-1] = total width of all columns.
   */
  private readonly colPositions: Float64Array;

  /**
   * Column widths for visible columns (same order as colPositions).
   */
  private readonly colWidths: Float64Array;

  /**
   * Total width of all visible columns (excludes rowNumberWidth).
   */
  private _contentWidth: number;

  /**
   * Cumulative row positions. Length = rowCount + 1.
   * rowPositions[i] = y-offset of row i (relative to content area, after headerHeight).
   * rowPositions[rowCount] = total height of all rows.
   */
  private rowPositions: Float64Array;

  /**
   * Per-row heights. Length = rowCount.
   */
  private rowHeights: Float64Array;

  /**
   * Total height of all rows (excludes headerHeight).
   */
  private _contentHeight: number;

  constructor(config: LayoutEngineConfig) {
    this._columns = config.columns;
    this._rowCount = config.rowCount;
    this._maxRowCount = config.rowCount;
    this._defaultRowHeight = config.rowHeight;
    this._headerHeight = config.headerHeight;
    this._rowNumberWidth = config.rowNumberWidth;
    this._rowStore = config.rowStore ?? null;

    const visibleCols = this._columns.filter((c) => !c.hidden);

    // Build cumulative column positions
    this.colPositions = new Float64Array(visibleCols.length + 1);
    this.colWidths = new Float64Array(visibleCols.length);
    let x = 0;
    for (let i = 0; i < visibleCols.length; i++) {
      this.colPositions[i] = x;
      this.colWidths[i] = visibleCols[i].width;
      x += visibleCols[i].width;
    }
    this.colPositions[visibleCols.length] = x;
    this._contentWidth = x;

    // Build cumulative row positions from RowStore (or uniform default)
    this.rowPositions = new Float64Array(this._rowCount + 1);
    this.rowHeights = new Float64Array(this._rowCount);
    let y = 0;
    const rowStore = this._rowStore;
    const defaultH = this._defaultRowHeight;
    for (let r = 0; r < this._rowCount; r++) {
      this.rowPositions[r] = y;
      const h = rowStore ? rowStore.getHeight(r, defaultH) : defaultH;
      this.rowHeights[r] = h;
      y += h;
    }
    this.rowPositions[this._rowCount] = y;
    this._contentHeight = y;
  }

  get rowCount(): number {
    return this._rowCount;
  }

  /** Update effective row count. Reallocates arrays if count exceeds current capacity. */
  setRowCount(count: number): void {
    if (count > this._maxRowCount) {
      // Reallocate Float64Arrays for the new capacity
      const newPositions = new Float64Array(count + 1);
      const newHeights = new Float64Array(count);
      // Copy existing data
      newPositions.set(this.rowPositions.subarray(0, this._maxRowCount + 1));
      newHeights.set(this.rowHeights.subarray(0, this._maxRowCount));
      // Fill new rows with default height
      const defaultH = this._defaultRowHeight;
      let y = this.rowPositions[this._maxRowCount];
      for (let r = this._maxRowCount; r < count; r++) {
        newPositions[r] = y;
        newHeights[r] = defaultH;
        y += defaultH;
      }
      newPositions[count] = y;
      this.rowPositions = newPositions;
      this.rowHeights = newHeights;
      this._maxRowCount = count;
    }
    this._rowCount = count;
    this._contentHeight = this.rowPositions[this._rowCount] ?? 0;
  }

  get columnCount(): number {
    return this.colWidths.length;
  }

  get rowHeight(): number {
    return this._defaultRowHeight;
  }

  get headerHeight(): number {
    return this._headerHeight;
  }

  get rowNumberWidth(): number {
    return this._rowNumberWidth;
  }

  /** Total content width (all visible columns, excludes rowNumberWidth). */
  get contentWidth(): number {
    return this._contentWidth;
  }

  /** Total content height (all rows, excludes headerHeight). */
  get contentHeight(): number {
    return this._contentHeight;
  }

  /** Expose cumulative row positions (shared reference for GridGeometry). */
  getRowPositions(): Float64Array {
    return this.rowPositions;
  }

  /** Expose per-row heights (shared reference for GridGeometry). */
  getRowHeightsArray(): Float64Array {
    return this.rowHeights;
  }

  /** Total scrollable width = rowNumberWidth + contentWidth. */
  get totalWidth(): number {
    return this._rowNumberWidth + this._contentWidth;
  }

  /** Total scrollable height = headerHeight + contentHeight. */
  get totalHeight(): number {
    return this._headerHeight + this._contentHeight;
  }

  /**
   * O(1) cell rectangle lookup.
   * Returns pixel coordinates for a cell at (rowIndex, colIndex).
   * Coordinates are absolute (include headerHeight and rowNumberWidth offsets).
   */
  getCellRect(rowIndex: number, colIndex: number): CellRect {
    if (
      rowIndex < 0 ||
      rowIndex >= this._rowCount ||
      colIndex < 0 ||
      colIndex >= this.colWidths.length
    ) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      x: this._rowNumberWidth + this.colPositions[colIndex],
      y: this._headerHeight + this.rowPositions[rowIndex],
      width: this.colWidths[colIndex],
      height: this.rowHeights[rowIndex],
    };
  }

  /**
   * Get column x-position (relative to content area, after rowNumberWidth).
   */
  getColumnX(colIndex: number): number {
    if (colIndex < 0 || colIndex >= this.colWidths.length) return 0;
    return this.colPositions[colIndex];
  }

  /**
   * Get column width.
   */
  getColumnWidth(colIndex: number): number {
    if (colIndex < 0 || colIndex >= this.colWidths.length) return 0;
    return this.colWidths[colIndex];
  }

  /**
   * Get row y-position (relative to content area, after headerHeight).
   */
  getRowY(rowIndex: number): number {
    if (rowIndex < 0 || rowIndex > this._rowCount) return 0;
    return this.rowPositions[rowIndex];
  }

  /**
   * Get row height for a specific row.
   */
  getRowHeight(rowIndex: number): number {
    if (rowIndex < 0 || rowIndex >= this._rowCount) return 0;
    return this.rowHeights[rowIndex];
  }

  /**
   * O(log n) binary search — find the row index at a given y pixel coordinate.
   * The y coordinate is relative to the content area (after headerHeight).
   * Returns -1 if y is outside the content area.
   */
  getRowAtY(y: number): number {
    if (y < 0 || y >= this._contentHeight) return -1;

    // Binary search in cumulative row positions
    let lo = 0;
    let hi = this._rowCount - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const start = this.rowPositions[mid];
      const end = this.rowPositions[mid + 1];

      if (y < start) {
        hi = mid - 1;
      } else if (y >= end) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  /**
   * Update the height of a single row and recompute cumulative positions.
   * O(n) where n = number of rows after the changed row.
   */
  setRowHeight(rowIndex: number, height: number): void {
    if (rowIndex < 0 || rowIndex >= this._rowCount) return;
    this.rowHeights[rowIndex] = height;

    // Recompute cumulative positions from rowIndex onward
    let yy = this.rowPositions[rowIndex];
    for (let r = rowIndex; r < this._rowCount; r++) {
      this.rowPositions[r] = yy;
      yy += this.rowHeights[r];
    }
    this.rowPositions[this._rowCount] = yy;
    this._contentHeight = yy;
  }

  /**
   * Batch-update multiple row heights with a single cumulative position recompute.
   * O(n) where n = total row count (recomputes from the smallest changed index).
   * Much more efficient than calling setRowHeight() per row.
   */
  setRowHeightsBatch(updates: Map<number, number>): void {
    if (updates.size === 0) return;

    let minChanged = this._rowCount;
    for (const [rowIndex, height] of updates) {
      if (rowIndex < 0 || rowIndex >= this._rowCount) continue;
      this.rowHeights[rowIndex] = height;
      if (rowIndex < minChanged) minChanged = rowIndex;
    }

    if (minChanged >= this._rowCount) return;

    // Single recompute from the earliest changed row
    let yy = this.rowPositions[minChanged];
    for (let r = minChanged; r < this._rowCount; r++) {
      this.rowPositions[r] = yy;
      yy += this.rowHeights[r];
    }
    this.rowPositions[this._rowCount] = yy;
    this._contentHeight = yy;
  }

  /**
   * Update the width of a single column and recompute cumulative positions.
   * O(n) where n = number of columns after the changed column.
   */
  setColumnWidth(colIndex: number, width: number): void {
    if (colIndex < 0 || colIndex >= this.colWidths.length) return;
    this.colWidths[colIndex] = width;

    // Recompute cumulative positions from colIndex onward
    let x = this.colPositions[colIndex];
    for (let i = colIndex; i < this.colWidths.length; i++) {
      this.colPositions[i] = x;
      x += this.colWidths[i];
    }
    this.colPositions[this.colWidths.length] = x;
    this._contentWidth = x;
  }

  /**
   * Batch update multiple column widths in a single pass.
   * Only recomputes cumulative positions once from the lowest changed index.
   */
  setColumnWidthsBatch(updates: Map<number, number>): void {
    if (updates.size === 0) return;

    let minIndex = this.colWidths.length;
    for (const [colIndex, width] of updates) {
      if (colIndex < 0 || colIndex >= this.colWidths.length) continue;
      this.colWidths[colIndex] = width;
      if (colIndex < minIndex) minIndex = colIndex;
    }

    if (minIndex >= this.colWidths.length) return;

    // Single recomputation from the lowest changed index
    let x = this.colPositions[minIndex];
    for (let i = minIndex; i < this.colWidths.length; i++) {
      this.colPositions[i] = x;
      x += this.colWidths[i];
    }
    this.colPositions[this.colWidths.length] = x;
    this._contentWidth = x;
  }

  /**
   * Get the total pixel height of the first `count` frozen rows.
   * Returns 0 if count <= 0 or exceeds row count.
   */
  getFrozenRowsHeight(count: number): number {
    if (count <= 0 || count > this._rowCount) return 0;
    return this.rowPositions[count];
  }

  /**
   * Get the total pixel width of the first `count` frozen columns.
   * Returns 0 if count <= 0 or exceeds column count.
   */
  getFrozenColsWidth(count: number): number {
    if (count <= 0 || count > this.colWidths.length) return 0;
    return this.colPositions[count];
  }

  /**
   * O(log n) binary search — find the column index at a given x pixel coordinate.
   * The x coordinate is relative to the content area (after rowNumberWidth).
   * Returns -1 if x is outside the content area.
   */
  getColAtX(x: number): number {
    if (x < 0 || x >= this._contentWidth) return -1;

    // Binary search in cumulative positions
    let lo = 0;
    let hi = this.colWidths.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const start = this.colPositions[mid];
      const end = this.colPositions[mid + 1];

      if (x < start) {
        hi = mid - 1;
      } else if (x >= end) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }
}
