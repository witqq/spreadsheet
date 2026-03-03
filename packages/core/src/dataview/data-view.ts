// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DataView — logical↔physical row index mapping layer.
 *
 * Sits between CellStore (physical rows) and the rest of the engine
 * (logical rows). When no sort/filter is active, operates as a
 * zero-overhead passthrough (null mapping).
 */

export interface DataViewConfig {
  totalRowCount: number;
}

export class DataView {
  private _mapping: number[] | null = null;
  private _reverseMapping: Map<number, number> | null = null;
  private _totalRowCount: number;
  private _visibleRowCount: number;

  constructor(config: DataViewConfig) {
    this._totalRowCount = config.totalRowCount;
    this._visibleRowCount = config.totalRowCount;
  }

  /** Convert a logical (visible) row index to its physical (CellStore) row index. */
  getPhysicalRow(logicalRow: number): number {
    if (this._mapping === null) return logicalRow;
    return this._mapping[logicalRow] ?? -1;
  }

  /** Convert a physical (CellStore) row index to its logical (visible) row index. Returns undefined if row is hidden. */
  getLogicalRow(physicalRow: number): number | undefined {
    if (this._reverseMapping === null) return physicalRow;
    return this._reverseMapping.get(physicalRow);
  }

  /** Number of visible rows (after filtering). */
  get visibleRowCount(): number {
    return this._visibleRowCount;
  }

  /** Total physical rows (before filtering). */
  get totalRowCount(): number {
    return this._totalRowCount;
  }

  /** True when logical === physical (no sort/filter active). */
  isPassthrough(): boolean {
    return this._mapping === null;
  }

  /**
   * Recompute the mapping from a sorted/filtered array of physical row indices.
   * physicalIndices[logicalRow] = physicalRow.
   */
  recompute(physicalIndices: number[]): void {
    this._mapping = physicalIndices;
    this._reverseMapping = new Map();
    for (let i = 0; i < physicalIndices.length; i++) {
      this._reverseMapping.set(physicalIndices[i], i);
    }
    this._visibleRowCount = physicalIndices.length;
  }

  /** Reset to passthrough (identity mapping). */
  reset(): void {
    this._mapping = null;
    this._reverseMapping = null;
    this._visibleRowCount = this._totalRowCount;
  }

  /** Update total row count (e.g., when rows are added/removed). */
  setTotalRowCount(count: number): void {
    this._totalRowCount = count;
    if (this._mapping === null) {
      this._visibleRowCount = count;
    }
  }
}
