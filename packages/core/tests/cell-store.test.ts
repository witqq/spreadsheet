import { describe, it, expect } from 'vitest';
import { CellStore } from '../src/model/cell-store';
import type { CellData, CellRange } from '../src/types/interfaces';

describe('CellStore', () => {
  describe('empty store', () => {
    it('has size 0', () => {
      const store = new CellStore();
      expect(store.size).toBe(0);
    });

    it('returns undefined for any cell', () => {
      const store = new CellStore();
      expect(store.get(0, 0)).toBeUndefined();
      expect(store.get(999, 999)).toBeUndefined();
    });

    it('has returns false for any cell', () => {
      const store = new CellStore();
      expect(store.has(0, 0)).toBe(false);
    });

    it('delete returns false for non-existent cell', () => {
      const store = new CellStore();
      expect(store.delete(0, 0)).toBe(false);
    });

    it('iterateRange yields nothing', () => {
      const store = new CellStore();
      const range: CellRange = { startRow: 0, startCol: 0, endRow: 10, endCol: 10 };
      const cells = [...store.iterateRange(range)];
      expect(cells).toHaveLength(0);
    });

    it('clear on empty store does not change version', () => {
      const store = new CellStore();
      const v = store.version;
      store.clear();
      expect(store.version).toBe(v);
    });
  });

  describe('get/set/delete', () => {
    it('stores and retrieves a cell', () => {
      const store = new CellStore();
      const data: CellData = { value: 'hello' };
      store.set(0, 0, data);
      expect(store.get(0, 0)).toEqual(data);
      expect(store.has(0, 0)).toBe(true);
      expect(store.size).toBe(1);
    });

    it('overwrites existing cell', () => {
      const store = new CellStore();
      store.set(1, 2, { value: 'old' });
      store.set(1, 2, { value: 'new' });
      expect(store.get(1, 2)?.value).toBe('new');
      expect(store.size).toBe(1);
    });

    it('stores cells at different positions independently', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'A' });
      store.set(0, 1, { value: 'B' });
      store.set(1, 0, { value: 'C' });
      expect(store.get(0, 0)?.value).toBe('A');
      expect(store.get(0, 1)?.value).toBe('B');
      expect(store.get(1, 0)?.value).toBe('C');
      expect(store.size).toBe(3);
    });

    it('deletes a cell and returns true', () => {
      const store = new CellStore();
      store.set(5, 5, { value: 42 });
      expect(store.delete(5, 5)).toBe(true);
      expect(store.has(5, 5)).toBe(false);
      expect(store.size).toBe(0);
    });

    it('supports all CellValue types', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'string' });
      store.set(0, 1, { value: 42 });
      store.set(0, 2, { value: true });
      store.set(0, 3, { value: null });
      const date = new Date('2025-01-01');
      store.set(0, 4, { value: date });
      expect(store.get(0, 0)?.value).toBe('string');
      expect(store.get(0, 1)?.value).toBe(42);
      expect(store.get(0, 2)?.value).toBe(true);
      expect(store.get(0, 3)?.value).toBe(null);
      expect(store.get(0, 4)?.value).toBe(date);
    });

    it('stores CellData with metadata', () => {
      const store = new CellStore();
      const data: CellData = {
        value: 100,
        displayValue: '$100.00',
        type: 'number',
        metadata: { status: 'saved' },
      };
      store.set(3, 7, data);
      const retrieved = store.get(3, 7);
      expect(retrieved?.displayValue).toBe('$100.00');
      expect(retrieved?.type).toBe('number');
      expect(retrieved?.metadata?.status).toBe('saved');
    });
  });

  describe('setValue', () => {
    it('creates a new cell with just a value', () => {
      const store = new CellStore();
      store.setValue(0, 0, 'hello');
      expect(store.get(0, 0)?.value).toBe('hello');
    });

    it('preserves existing cell properties when updating value', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'old', type: 'string', displayValue: 'OLD' });
      store.setValue(0, 0, 'new');
      const cell = store.get(0, 0);
      expect(cell?.value).toBe('new');
      expect(cell?.type).toBe('string');
      expect(cell?.displayValue).toBe('OLD');
    });
  });

  describe('iterateRange', () => {
    it('yields only cells within range', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'A' });
      store.set(1, 1, { value: 'B' });
      store.set(5, 5, { value: 'outside' });

      const range: CellRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const cells = [...store.iterateRange(range)];
      expect(cells).toHaveLength(2);
      expect(cells[0]).toEqual({ row: 0, col: 0, data: { value: 'A' } });
      expect(cells[1]).toEqual({ row: 1, col: 1, data: { value: 'B' } });
    });

    it('handles sparse data correctly', () => {
      const store = new CellStore();
      // Only set cells at row 0 col 0 and row 100 col 50
      store.set(0, 0, { value: 'start' });
      store.set(100, 50, { value: 'far' });

      const range: CellRange = { startRow: 0, startCol: 0, endRow: 5, endCol: 5 };
      const cells = [...store.iterateRange(range)];
      expect(cells).toHaveLength(1);
      expect(cells[0].data.value).toBe('start');
    });

    it('includes cells at range boundaries', () => {
      const store = new CellStore();
      store.set(2, 3, { value: 'start' });
      store.set(5, 7, { value: 'end' });

      const range: CellRange = { startRow: 2, startCol: 3, endRow: 5, endCol: 7 };
      const cells = [...store.iterateRange(range)];
      expect(cells).toHaveLength(2);
    });

    it('yields cells in row-major order', () => {
      const store = new CellStore();
      store.set(1, 0, { value: 'R1C0' });
      store.set(0, 1, { value: 'R0C1' });
      store.set(0, 0, { value: 'R0C0' });
      store.set(1, 1, { value: 'R1C1' });

      const range: CellRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      const cells = [...store.iterateRange(range)];
      expect(cells.map((c) => c.data.value)).toEqual(['R0C0', 'R0C1', 'R1C0', 'R1C1']);
    });
  });

  describe('bulkLoad', () => {
    it('loads rows from array of records', () => {
      const store = new CellStore();
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const keys = ['name', 'age'];
      store.bulkLoad(rows, keys);

      expect(store.get(0, 0)?.value).toBe('Alice');
      expect(store.get(0, 1)?.value).toBe(30);
      expect(store.get(1, 0)?.value).toBe('Bob');
      expect(store.get(1, 1)?.value).toBe(25);
      expect(store.size).toBe(4);
    });

    it('skips null and undefined values', () => {
      const store = new CellStore();
      const rows = [{ a: 'yes', b: null, c: undefined }];
      store.bulkLoad(rows, ['a', 'b', 'c']);
      expect(store.size).toBe(1);
      expect(store.has(0, 0)).toBe(true);
      expect(store.has(0, 1)).toBe(false);
      expect(store.has(0, 2)).toBe(false);
    });
  });

  describe('bulkLoadCellData', () => {
    it('loads 2D array of CellData objects', () => {
      const store = new CellStore();
      const data: (CellData | null)[][] = [
        [{ value: 'Alice' }, { value: 30 }],
        [{ value: 'Bob' }, { value: 25 }],
      ];
      store.bulkLoadCellData(data);

      expect(store.get(0, 0)?.value).toBe('Alice');
      expect(store.get(0, 1)?.value).toBe(30);
      expect(store.get(1, 0)?.value).toBe('Bob');
      expect(store.get(1, 1)?.value).toBe(25);
      expect(store.size).toBe(4);
    });

    it('preserves all CellData fields (type, style, metadata, custom)', () => {
      const store = new CellStore();
      const cellWithAll: CellData = {
        value: 42,
        type: 'number',
        style: 1,
        metadata: { status: 'changed', comment: 'test' },
        custom: { tag: 'important', priority: 1 },
      };
      store.bulkLoadCellData([[cellWithAll]]);

      const stored = store.get(0, 0);
      expect(stored).toBeDefined();
      expect(stored!.value).toBe(42);
      expect(stored!.type).toBe('number');
      expect(stored!.style).toBe(1);
      expect(stored!.metadata?.status).toBe('changed');
      expect(stored!.metadata?.comment).toBe('test');
      expect(stored!.custom?.tag).toBe('important');
      expect(stored!.custom?.priority).toBe(1);
    });

    it('skips null and undefined entries (sparse data)', () => {
      const store = new CellStore();
      const data: (CellData | null | undefined)[][] = [
        [{ value: 'A' }, null, { value: 'C' }],
        [undefined, { value: 'E' }, undefined],
      ];
      store.bulkLoadCellData(data);

      expect(store.size).toBe(3);
      expect(store.get(0, 0)?.value).toBe('A');
      expect(store.has(0, 1)).toBe(false);
      expect(store.get(0, 2)?.value).toBe('C');
      expect(store.has(1, 0)).toBe(false);
      expect(store.get(1, 1)?.value).toBe('E');
      expect(store.has(1, 2)).toBe(false);
    });

    it('skips null rows', () => {
      const store = new CellStore();
      const data = [
        [{ value: 'row0' }],
        null as unknown as (CellData | null)[],
        [{ value: 'row2' }],
      ];
      store.bulkLoadCellData(data);

      expect(store.size).toBe(2);
      expect(store.get(0, 0)?.value).toBe('row0');
      expect(store.get(2, 0)?.value).toBe('row2');
    });

    it('supports startRow offset', () => {
      const store = new CellStore();
      store.bulkLoadCellData([[{ value: 'X' }, { value: 'Y' }]], 5);

      expect(store.has(0, 0)).toBe(false);
      expect(store.get(5, 0)?.value).toBe('X');
      expect(store.get(5, 1)?.value).toBe('Y');
    });

    it('handles mixed empty and populated cells', () => {
      const store = new CellStore();
      const data: (CellData | null)[][] = [
        [null, { value: 'only-second' }],
        [{ value: 'only-first' }, null],
      ];
      store.bulkLoadCellData(data);

      expect(store.size).toBe(2);
      expect(store.has(0, 0)).toBe(false);
      expect(store.get(0, 1)?.value).toBe('only-second');
      expect(store.get(1, 0)?.value).toBe('only-first');
      expect(store.has(1, 1)).toBe(false);
    });

    it('handles empty 2D array', () => {
      const store = new CellStore();
      store.bulkLoadCellData([]);
      expect(store.size).toBe(0);
      expect(store.version).toBe(1); // version still bumps
    });

    it('handles rows with different column counts', () => {
      const store = new CellStore();
      store.bulkLoadCellData([
        [{ value: 'A' }],
        [{ value: 'B' }, { value: 'C' }, { value: 'D' }],
        [{ value: 'E' }, { value: 'F' }],
      ]);

      expect(store.size).toBe(6);
      expect(store.get(1, 2)?.value).toBe('D');
    });

    it('stores cells with value null (explicit null value vs absent cell)', () => {
      const store = new CellStore();
      store.bulkLoadCellData([[{ value: null, type: 'string' }]]);

      expect(store.size).toBe(1);
      const cell = store.get(0, 0);
      expect(cell).toBeDefined();
      expect(cell!.value).toBeNull();
      expect(cell!.type).toBe('string');
    });

    it('single version bump for entire operation', () => {
      const store = new CellStore();
      store.bulkLoadCellData([
        [{ value: 1 }, { value: 2 }],
        [{ value: 3 }, { value: 4 }],
      ]);
      expect(store.version).toBe(1);
    });

    it('handles large dataset (10K+ cells)', () => {
      const store = new CellStore();
      const rows: CellData[][] = [];
      for (let r = 0; r < 100; r++) {
        const row: CellData[] = [];
        for (let c = 0; c < 100; c++) {
          row.push({ value: r * 100 + c });
        }
        rows.push(row);
      }
      store.bulkLoadCellData(rows);

      expect(store.size).toBe(10000);
      expect(store.get(0, 0)?.value).toBe(0);
      expect(store.get(99, 99)?.value).toBe(9999);
      expect(store.version).toBe(1);
    });
  });

  describe('version tracking', () => {
    it('starts at 0', () => {
      expect(new CellStore().version).toBe(0);
    });

    it('increments on set', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'a' });
      expect(store.version).toBe(1);
      store.set(0, 0, { value: 'b' });
      expect(store.version).toBe(2);
    });

    it('increments on delete', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'a' });
      store.delete(0, 0);
      expect(store.version).toBe(2);
    });

    it('does not increment on failed delete', () => {
      const store = new CellStore();
      store.delete(99, 99);
      expect(store.version).toBe(0);
    });

    it('increments on clear with data', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'a' });
      store.clear();
      expect(store.version).toBe(2);
    });

    it('increments on bulkLoad', () => {
      const store = new CellStore();
      store.bulkLoad([{ x: 1 }], ['x']);
      expect(store.version).toBe(1);
    });
  });

  describe('setMetadata', () => {
    it('sets metadata on existing cell', () => {
      const store = new CellStore();
      store.setValue(0, 0, 'hello');
      store.setMetadata(0, 0, { status: 'changed' });

      const cell = store.get(0, 0);
      expect(cell?.value).toBe('hello');
      expect(cell?.metadata?.status).toBe('changed');
    });

    it('creates cell with null value when cell does not exist', () => {
      const store = new CellStore();
      store.setMetadata(5, 5, { status: 'error', errorMessage: 'fail' });

      const cell = store.get(5, 5);
      expect(cell?.value).toBeNull();
      expect(cell?.metadata?.status).toBe('error');
      expect(cell?.metadata?.errorMessage).toBe('fail');
    });

    it('merges metadata with existing metadata', () => {
      const store = new CellStore();
      store.setValue(0, 0, 'val');
      store.setMetadata(0, 0, { status: 'changed' });
      store.setMetadata(0, 0, { errorMessage: 'oops' });

      const cell = store.get(0, 0);
      expect(cell?.metadata?.status).toBe('changed');
      expect(cell?.metadata?.errorMessage).toBe('oops');
    });
  });

  describe('clearMetadata', () => {
    it('removes metadata from cell', () => {
      const store = new CellStore();
      store.setValue(0, 0, 'hello');
      store.setMetadata(0, 0, { status: 'changed' });
      store.clearMetadata(0, 0);

      const cell = store.get(0, 0);
      expect(cell?.value).toBe('hello');
      expect(cell?.metadata).toBeUndefined();
    });

    it('does nothing when cell has no metadata', () => {
      const store = new CellStore();
      store.setValue(0, 0, 'hello');
      store.clearMetadata(0, 0);

      const cell = store.get(0, 0);
      expect(cell?.value).toBe('hello');
    });

    it('does nothing when cell does not exist', () => {
      const store = new CellStore();
      store.clearMetadata(5, 5); // should not throw
      expect(store.has(5, 5)).toBe(false);
    });
  });

  describe('custom data round-trip', () => {
    it('stores and retrieves custom data via set()', () => {
      const store = new CellStore();
      const data: CellData = {
        value: 'hello',
        custom: { priority: 'high', tags: ['a', 'b'] },
      };
      store.set(0, 0, data);
      const cell = store.get(0, 0);
      expect(cell?.custom).toEqual({ priority: 'high', tags: ['a', 'b'] });
    });

    it('preserves custom data through setValue()', () => {
      const store = new CellStore();
      store.set(0, 0, {
        value: 'old',
        custom: { color: 'red' },
      });
      store.setValue(0, 0, 'new');
      const cell = store.get(0, 0);
      expect(cell?.value).toBe('new');
      expect(cell?.custom).toEqual({ color: 'red' });
    });

    it('preserves custom data through setMetadata()', () => {
      const store = new CellStore();
      store.set(0, 0, {
        value: 42,
        custom: { source: 'api' },
      });
      store.setMetadata(0, 0, { status: 'changed' });
      const cell = store.get(0, 0);
      expect(cell?.value).toBe(42);
      expect(cell?.custom).toEqual({ source: 'api' });
      expect(cell?.metadata?.status).toBe('changed');
    });

    it('stores custom data alongside all other CellData fields', () => {
      const store = new CellStore();
      const data: CellData = {
        value: 100,
        displayValue: '$100',
        type: 'number',
        metadata: { status: 'saved' },
        custom: { departmentId: 5 },
      };
      store.set(1, 2, data);
      const cell = store.get(1, 2);
      expect(cell?.value).toBe(100);
      expect(cell?.displayValue).toBe('$100');
      expect(cell?.type).toBe('number');
      expect(cell?.metadata?.status).toBe('saved');
      expect(cell?.custom).toEqual({ departmentId: 5 });
    });

    it('custom field is optional and defaults to undefined', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'hello' });
      expect(store.get(0, 0)?.custom).toBeUndefined();
    });

    it('preserves custom through iterateRange', () => {
      const store = new CellStore();
      store.set(0, 0, { value: 'a', custom: { x: 1 } });
      store.set(1, 1, { value: 'b', custom: { x: 2 } });

      const range = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      const cells = [...store.iterateRange(range)];
      expect(cells[0].data.custom).toEqual({ x: 1 });
      expect(cells[1].data.custom).toEqual({ x: 2 });
    });

    it('preserves custom through entries()', () => {
      const store = new CellStore();
      store.set(3, 4, { value: 'test', custom: { flag: true } });
      const all = [...store.entries()];
      expect(all).toHaveLength(1);
      expect(all[0].data.custom).toEqual({ flag: true });
    });
  });
});
