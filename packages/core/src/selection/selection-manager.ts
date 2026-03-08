// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * SelectionManager — tracks spreadsheet selection state.
 *
 * Manages active cell, anchor cell, selected ranges, and selection type.
 * Exposes immutable state snapshots. Pure state management — no rendering.
 */

import type { CellAddress, CellRange, Selection, SelectionType } from '../types/interfaces';
import type { MergeManager } from '../merge/merge-manager';

export interface SelectionManagerConfig {
  rowCount: number;
  colCount: number;
  onChange?: (selection: Selection, previousSelection: Selection) => void;
}

export class SelectionManager {
  private _activeCell: CellAddress = { row: 0, col: 0 };
  private _anchorCell: CellAddress = { row: 0, col: 0 };
  private _ranges: CellRange[] = [];
  private _type: SelectionType = 'cell';
  private _rowCount: number;
  private readonly _colCount: number;
  private readonly _onChange: ((selection: Selection, previousSelection: Selection) => void) | null;
  private _mergeManager: MergeManager | null = null;

  constructor(config: SelectionManagerConfig) {
    this._rowCount = config.rowCount;
    this._colCount = config.colCount;
    this._onChange = config.onChange ?? null;
  }

  get rowCount(): number {
    return this._rowCount;
  }

  /** Update row count (e.g., after filtering changes visible rows). */
  setRowCount(count: number): void {
    this._rowCount = count;
    // Clamp active cell if it's now beyond the new row count
    if (this._activeCell.row >= count && count > 0) {
      this._activeCell = { row: count - 1, col: this._activeCell.col };
    }
  }

  get colCount(): number {
    return this._colCount;
  }

  /** Set the merge manager for merge-aware selection. */
  setMergeManager(mm: MergeManager): void {
    this._mergeManager = mm;
  }

  /** Return an immutable snapshot of current selection state. */
  getSelection(): Selection {
    return {
      type: this._type,
      ranges: this._ranges.map((r) => ({ ...r })),
      activeCell: { ...this._activeCell },
      anchorCell: { ...this._anchorCell },
    };
  }

  /** Plain click — select a single cell. */
  selectCell(row: number, col: number): void {
    let r = this.clampRow(row);
    let c = this.clampCol(col);
    const prev = this.getSelection();

    // Merge-aware: redirect to anchor and expand range
    const region = this._mergeManager?.getMergedRegion(r, c);
    if (region) {
      r = region.startRow;
      c = region.startCol;
      this._activeCell = { row: r, col: c };
      this._anchorCell = { row: r, col: c };
      this._ranges = [
        {
          startRow: region.startRow,
          startCol: region.startCol,
          endRow: region.endRow,
          endCol: region.endCol,
        },
      ];
    } else {
      this._activeCell = { row: r, col: c };
      this._anchorCell = { row: r, col: c };
      this._ranges = [{ startRow: r, startCol: c, endRow: r, endCol: c }];
    }
    this._type = 'cell';

    this.notifyChange(prev);
  }

  /** Shift+click — extend selection from anchor to clicked cell. */
  extendSelection(row: number, col: number): void {
    let r = this.clampRow(row);
    let c = this.clampCol(col);
    const prev = this.getSelection();

    // Merge-aware: expand target to include full merged region
    const region = this._mergeManager?.getMergedRegion(r, c);
    if (region) {
      r = region.startRow;
      c = region.startCol;
    }

    this._activeCell = { row: r, col: c };
    let range = this.normalizeRange({
      startRow: this._anchorCell.row,
      startCol: this._anchorCell.col,
      endRow: r,
      endCol: c,
    });

    // Expand range to include any merged regions at target and anchor
    if (this._mergeManager) {
      const anchorRegion = this._mergeManager.getMergedRegion(
        this._anchorCell.row,
        this._anchorCell.col,
      );
      if (anchorRegion) {
        range = {
          startRow: Math.min(range.startRow, anchorRegion.startRow),
          startCol: Math.min(range.startCol, anchorRegion.startCol),
          endRow: Math.max(range.endRow, anchorRegion.endRow),
          endCol: Math.max(range.endCol, anchorRegion.endCol),
        };
      }
      if (region) {
        range = {
          startRow: Math.min(range.startRow, region.startRow),
          startCol: Math.min(range.startCol, region.startCol),
          endRow: Math.max(range.endRow, region.endRow),
          endCol: Math.max(range.endCol, region.endCol),
        };
      }
    }

    // Replace last range with extended range
    if (this._ranges.length > 0) {
      this._ranges[this._ranges.length - 1] = range;
    } else {
      this._ranges = [range];
    }
    this._type = 'range';

    this.notifyChange(prev);
  }

  /** Ctrl+click — add a new single-cell range to existing selection. */
  addRange(row: number, col: number): void {
    let r = this.clampRow(row);
    let c = this.clampCol(col);
    const prev = this.getSelection();

    // Merge-aware: redirect to anchor
    const region = this._mergeManager?.getMergedRegion(r, c);
    if (region) {
      r = region.startRow;
      c = region.startCol;
      this._activeCell = { row: r, col: c };
      this._anchorCell = { row: r, col: c };
      this._ranges.push({
        startRow: region.startRow,
        startCol: region.startCol,
        endRow: region.endRow,
        endCol: region.endCol,
      });
    } else {
      this._activeCell = { row: r, col: c };
      this._anchorCell = { row: r, col: c };
      this._ranges.push({ startRow: r, startCol: c, endRow: r, endCol: c });
    }
    this._type = 'cell';

    this.notifyChange(prev);
  }

  /** Row number click — select entire row. */
  selectRow(row: number): void {
    const r = this.clampRow(row);
    const prev = this.getSelection();

    this._activeCell = { row: r, col: 0 };
    this._anchorCell = { row: r, col: 0 };
    this._ranges = [{ startRow: r, startCol: 0, endRow: r, endCol: this._colCount - 1 }];
    this._type = 'row';

    this.notifyChange(prev);
  }

  /** Column header click — select entire column. */
  selectColumn(col: number): void {
    const c = this.clampCol(col);
    const prev = this.getSelection();

    this._activeCell = { row: 0, col: c };
    this._anchorCell = { row: 0, col: c };
    this._ranges = [{ startRow: 0, startCol: c, endRow: this._rowCount - 1, endCol: c }];
    this._type = 'column';

    this.notifyChange(prev);
  }

  /** Corner click or Ctrl+A — select all cells. */
  selectAll(): void {
    const prev = this.getSelection();

    this._activeCell = { row: 0, col: 0 };
    this._anchorCell = { row: 0, col: 0 };
    this._ranges = [
      {
        startRow: 0,
        startCol: 0,
        endRow: this._rowCount - 1,
        endCol: this._colCount - 1,
      },
    ];
    this._type = 'all';

    this.notifyChange(prev);
  }

  /** Check if a cell is within any selected range. */
  isSelected(row: number, col: number): boolean {
    for (const range of this._ranges) {
      if (
        row >= range.startRow &&
        row <= range.endRow &&
        col >= range.startCol &&
        col <= range.endCol
      ) {
        return true;
      }
    }
    return false;
  }

  /** Check if a cell is the active cell. */
  isActiveCell(row: number, col: number): boolean {
    return this._activeCell.row === row && this._activeCell.col === col;
  }

  private clampRow(row: number): number {
    return Math.max(0, Math.min(row, this._rowCount - 1));
  }

  private clampCol(col: number): number {
    return Math.max(0, Math.min(col, this._colCount - 1));
  }

  private normalizeRange(range: CellRange): CellRange {
    return {
      startRow: Math.min(range.startRow, range.endRow),
      startCol: Math.min(range.startCol, range.endCol),
      endRow: Math.max(range.startRow, range.endRow),
      endCol: Math.max(range.startCol, range.endCol),
    };
  }

  private notifyChange(prev: Selection): void {
    if (this._onChange) {
      this._onChange(this.getSelection(), prev);
    }
  }
}
