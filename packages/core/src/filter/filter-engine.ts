// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellStore } from '../model/cell-store';
import type { CellValue } from '../types/interfaces';

/** Supported filter operator types. */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

/** A single column filter condition. */
export interface FilterCondition {
  col: number;
  operator: FilterOperator;
  /** Value to compare against. Not used for isEmpty/isNotEmpty. */
  value?: CellValue;
  /** Second value for 'between' operator (inclusive range). */
  valueTo?: CellValue;
  /** Array of values for 'in' / 'notIn' operators. */
  values?: CellValue[];
}

export interface FilterEngineConfig {
  cellStore: CellStore;
  totalRowCount: number;
}

/**
 * FilterEngine — evaluates filter conditions against CellStore rows.
 *
 * Produces a Set of visible (passing) physical row indices.
 * Multiple conditions on the same column use AND logic.
 * Conditions across different columns also use AND logic.
 */
export class FilterEngine {
  private readonly cellStore: CellStore;
  private _totalRowCount: number;
  private _conditions: FilterCondition[] = [];

  constructor(config: FilterEngineConfig) {
    this.cellStore = config.cellStore;
    this._totalRowCount = config.totalRowCount;
  }

  /** Current filter conditions. */
  get conditions(): readonly FilterCondition[] {
    return this._conditions;
  }

  /** Set filter conditions for a column (replaces existing for that column). */
  setColumnFilter(col: number, conditions: FilterCondition[]): void {
    this._conditions = this._conditions.filter((c) => c.col !== col);
    this._conditions.push(...conditions);
  }

  /** Remove all filter conditions for a column. */
  removeColumnFilter(col: number): void {
    this._conditions = this._conditions.filter((c) => c.col !== col);
  }

  /** Get filter conditions for a specific column. */
  getColumnFilters(col: number): FilterCondition[] {
    return this._conditions.filter((c) => c.col === col);
  }

  /** Get set of column indices that have active filters. */
  getFilteredColumns(): Set<number> {
    const cols = new Set<number>();
    for (const c of this._conditions) cols.add(c.col);
    return cols;
  }

  /** Set all conditions at once (replaces everything). */
  setConditions(conditions: FilterCondition[]): void {
    this._conditions = [...conditions];
  }

  /** Clear all filter conditions. */
  clearAll(): void {
    this._conditions = [];
  }

  /** Alias for clearAll(). */
  clearFilters(): void {
    this._conditions = [];
  }

  /** Total row count. */
  get totalRowCount(): number {
    return this._totalRowCount;
  }

  /** Get the number of visible rows (after filtering). */
  getVisibleRowCount(): number {
    if (this._conditions.length === 0) return this._totalRowCount;
    const visible = this.computeVisibleRows();
    return visible ? visible.length : this._totalRowCount;
  }

  /** Update total row count (e.g., when rows are added/removed). */
  setTotalRowCount(count: number): void {
    this._totalRowCount = count;
  }

  /** True when no filter conditions are set. */
  get hasActiveFilters(): boolean {
    return this._conditions.length > 0;
  }

  /**
   * Compute the set of visible physical row indices.
   * Returns null if no filters are active (all rows visible).
   */
  computeVisibleRows(): number[] | null {
    if (this._conditions.length === 0) return null;

    const result: number[] = [];
    for (let row = 0; row < this._totalRowCount; row++) {
      if (this.rowPassesAllConditions(row)) {
        result.push(row);
      }
    }
    return result;
  }

  /** Check if a single row passes all filter conditions. */
  private rowPassesAllConditions(physicalRow: number): boolean {
    for (const cond of this._conditions) {
      const cellData = this.cellStore.get(physicalRow, cond.col);
      const value = cellData?.value ?? null;
      if (!evaluateCondition(value, cond)) return false;
    }
    return true;
  }
}

/** Evaluate a single filter condition against a cell value. */
export function evaluateCondition(value: CellValue | null, cond: FilterCondition): boolean {
  switch (cond.operator) {
    case 'isEmpty':
      return value == null || value === '';

    case 'isNotEmpty':
      return value != null && value !== '';

    case 'equals':
      return looseEquals(value, cond.value ?? null);

    case 'notEquals':
      return !looseEquals(value, cond.value ?? null);

    case 'contains':
      return toString(value).toLowerCase().includes(toString(cond.value).toLowerCase());

    case 'startsWith':
      return toString(value).toLowerCase().startsWith(toString(cond.value).toLowerCase());

    case 'endsWith':
      return toString(value).toLowerCase().endsWith(toString(cond.value).toLowerCase());

    case 'greaterThan':
      return compareValues(value, cond.value ?? null) > 0;

    case 'lessThan':
      return compareValues(value, cond.value ?? null) < 0;

    case 'greaterThanOrEqual':
      return compareValues(value, cond.value ?? null) >= 0;

    case 'lessThanOrEqual':
      return compareValues(value, cond.value ?? null) <= 0;

    case 'between': {
      const lo = compareValues(value, cond.value ?? null);
      const hi = compareValues(value, cond.valueTo ?? null);
      return lo >= 0 && hi <= 0;
    }

    case 'in':
      return (cond.values ?? []).some((v) => looseEquals(value, v));

    case 'notIn':
      return !(cond.values ?? []).some((v) => looseEquals(value, v));

    default:
      return true;
  }
}

/** Loose equality: string comparison is case-insensitive. Numeric coercion when types differ. */
function looseEquals(a: CellValue | null, b: CellValue | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  // Numeric coercion: when one is number and other is string, try numeric comparison
  if (typeof a === 'number' && typeof b === 'string') {
    const n = Number(b);
    if (!isNaN(n)) return a === n;
  }
  if (typeof b === 'number' && typeof a === 'string') {
    const n = Number(a);
    if (!isNaN(n)) return n === b;
  }
  return a === b;
}

/** Compare two values numerically or as strings. Null < everything. Numeric coercion when types differ. */
function compareValues(a: CellValue | null, b: CellValue | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  // Numeric coercion: when one is number and other is string, try numeric comparison
  if (typeof a === 'number' && typeof b === 'string') {
    const n = Number(b);
    if (!isNaN(n)) return a - n;
  }
  if (typeof b === 'number' && typeof a === 'string') {
    const n = Number(a);
    if (!isNaN(n)) return n - b;
  }

  return String(a).localeCompare(String(b));
}

/** Safely convert to string for text operations. */
function toString(v: CellValue | null | undefined): string {
  if (v == null) return '';
  return String(v);
}
