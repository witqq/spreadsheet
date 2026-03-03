// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Row metadata storage: height overrides and hidden rows.
 * Rows without overrides use the default height from theme.
 * Tracks version for dirty region integration.
 */
export class RowStore {
  private readonly heightOverrides = new Map<number, number>();
  private readonly hiddenRows = new Set<number>();
  private _version = 0;

  get version(): number {
    return this._version;
  }

  get overrideCount(): number {
    return this.heightOverrides.size;
  }

  get hiddenCount(): number {
    return this.hiddenRows.size;
  }

  getHeight(row: number, defaultHeight: number): number {
    if (this.hiddenRows.has(row)) return 0;
    return this.heightOverrides.get(row) ?? defaultHeight;
  }

  setHeight(row: number, height: number): void {
    this.heightOverrides.set(row, height);
    this._version++;
  }

  clearHeight(row: number): void {
    if (this.heightOverrides.delete(row)) {
      this._version++;
    }
  }

  isHidden(row: number): boolean {
    return this.hiddenRows.has(row);
  }

  hide(row: number): void {
    if (!this.hiddenRows.has(row)) {
      this.hiddenRows.add(row);
      this._version++;
    }
  }

  show(row: number): void {
    if (this.hiddenRows.delete(row)) {
      this._version++;
    }
  }

  /**
   * Iterate visible row indices in the given range (inclusive).
   * Skips hidden rows.
   */
  *visibleRowsInRange(
    startRow: number,
    endRow: number,
  ): IterableIterator<number> {
    for (let row = startRow; row <= endRow; row++) {
      if (!this.hiddenRows.has(row)) {
        yield row;
      }
    }
  }

  /**
   * Shift all row metadata above `deletedRow` index down by 1.
   * Used when a row is deleted to keep height/hidden state aligned.
   */
  shiftRowsUp(deletedRow: number): void {
    // Collect entries that need shifting
    const newHeights = new Map<number, number>();
    for (const [row, height] of this.heightOverrides) {
      if (row < deletedRow) {
        newHeights.set(row, height);
      } else if (row > deletedRow) {
        newHeights.set(row - 1, height);
      }
      // row === deletedRow is dropped
    }
    const newHidden = new Set<number>();
    for (const row of this.hiddenRows) {
      if (row < deletedRow) {
        newHidden.add(row);
      } else if (row > deletedRow) {
        newHidden.add(row - 1);
      }
    }
    const changed =
      this.heightOverrides.size !== newHeights.size ||
      this.hiddenRows.size !== newHidden.size ||
      newHeights.size > 0 ||
      newHidden.size > 0;
    this.heightOverrides.clear();
    for (const [k, v] of newHeights) this.heightOverrides.set(k, v);
    this.hiddenRows.clear();
    for (const v of newHidden) this.hiddenRows.add(v);
    if (changed) this._version++;
  }

  clear(): void {
    const hadData =
      this.heightOverrides.size > 0 || this.hiddenRows.size > 0;
    this.heightOverrides.clear();
    this.hiddenRows.clear();
    if (hadData) this._version++;
  }
}
