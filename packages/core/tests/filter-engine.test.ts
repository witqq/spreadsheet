import { describe, it, expect, beforeEach } from 'vitest';
import { FilterEngine, evaluateCondition } from '../src/filter/filter-engine';
import type { FilterCondition } from '../src/filter/filter-engine';
import { CellStore } from '../src/model/cell-store';

// ─── Helper ──────────────────────────────────────────────────

function makeEngine(
  data: (string | number | boolean | null)[][],
): { engine: FilterEngine; cellStore: CellStore } {
  const cellStore = new CellStore();
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const v = data[row][col];
      if (v != null) cellStore.set(row, col, { value: v });
    }
  }
  const engine = new FilterEngine({ cellStore, totalRowCount: data.length });
  return { engine, cellStore };
}

// ─── evaluateCondition (unit) ────────────────────────────────

describe('evaluateCondition', () => {
  it('isEmpty: null and empty string pass', () => {
    expect(evaluateCondition(null, { col: 0, operator: 'isEmpty' })).toBe(true);
    expect(evaluateCondition('', { col: 0, operator: 'isEmpty' })).toBe(true);
    expect(evaluateCondition('abc', { col: 0, operator: 'isEmpty' })).toBe(false);
    expect(evaluateCondition(0, { col: 0, operator: 'isEmpty' })).toBe(false);
  });

  it('isNotEmpty: rejects null and empty string', () => {
    expect(evaluateCondition(null, { col: 0, operator: 'isNotEmpty' })).toBe(false);
    expect(evaluateCondition('', { col: 0, operator: 'isNotEmpty' })).toBe(false);
    expect(evaluateCondition('abc', { col: 0, operator: 'isNotEmpty' })).toBe(true);
    expect(evaluateCondition(0, { col: 0, operator: 'isNotEmpty' })).toBe(true);
  });

  it('equals: case-insensitive for strings', () => {
    expect(evaluateCondition('Hello', { col: 0, operator: 'equals', value: 'hello' })).toBe(true);
    expect(evaluateCondition('Hello', { col: 0, operator: 'equals', value: 'world' })).toBe(false);
    expect(evaluateCondition(42, { col: 0, operator: 'equals', value: 42 })).toBe(true);
    expect(evaluateCondition(42, { col: 0, operator: 'equals', value: 43 })).toBe(false);
    expect(evaluateCondition(null, { col: 0, operator: 'equals', value: null })).toBe(true);
    expect(evaluateCondition(null, { col: 0, operator: 'equals', value: 'x' })).toBe(false);
  });

  it('notEquals: inverse of equals', () => {
    expect(evaluateCondition('Hello', { col: 0, operator: 'notEquals', value: 'hello' })).toBe(false);
    expect(evaluateCondition('Hello', { col: 0, operator: 'notEquals', value: 'world' })).toBe(true);
  });

  it('contains: case-insensitive substring match', () => {
    expect(evaluateCondition('Hello World', { col: 0, operator: 'contains', value: 'lo wo' })).toBe(true);
    expect(evaluateCondition('Hello World', { col: 0, operator: 'contains', value: 'xyz' })).toBe(false);
    expect(evaluateCondition(null, { col: 0, operator: 'contains', value: '' })).toBe(true);
  });

  it('startsWith: case-insensitive prefix', () => {
    expect(evaluateCondition('Hello', { col: 0, operator: 'startsWith', value: 'hel' })).toBe(true);
    expect(evaluateCondition('Hello', { col: 0, operator: 'startsWith', value: 'llo' })).toBe(false);
  });

  it('endsWith: case-insensitive suffix', () => {
    expect(evaluateCondition('Hello', { col: 0, operator: 'endsWith', value: 'LLO' })).toBe(true);
    expect(evaluateCondition('Hello', { col: 0, operator: 'endsWith', value: 'Hel' })).toBe(false);
  });

  it('greaterThan: numeric comparison', () => {
    expect(evaluateCondition(10, { col: 0, operator: 'greaterThan', value: 5 })).toBe(true);
    expect(evaluateCondition(5, { col: 0, operator: 'greaterThan', value: 5 })).toBe(false);
    expect(evaluateCondition(3, { col: 0, operator: 'greaterThan', value: 5 })).toBe(false);
  });

  it('lessThan: numeric comparison', () => {
    expect(evaluateCondition(3, { col: 0, operator: 'lessThan', value: 5 })).toBe(true);
    expect(evaluateCondition(5, { col: 0, operator: 'lessThan', value: 5 })).toBe(false);
  });

  it('greaterThanOrEqual: inclusive', () => {
    expect(evaluateCondition(5, { col: 0, operator: 'greaterThanOrEqual', value: 5 })).toBe(true);
    expect(evaluateCondition(6, { col: 0, operator: 'greaterThanOrEqual', value: 5 })).toBe(true);
    expect(evaluateCondition(4, { col: 0, operator: 'greaterThanOrEqual', value: 5 })).toBe(false);
  });

  it('lessThanOrEqual: inclusive', () => {
    expect(evaluateCondition(5, { col: 0, operator: 'lessThanOrEqual', value: 5 })).toBe(true);
    expect(evaluateCondition(4, { col: 0, operator: 'lessThanOrEqual', value: 5 })).toBe(true);
    expect(evaluateCondition(6, { col: 0, operator: 'lessThanOrEqual', value: 5 })).toBe(false);
  });

  it('between: inclusive range', () => {
    expect(evaluateCondition(5, { col: 0, operator: 'between', value: 1, valueTo: 10 })).toBe(true);
    expect(evaluateCondition(1, { col: 0, operator: 'between', value: 1, valueTo: 10 })).toBe(true);
    expect(evaluateCondition(10, { col: 0, operator: 'between', value: 1, valueTo: 10 })).toBe(true);
    expect(evaluateCondition(0, { col: 0, operator: 'between', value: 1, valueTo: 10 })).toBe(false);
    expect(evaluateCondition(11, { col: 0, operator: 'between', value: 1, valueTo: 10 })).toBe(false);
  });

  it('in: matches any value in array (case-insensitive strings)', () => {
    expect(evaluateCondition('B', { col: 0, operator: 'in', values: ['a', 'b', 'c'] })).toBe(true);
    expect(evaluateCondition('d', { col: 0, operator: 'in', values: ['a', 'b', 'c'] })).toBe(false);
    expect(evaluateCondition(2, { col: 0, operator: 'in', values: [1, 2, 3] })).toBe(true);
  });

  it('notIn: rejects values in array', () => {
    expect(evaluateCondition('B', { col: 0, operator: 'notIn', values: ['a', 'b', 'c'] })).toBe(false);
    expect(evaluateCondition('d', { col: 0, operator: 'notIn', values: ['a', 'b', 'c'] })).toBe(true);
  });

  it('null handling in comparisons', () => {
    expect(evaluateCondition(null, { col: 0, operator: 'greaterThan', value: 0 })).toBe(false);
    expect(evaluateCondition(null, { col: 0, operator: 'lessThan', value: 0 })).toBe(true);
    expect(evaluateCondition(null, { col: 0, operator: 'between', value: 0, valueTo: 10 })).toBe(false);
  });

  it('numeric coercion: equals with number cell and string filter value', () => {
    // FilterPanel sends string values from input element; CellStore has numbers
    expect(evaluateCondition(42, { col: 0, operator: 'equals', value: '42' })).toBe(true);
    expect(evaluateCondition(42, { col: 0, operator: 'equals', value: '2' })).toBe(false);
    expect(evaluateCondition(0, { col: 0, operator: 'equals', value: '0' })).toBe(true);
  });

  it('numeric coercion: greaterThan/lessThan with mixed types', () => {
    expect(evaluateCondition(9, { col: 0, operator: 'greaterThan', value: '5' })).toBe(true);
    expect(evaluateCondition(9, { col: 0, operator: 'lessThan', value: '50' })).toBe(true);
    expect(evaluateCondition(9, { col: 0, operator: 'greaterThan', value: '10' })).toBe(false);
    // Reverse: string cell vs number filter
    expect(evaluateCondition('9', { col: 0, operator: 'greaterThan', value: 5 })).toBe(true);
  });

  it('numeric coercion: non-numeric string falls back to string comparison', () => {
    expect(evaluateCondition(42, { col: 0, operator: 'equals', value: 'abc' })).toBe(false);
    expect(evaluateCondition('abc', { col: 0, operator: 'equals', value: 42 })).toBe(false);
  });
});

// ─── FilterEngine integration ────────────────────────────────

describe('FilterEngine', () => {
  const data: (string | number | null)[][] = [
    ['Alice', 30, 'Engineering'],   // row 0
    ['Bob', 25, 'Marketing'],       // row 1
    ['Charlie', 35, 'Engineering'], // row 2
    ['Diana', 28, 'Sales'],         // row 3
    ['Eve', 30, 'Marketing'],       // row 4
    [null, null, null],             // row 5 (empty)
  ];

  let engine: FilterEngine;

  beforeEach(() => {
    ({ engine } = makeEngine(data));
  });

  it('no filters → returns null (all visible)', () => {
    expect(engine.computeVisibleRows()).toBeNull();
  });

  it('hasActiveFilters reflects state', () => {
    expect(engine.hasActiveFilters).toBe(false);
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    expect(engine.hasActiveFilters).toBe(true);
  });

  it('single column equals filter', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'alice' }]);
    expect(engine.computeVisibleRows()).toEqual([0]);
  });

  it('single column numeric greaterThan', () => {
    engine.setColumnFilter(1, [{ col: 1, operator: 'greaterThan', value: 29 }]);
    expect(engine.computeVisibleRows()).toEqual([0, 2, 4]);
  });

  it('multiple conditions on same column (AND)', () => {
    engine.setColumnFilter(1, [
      { col: 1, operator: 'greaterThanOrEqual', value: 25 },
      { col: 1, operator: 'lessThanOrEqual', value: 30 },
    ]);
    expect(engine.computeVisibleRows()).toEqual([0, 1, 3, 4]);
  });

  it('conditions across columns (AND)', () => {
    engine.setColumnFilter(1, [{ col: 1, operator: 'equals', value: 30 }]);
    engine.setColumnFilter(2, [{ col: 2, operator: 'equals', value: 'Engineering' }]);
    expect(engine.computeVisibleRows()).toEqual([0]);
  });

  it('setColumnFilter replaces existing for that column', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    expect(engine.computeVisibleRows()).toEqual([0]);
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Bob' }]);
    expect(engine.computeVisibleRows()).toEqual([1]);
  });

  it('removeColumnFilter removes conditions for that column', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    engine.setColumnFilter(1, [{ col: 1, operator: 'greaterThan', value: 0 }]);
    engine.removeColumnFilter(0);
    // Only age > 0 remains → rows 0-4 (row 5 has null age)
    expect(engine.computeVisibleRows()).toEqual([0, 1, 2, 3, 4]);
  });

  it('clearAll removes all conditions', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    engine.clearAll();
    expect(engine.computeVisibleRows()).toBeNull();
    expect(engine.hasActiveFilters).toBe(false);
  });

  it('clearFilters alias works', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    engine.clearFilters();
    expect(engine.computeVisibleRows()).toBeNull();
  });

  it('isEmpty filters empty rows', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'isEmpty' }]);
    expect(engine.computeVisibleRows()).toEqual([5]);
  });

  it('isNotEmpty excludes empty rows', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'isNotEmpty' }]);
    expect(engine.computeVisibleRows()).toEqual([0, 1, 2, 3, 4]);
  });

  it('contains filter', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'contains', value: 'li' }]);
    // Alice, Charlie
    expect(engine.computeVisibleRows()).toEqual([0, 2]);
  });

  it('in filter with multiple values', () => {
    engine.setColumnFilter(2, [{ col: 2, operator: 'in', values: ['Engineering', 'Sales'] }]);
    expect(engine.computeVisibleRows()).toEqual([0, 2, 3]);
  });

  it('between filter inclusive', () => {
    engine.setColumnFilter(1, [{ col: 1, operator: 'between', value: 28, valueTo: 30 }]);
    expect(engine.computeVisibleRows()).toEqual([0, 3, 4]);
  });

  it('getVisibleRowCount returns correct count', () => {
    expect(engine.getVisibleRowCount()).toBe(6); // all rows
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    expect(engine.getVisibleRowCount()).toBe(1);
  });

  it('totalRowCount getter', () => {
    expect(engine.totalRowCount).toBe(6);
  });

  it('setTotalRowCount updates count', () => {
    engine.setTotalRowCount(10);
    expect(engine.totalRowCount).toBe(10);
  });

  it('setConditions replaces all conditions', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'Alice' }]);
    engine.setConditions([{ col: 1, operator: 'greaterThan', value: 30 }]);
    // Only age > 30 → Charlie (35)
    expect(engine.computeVisibleRows()).toEqual([2]);
  });

  it('notIn filter', () => {
    engine.setColumnFilter(2, [{ col: 2, operator: 'notIn', values: ['Engineering'] }]);
    // Marketing(1,4), Sales(3), null(5)
    expect(engine.computeVisibleRows()).toEqual([1, 3, 4, 5]);
  });

  it('startsWith filter', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'startsWith', value: 'ch' }]);
    expect(engine.computeVisibleRows()).toEqual([2]); // Charlie
  });

  it('endsWith filter', () => {
    engine.setColumnFilter(0, [{ col: 0, operator: 'endsWith', value: 'e' }]);
    // Alice, Charlie, Eve
    expect(engine.computeVisibleRows()).toEqual([0, 2, 4]);
  });
});
