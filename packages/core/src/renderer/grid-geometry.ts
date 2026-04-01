// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * GridGeometry — computes cell positions and rectangles for the grid layout.
 *
 * Pure computation, no rendering. Shared by all render layers.
 */

import type { ColumnDef, CellRect } from '../types/interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';

export interface GridGeometryConfig {
  columns: ColumnDef[];
  theme: SpreadsheetTheme;
  showRowNumbers: boolean;
  /** Show column header row (default: true). */
  showColumnHeaders?: boolean;
  /** Cumulative row positions from LayoutEngine (shared reference). */
  rowPositions?: Float64Array;
  /** Per-row heights from LayoutEngine (shared reference). */
  rowHeights?: Float64Array;
}

export class GridGeometry {
  private readonly columns: ColumnDef[];
  private theme: SpreadsheetTheme;
  private readonly showRowNumbers: boolean;
  private readonly showColumnHeaders: boolean;
  private cachedColumnRects: CellRect[] | null = null;
  private cachedVisibleColumns: ColumnDef[] | null = null;
  private columnWidthOverrides: number[] | null = null;
  private _rowPositions: Float64Array | null;
  private _rowHeights: Float64Array | null;

  constructor(config: GridGeometryConfig) {
    this.columns = config.columns;
    this.theme = config.theme;
    this.showRowNumbers = config.showRowNumbers;
    this.showColumnHeaders = config.showColumnHeaders ?? true;
    this._rowPositions = config.rowPositions ?? null;
    this._rowHeights = config.rowHeights ?? null;
  }

  get rowNumberWidth(): number {
    return this.showRowNumbers ? this.theme.dimensions.rowNumberWidth : 0;
  }

  get headerHeight(): number {
    return this.showColumnHeaders ? this.theme.dimensions.headerHeight : 0;
  }

  /** Default row height from theme. Use getRowHeight(row) for per-row heights. */
  get rowHeight(): number {
    return this.theme.dimensions.rowHeight;
  }

  get cellPadding(): number {
    return this.theme.dimensions.cellPadding;
  }

  /** Row y-position relative to content area. Falls back to uniform height. */
  getRowY(row: number): number {
    if (this._rowPositions && row >= 0 && row < this._rowPositions.length) {
      return this._rowPositions[row];
    }
    return row * this.theme.dimensions.rowHeight;
  }

  /** Height of a specific row. Falls back to default theme row height. */
  getRowHeight(row: number): number {
    if (this._rowHeights && row >= 0 && row < this._rowHeights.length) {
      return this._rowHeights[row];
    }
    return this.theme.dimensions.rowHeight;
  }

  /** Update row position data (shared references from LayoutEngine). */
  setRowData(rowPositions: Float64Array, rowHeights: Float64Array): void {
    this._rowPositions = rowPositions;
    this._rowHeights = rowHeights;
  }

  getVisibleColumns(): ColumnDef[] {
    if (!this.cachedVisibleColumns) {
      this.cachedVisibleColumns = this.columns.filter((c) => !c.hidden);
    }
    return this.cachedVisibleColumns;
  }

  getColumnWidth(colIndex: number): number {
    if (this.columnWidthOverrides && colIndex >= 0 && colIndex < this.columnWidthOverrides.length) {
      return this.columnWidthOverrides[colIndex];
    }
    const visible = this.getVisibleColumns();
    return visible[colIndex]?.width ?? 0;
  }

  setColumnWidth(colIndex: number, width: number): void {
    const visible = this.getVisibleColumns();
    if (colIndex < 0 || colIndex >= visible.length) return;
    if (!this.columnWidthOverrides) {
      this.columnWidthOverrides = visible.map((c) => c.width);
    }
    this.columnWidthOverrides[colIndex] = width;
    this.invalidateCache();
  }

  computeColumnRects(): CellRect[] {
    if (this.cachedColumnRects) return this.cachedColumnRects;

    const rects: CellRect[] = [];
    let x = this.rowNumberWidth;
    const visible = this.getVisibleColumns();

    for (let i = 0; i < visible.length; i++) {
      const w = this.columnWidthOverrides ? this.columnWidthOverrides[i] : visible[i].width;
      rects.push({
        x,
        y: 0,
        width: w,
        height: this.headerHeight,
      });
      x += w;
    }

    this.cachedColumnRects = rects;
    return rects;
  }

  computeCellRect(rowIndex: number, colIndex: number): CellRect {
    const colRects = this.computeColumnRects();
    const colRect = colRects[colIndex];
    if (!colRect) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const y = this.headerHeight + this.getRowY(rowIndex);
    const h = this.getRowHeight(rowIndex);
    return { x: colRect.x, y, width: colRect.width, height: h };
  }

  computeAllCellRects(rowCount: number): CellRect[][] {
    const colRects = this.computeColumnRects();
    const result: CellRect[][] = [];

    for (let r = 0; r < rowCount; r++) {
      const row: CellRect[] = [];
      const y = this.headerHeight + this.getRowY(r);
      const h = this.getRowHeight(r);
      for (const cr of colRects) {
        row.push({ x: cr.x, y, width: cr.width, height: h });
      }
      result.push(row);
    }
    return result;
  }

  invalidateCache(): void {
    this.cachedColumnRects = null;
    this.cachedVisibleColumns = null;
  }

  /** Update the theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
    this.invalidateCache();
  }
}
