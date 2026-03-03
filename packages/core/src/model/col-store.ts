// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { ColumnDef } from '../types/interfaces';

/**
 * Column definitions store with hidden column tracking.
 * Manages ordered column list and visibility.
 * Tracks version for dirty region integration.
 */
export class ColStore {
  private _columns: ColumnDef[];
  private readonly hiddenCols = new Set<number>();
  private _version = 0;

  constructor(columns: ColumnDef[] = []) {
    this._columns = [...columns];
  }

  get version(): number {
    return this._version;
  }

  get columnCount(): number {
    return this._columns.length;
  }

  get visibleColumnCount(): number {
    return this._columns.length - this.hiddenCols.size;
  }

  get hiddenCount(): number {
    return this.hiddenCols.size;
  }

  getColumn(index: number): ColumnDef | undefined {
    return this._columns[index];
  }

  getColumns(): ReadonlyArray<ColumnDef> {
    return this._columns;
  }

  setColumns(columns: ColumnDef[]): void {
    this._columns = [...columns];
    this.hiddenCols.clear();
    // Apply hidden flag from column definitions
    for (let i = 0; i < this._columns.length; i++) {
      if (this._columns[i].hidden) {
        this.hiddenCols.add(i);
      }
    }
    this._version++;
  }

  isHidden(index: number): boolean {
    return this.hiddenCols.has(index);
  }

  hide(index: number): void {
    if (index >= 0 && index < this._columns.length && !this.hiddenCols.has(index)) {
      this.hiddenCols.add(index);
      this._version++;
    }
  }

  show(index: number): void {
    if (this.hiddenCols.delete(index)) {
      this._version++;
    }
  }

  /**
   * Iterate visible columns with their original indices.
   */
  *visibleColumns(): IterableIterator<{ index: number; column: ColumnDef }> {
    for (let i = 0; i < this._columns.length; i++) {
      if (!this.hiddenCols.has(i)) {
        yield { index: i, column: this._columns[i] };
      }
    }
  }

  /**
   * Iterate visible column indices in a range (inclusive).
   */
  *visibleColumnsInRange(
    startCol: number,
    endCol: number,
  ): IterableIterator<number> {
    const end = Math.min(endCol, this._columns.length - 1);
    for (let i = Math.max(startCol, 0); i <= end; i++) {
      if (!this.hiddenCols.has(i)) {
        yield i;
      }
    }
  }

  /**
   * Find column index by key.
   */
  findByKey(key: string): number {
    return this._columns.findIndex((c) => c.key === key);
  }

  clear(): void {
    this._columns = [];
    this.hiddenCols.clear();
    this._version++;
  }
}
