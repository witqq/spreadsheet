// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * SortEngine — multi-column sort with type-aware comparison.
 *
 * Reads cell values from CellStore, produces a sorted array of physical
 * row indices, and feeds it to DataView.recompute(). Supports multi-column
 * sort with per-column asc/desc direction and stable ordering.
 */

import type { CellStore } from '../model/cell-store';
import type { CellValue } from '../types/interfaces';

export type SortDirection = 'asc' | 'desc';

export interface SortColumn {
  /** Column index to sort by. */
  readonly col: number;
  /** Sort direction. */
  readonly direction: SortDirection;
}

export interface SortEngineConfig {
  cellStore: CellStore;
  totalRowCount: number;
}

export class SortEngine {
  private readonly cellStore: CellStore;
  private _totalRowCount: number;
  private _sortColumns: SortColumn[] = [];

  constructor(config: SortEngineConfig) {
    this.cellStore = config.cellStore;
    this._totalRowCount = config.totalRowCount;
  }

  /** Current sort columns (read-only). */
  get sortColumns(): readonly SortColumn[] {
    return this._sortColumns;
  }

  /** True when no sort is active. */
  isClear(): boolean {
    return this._sortColumns.length === 0;
  }

  /**
   * Toggle sort on a column: none → asc → desc → none.
   * If multiColumn is true, add/modify without clearing other columns.
   * Returns the new sort state.
   */
  toggleColumn(col: number, multiColumn = false): SortColumn[] {
    const existing = this._sortColumns.findIndex((s) => s.col === col);

    if (!multiColumn) {
      if (existing >= 0) {
        const current = this._sortColumns[existing];
        if (current.direction === 'asc') {
          this._sortColumns = [{ col, direction: 'desc' }];
        } else {
          this._sortColumns = [];
        }
      } else {
        this._sortColumns = [{ col, direction: 'asc' }];
      }
    } else {
      if (existing >= 0) {
        const current = this._sortColumns[existing];
        if (current.direction === 'asc') {
          this._sortColumns[existing] = { col, direction: 'desc' };
        } else {
          this._sortColumns.splice(existing, 1);
        }
      } else {
        this._sortColumns.push({ col, direction: 'asc' });
      }
    }

    return [...this._sortColumns];
  }

  /** Set sort columns programmatically. */
  setSortColumns(columns: SortColumn[]): void {
    this._sortColumns = [...columns];
  }

  /** Clear all sort columns. */
  clearSort(): void {
    this._sortColumns = [];
  }

  /** Update total row count (e.g., when rows are added/removed). */
  setTotalRowCount(count: number): void {
    this._totalRowCount = count;
  }

  /**
   * Compute sorted physical row indices based on current sort columns.
   * Returns null if no sort is active (caller should reset DataView).
   * Accepts optional physicalIndices for sorting a filtered subset.
   */
  computeSortedIndices(physicalIndices?: number[]): number[] | null {
    if (this._sortColumns.length === 0) return null;

    const indices = physicalIndices
      ? [...physicalIndices]
      : Array.from({ length: this._totalRowCount }, (_, i) => i);

    indices.sort((a, b) => {
      for (const { col, direction } of this._sortColumns) {
        const valA = this.cellStore.get(a, col)?.value ?? null;
        const valB = this.cellStore.get(b, col)?.value ?? null;

        // Nulls always sort last regardless of direction
        if (valA == null && valB == null) continue;
        if (valA == null) return 1;
        if (valB == null) return -1;

        const cmp = compareCellValues(valA, valB);
        if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
      }
      return a - b; // stable: preserve original order for equal values
    });

    return indices;
  }
}

/**
 * Type-aware comparison for cell values.
 * null/undefined sorts last. Numbers, strings, booleans, dates each
 * compared within their type. Cross-type: number < boolean < string.
 */
export function compareCellValues(a: CellValue, b: CellValue): number {
  if (a === b) return 0;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const typeA = typeof a;
  const typeB = typeof b;

  // Same type — direct comparison
  if (typeA === typeB) {
    if (typeA === 'number') return (a as number) - (b as number);
    if (typeA === 'string') return (a as string).localeCompare(b as string);
    if (typeA === 'boolean') return (a as boolean) === (b as boolean) ? 0 : (a as boolean) ? -1 : 1;
  }

  // Date instances
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (a instanceof Date) return -1;
  if (b instanceof Date) return 1;

  // Cross-type ordering: number < boolean < string
  const typeOrder: Record<string, number> = { number: 0, boolean: 1, string: 2 };
  return (typeOrder[typeA] ?? 3) - (typeOrder[typeB] ?? 3);
}
