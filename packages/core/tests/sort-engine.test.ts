import { describe, it, expect, beforeEach } from 'vitest';
import { SortEngine, compareCellValues } from '../src/sort/sort-engine';
import { CellStore } from '../src/model/cell-store';

function makeStore(data: Record<string, unknown>[], keys: string[]): CellStore {
  const store = new CellStore();
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < keys.length; c++) {
      const val = data[r][keys[c]];
      if (val !== undefined) store.set(r, c, { value: val as never });
    }
  }
  return store;
}

describe('SortEngine', () => {
  let cellStore: CellStore;
  let engine: SortEngine;

  beforeEach(() => {
    cellStore = makeStore(
      [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: 20 },
      ],
      ['name', 'age'],
    );
    engine = new SortEngine({ cellStore, totalRowCount: 4 });
  });

  describe('toggleColumn', () => {
    it('cycles none → asc → desc → none', () => {
      expect(engine.isClear()).toBe(true);

      engine.toggleColumn(0);
      expect(engine.sortColumns).toEqual([{ col: 0, direction: 'asc' }]);

      engine.toggleColumn(0);
      expect(engine.sortColumns).toEqual([{ col: 0, direction: 'desc' }]);

      engine.toggleColumn(0);
      expect(engine.isClear()).toBe(true);
    });

    it('single-column click replaces previous sort', () => {
      engine.toggleColumn(0); // col 0 asc
      engine.toggleColumn(1); // replaces with col 1 asc
      expect(engine.sortColumns).toEqual([{ col: 1, direction: 'asc' }]);
    });

    it('multi-column adds without replacing', () => {
      engine.toggleColumn(0);
      engine.toggleColumn(1, true);
      expect(engine.sortColumns).toEqual([
        { col: 0, direction: 'asc' },
        { col: 1, direction: 'asc' },
      ]);
    });

    it('multi-column cycles existing column direction', () => {
      engine.toggleColumn(0);
      engine.toggleColumn(1, true);
      engine.toggleColumn(0, true); // col 0: asc → desc
      expect(engine.sortColumns).toEqual([
        { col: 0, direction: 'desc' },
        { col: 1, direction: 'asc' },
      ]);
    });

    it('multi-column removes column on third toggle', () => {
      engine.toggleColumn(0);
      engine.toggleColumn(1, true);
      engine.toggleColumn(0, true); // asc → desc
      engine.toggleColumn(0, true); // desc → removed
      expect(engine.sortColumns).toEqual([{ col: 1, direction: 'asc' }]);
    });
  });

  describe('computeSortedIndices', () => {
    it('returns null when no sort active', () => {
      expect(engine.computeSortedIndices()).toBeNull();
    });

    it('sorts strings ascending', () => {
      engine.toggleColumn(0); // name asc
      const indices = engine.computeSortedIndices()!;
      // Alice(1), Alice(3), Bob(2), Charlie(0)
      expect(indices).toEqual([1, 3, 2, 0]);
    });

    it('sorts strings descending', () => {
      engine.toggleColumn(0);
      engine.toggleColumn(0); // name desc
      const indices = engine.computeSortedIndices()!;
      // Charlie(0), Bob(2), Alice(1), Alice(3) — stable: 1 before 3
      expect(indices).toEqual([0, 2, 1, 3]);
    });

    it('sorts numbers ascending', () => {
      engine.toggleColumn(1); // age asc
      const indices = engine.computeSortedIndices()!;
      // 20(3), 25(1), 30(0), 30(2) — stable: 0 before 2
      expect(indices).toEqual([3, 1, 0, 2]);
    });

    it('multi-column sort: name asc, age asc', () => {
      engine.toggleColumn(0); // name asc
      engine.toggleColumn(1, true); // age asc
      const indices = engine.computeSortedIndices()!;
      // Alice 20(3), Alice 25(1), Bob 30(2), Charlie 30(0)
      expect(indices).toEqual([3, 1, 2, 0]);
    });

    it('multi-column sort: name asc, age desc', () => {
      engine.toggleColumn(0); // name asc
      engine.toggleColumn(1, true); // age asc
      engine.toggleColumn(1, true); // age desc
      const indices = engine.computeSortedIndices()!;
      // Alice 25(1), Alice 20(3), Bob 30(2), Charlie 30(0)
      expect(indices).toEqual([1, 3, 2, 0]);
    });

    it('sorts a filtered subset', () => {
      engine.toggleColumn(1); // age asc
      // Only include rows 0, 2 (Charlie 30, Bob 30)
      const indices = engine.computeSortedIndices([0, 2])!;
      // Both age 30, stable order: 0, 2
      expect(indices).toEqual([0, 2]);
    });
  });

  describe('setSortColumns / clearSort', () => {
    it('sets sort programmatically', () => {
      engine.setSortColumns([{ col: 1, direction: 'desc' }]);
      expect(engine.sortColumns).toEqual([{ col: 1, direction: 'desc' }]);
      const indices = engine.computeSortedIndices()!;
      // 30(0), 30(2), 25(1), 20(3)
      expect(indices).toEqual([0, 2, 1, 3]);
    });

    it('clears sort', () => {
      engine.toggleColumn(0);
      engine.clearSort();
      expect(engine.isClear()).toBe(true);
      expect(engine.computeSortedIndices()).toBeNull();
    });
  });

  describe('null handling', () => {
    it('sorts nulls last in ascending order', () => {
      const store = makeStore(
        [{ val: 'B' }, { val: null }, { val: 'A' }],
        ['val'],
      );
      const eng = new SortEngine({ cellStore: store, totalRowCount: 3 });
      eng.toggleColumn(0); // asc
      expect(eng.computeSortedIndices()).toEqual([2, 0, 1]);
    });

    it('sorts nulls last in descending order', () => {
      const store = makeStore(
        [{ val: 'B' }, { val: null }, { val: 'A' }],
        ['val'],
      );
      const eng = new SortEngine({ cellStore: store, totalRowCount: 3 });
      eng.toggleColumn(0);
      eng.toggleColumn(0); // desc
      expect(eng.computeSortedIndices()).toEqual([0, 2, 1]);
    });
  });
});

describe('compareCellValues', () => {
  it('equal values return 0', () => {
    expect(compareCellValues(5, 5)).toBe(0);
    expect(compareCellValues('a', 'a')).toBe(0);
    expect(compareCellValues(null, null)).toBe(0);
  });

  it('null sorts after non-null', () => {
    expect(compareCellValues(null, 5)).toBe(1);
    expect(compareCellValues(5, null)).toBe(-1);
  });

  it('compares numbers correctly', () => {
    expect(compareCellValues(1, 2)).toBeLessThan(0);
    expect(compareCellValues(10, 3)).toBeGreaterThan(0);
  });

  it('compares strings with locale', () => {
    expect(compareCellValues('apple', 'banana')).toBeLessThan(0);
    expect(compareCellValues('z', 'a')).toBeGreaterThan(0);
  });

  it('compares booleans', () => {
    expect(compareCellValues(true, false)).toBeLessThan(0);
    expect(compareCellValues(false, true)).toBeGreaterThan(0);
    expect(compareCellValues(true, true)).toBe(0);
  });

  it('compares dates', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-06-01');
    expect(compareCellValues(d1, d2)).toBeLessThan(0);
    expect(compareCellValues(d2, d1)).toBeGreaterThan(0);
  });

  it('cross-type: number < boolean < string', () => {
    expect(compareCellValues(1, true)).toBeLessThan(0);
    expect(compareCellValues(true, 'a')).toBeLessThan(0);
    expect(compareCellValues(1, 'a')).toBeLessThan(0);
  });
});
