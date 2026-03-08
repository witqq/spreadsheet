// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Row metadata storage: height overrides and hidden rows.
 * Rows without overrides use the default height from theme.
 * Tracks version for dirty region integration.
 *
 * Height overrides are separated into manual (user drag-resized) and
 * auto (computed by measurement protocol). Manual overrides always
 * take priority over auto-measured heights.
 */
export class RowStore {
  private readonly manualHeightOverrides = new Map<number, number>();
  private readonly autoHeightOverrides = new Map<number, number>();
  private readonly hiddenRows = new Set<number>();
  private _version = 0;

  get version(): number {
    return this._version;
  }

  get overrideCount(): number {
    return this.manualHeightOverrides.size + this.autoHeightOverrides.size;
  }

  get manualOverrideCount(): number {
    return this.manualHeightOverrides.size;
  }

  get autoOverrideCount(): number {
    return this.autoHeightOverrides.size;
  }

  get hiddenCount(): number {
    return this.hiddenRows.size;
  }

  /**
   * Resolve height for a row. Priority: hidden → manual → auto → default.
   */
  getHeight(row: number, defaultHeight: number): number {
    if (this.hiddenRows.has(row)) return 0;
    const manual = this.manualHeightOverrides.get(row);
    if (manual !== undefined) return manual;
    return this.autoHeightOverrides.get(row) ?? defaultHeight;
  }

  /**
   * Set a manual height override (from user interaction, e.g. drag resize).
   * Manual overrides always take priority over auto-measured heights.
   */
  setHeight(row: number, height: number): void {
    this.manualHeightOverrides.set(row, height);
    this._version++;
  }

  /**
   * Set an auto-measured height override (from measurement protocol).
   * Only effective when no manual override exists for the row.
   */
  setAutoHeight(row: number, height: number): void {
    this.autoHeightOverrides.set(row, height);
    this._version++;
  }

  /**
   * Set auto-measured heights in batch. Only increments version once.
   * Returns the set of row indices that actually changed effective height.
   */
  setAutoHeightsBatch(updates: Map<number, number>, defaultHeight: number): Set<number> {
    const changed = new Set<number>();
    for (const [row, height] of updates) {
      // Skip rows with manual overrides — manual always wins
      if (this.manualHeightOverrides.has(row)) continue;
      const oldEffective = this.autoHeightOverrides.get(row) ?? defaultHeight;
      if (Math.abs(oldEffective - height) > 0.01) {
        this.autoHeightOverrides.set(row, height);
        changed.add(row);
      }
    }
    if (changed.size > 0) this._version++;
    return changed;
  }

  /** Check if a row has a manual height override. */
  isManual(row: number): boolean {
    return this.manualHeightOverrides.has(row);
  }

  /** Check if a row has an auto height override. */
  isAuto(row: number): boolean {
    return this.autoHeightOverrides.has(row);
  }

  /** Clear manual height override for a row. */
  clearHeight(row: number): void {
    if (this.manualHeightOverrides.delete(row)) {
      this._version++;
    }
  }

  /** Clear auto height override for a row. */
  clearAutoHeight(row: number): void {
    if (this.autoHeightOverrides.delete(row)) {
      this._version++;
    }
  }

  /** Clear all auto height overrides. */
  clearAllAutoHeights(): void {
    if (this.autoHeightOverrides.size > 0) {
      this.autoHeightOverrides.clear();
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
  *visibleRowsInRange(startRow: number, endRow: number): IterableIterator<number> {
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
    const newManual = new Map<number, number>();
    for (const [row, height] of this.manualHeightOverrides) {
      if (row < deletedRow) {
        newManual.set(row, height);
      } else if (row > deletedRow) {
        newManual.set(row - 1, height);
      }
    }
    const newAuto = new Map<number, number>();
    for (const [row, height] of this.autoHeightOverrides) {
      if (row < deletedRow) {
        newAuto.set(row, height);
      } else if (row > deletedRow) {
        newAuto.set(row - 1, height);
      }
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
      this.manualHeightOverrides.size !== newManual.size ||
      this.autoHeightOverrides.size !== newAuto.size ||
      this.hiddenRows.size !== newHidden.size ||
      newManual.size > 0 ||
      newAuto.size > 0 ||
      newHidden.size > 0;
    this.manualHeightOverrides.clear();
    for (const [k, v] of newManual) this.manualHeightOverrides.set(k, v);
    this.autoHeightOverrides.clear();
    for (const [k, v] of newAuto) this.autoHeightOverrides.set(k, v);
    this.hiddenRows.clear();
    for (const v of newHidden) this.hiddenRows.add(v);
    if (changed) this._version++;
  }

  clear(): void {
    const hadData =
      this.manualHeightOverrides.size > 0 ||
      this.autoHeightOverrides.size > 0 ||
      this.hiddenRows.size > 0;
    this.manualHeightOverrides.clear();
    this.autoHeightOverrides.clear();
    this.hiddenRows.clear();
    if (hadData) this._version++;
  }
}
