// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellData, CellMetadata, CellRange, CellValue } from '../types/interfaces';

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Sparse cell storage using Map with "row:col" string keys.
 * Only stores non-empty cells — O(1) get/set/delete.
 * Tracks version for dirty region integration.
 */
export class CellStore {
  private readonly cells = new Map<string, CellData>();
  private _version = 0;

  get size(): number {
    return this.cells.size;
  }

  get version(): number {
    return this._version;
  }

  get(row: number, col: number): CellData | undefined {
    return this.cells.get(cellKey(row, col));
  }

  has(row: number, col: number): boolean {
    return this.cells.has(cellKey(row, col));
  }

  set(row: number, col: number, data: CellData): void {
    this.cells.set(cellKey(row, col), data);
    this._version++;
  }

  setValue(row: number, col: number, value: CellValue): void {
    const existing = this.get(row, col);
    if (existing) {
      this.set(row, col, { ...existing, value });
    } else {
      this.set(row, col, { value });
    }
  }

  delete(row: number, col: number): boolean {
    const deleted = this.cells.delete(cellKey(row, col));
    if (deleted) this._version++;
    return deleted;
  }

  clear(): void {
    if (this.cells.size > 0) {
      this.cells.clear();
      this._version++;
    }
  }

  /**
   * Iterate cells within the given range (inclusive bounds).
   * Yields only cells that exist in the sparse map.
   */
  *iterateRange(range: CellRange): IterableIterator<{ row: number; col: number; data: CellData }> {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const data = this.cells.get(cellKey(row, col));
        if (data !== undefined) {
          yield { row, col, data };
        }
      }
    }
  }

  /**
   * Bulk load data from an array of row objects.
   * Each row is a Record<string, unknown> keyed by column key.
   * columnKeys maps column key → column index for storage.
   */
  setMetadata(row: number, col: number, metadata: Partial<CellMetadata>): void {
    const existing = this.get(row, col);
    const merged: CellMetadata = { ...existing?.metadata, ...metadata };
    if (existing) {
      this.set(row, col, { ...existing, metadata: merged });
    } else {
      this.set(row, col, { value: null, metadata: merged });
    }
  }

  clearMetadata(row: number, col: number): void {
    const existing = this.get(row, col);
    if (existing?.metadata) {
      const { metadata: _, ...rest } = existing;
      this.set(row, col, rest as CellData);
    }
  }

  bulkLoad(rows: ReadonlyArray<Record<string, unknown>>, columnKeys: ReadonlyArray<string>): void {
    this.bulkLoadChunk(0, rows, columnKeys);
  }

  /**
   * Bulk-load rows starting at a given row offset. Single version bump.
   * Much faster than repeated setValue() for large chunks — avoids per-cell
   * key creation overhead, get() checks, and spread copies.
   */
  bulkLoadChunk(
    startRow: number,
    rows: ReadonlyArray<Record<string, unknown>>,
    columnKeys: ReadonlyArray<string>,
  ): void {
    for (let i = 0; i < rows.length; i++) {
      const record = rows[i];
      const row = startRow + i;
      for (let col = 0; col < columnKeys.length; col++) {
        const key = columnKeys[col];
        const value = record[key];
        if (value !== undefined && value !== null) {
          this.cells.set(`${row}:${col}`, { value: value as CellValue });
        }
      }
    }
    this._version++;
  }

  /**
   * Generate and load rows in-place without allocating intermediate array.
   * Best for progressive loading where rows are generated on-the-fly.
   */
  bulkGenerate(
    startRow: number,
    count: number,
    columnKeys: ReadonlyArray<string>,
    generateRow: (index: number) => Record<string, unknown>,
  ): void {
    for (let i = 0; i < count; i++) {
      const record = generateRow(startRow + i);
      const row = startRow + i;
      for (let col = 0; col < columnKeys.length; col++) {
        const value = record[columnKeys[col]];
        if (value !== undefined && value !== null) {
          this.cells.set(`${row}:${col}`, { value: value as CellValue });
        }
      }
    }
    this._version++;
  }

  /**
   * Bulk load complete CellData objects from a 2D array.
   * Position [i][j] maps to row (startRow + i), column j.
   * Stores value, type, style, metadata, and custom fields in one pass.
   * Null/undefined entries are skipped (sparse data supported).
   * Single version bump for the entire operation.
   */
  bulkLoadCellData(
    data: ReadonlyArray<ReadonlyArray<CellData | null | undefined>>,
    startRow = 0,
  ): void {
    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      if (!rowData) continue;
      const row = startRow + i;
      for (let col = 0; col < rowData.length; col++) {
        const cellData = rowData[col];
        if (cellData != null) {
          this.cells.set(`${row}:${col}`, cellData);
        }
      }
    }
    this._version++;
  }

  /**
   * Iterate all entries in the store. Each entry has parsed row/col and data.
   * Order is not guaranteed.
   */
  *entries(): IterableIterator<{ row: number; col: number; data: CellData }> {
    for (const [key, data] of this.cells) {
      const sep = key.indexOf(':');
      const row = parseInt(key.substring(0, sep), 10);
      const col = parseInt(key.substring(sep + 1), 10);
      yield { row, col, data };
    }
  }
}
