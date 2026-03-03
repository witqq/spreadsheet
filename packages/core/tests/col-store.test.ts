import { describe, it, expect } from 'vitest';
import { ColStore } from '../src/model/col-store';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(count: number): ColumnDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: 100,
  }));
}

describe('ColStore', () => {
  describe('construction', () => {
    it('initializes with empty columns by default', () => {
      const store = new ColStore();
      expect(store.columnCount).toBe(0);
      expect(store.visibleColumnCount).toBe(0);
    });

    it('initializes with provided columns', () => {
      const cols = makeColumns(5);
      const store = new ColStore(cols);
      expect(store.columnCount).toBe(5);
      expect(store.visibleColumnCount).toBe(5);
    });

    it('does not share reference with input array', () => {
      const cols = makeColumns(3);
      const store = new ColStore(cols);
      cols.push({ key: 'extra', title: 'Extra', width: 100 });
      expect(store.columnCount).toBe(3);
    });
  });

  describe('getColumn', () => {
    it('returns column by index', () => {
      const store = new ColStore(makeColumns(3));
      expect(store.getColumn(0)?.key).toBe('col0');
      expect(store.getColumn(2)?.key).toBe('col2');
    });

    it('returns undefined for out-of-bounds index', () => {
      const store = new ColStore(makeColumns(3));
      expect(store.getColumn(5)).toBeUndefined();
      expect(store.getColumn(-1)).toBeUndefined();
    });
  });

  describe('getColumns', () => {
    it('returns all columns', () => {
      const cols = makeColumns(3);
      const store = new ColStore(cols);
      expect(store.getColumns()).toEqual(cols);
    });
  });

  describe('setColumns', () => {
    it('replaces columns and resets hidden set', () => {
      const store = new ColStore(makeColumns(3));
      store.hide(1);
      expect(store.hiddenCount).toBe(1);

      store.setColumns(makeColumns(5));
      expect(store.columnCount).toBe(5);
      expect(store.hiddenCount).toBe(0);
    });

    it('picks up hidden flag from column definitions', () => {
      const cols: ColumnDef[] = [
        { key: 'a', title: 'A', width: 100 },
        { key: 'b', title: 'B', width: 100, hidden: true },
        { key: 'c', title: 'C', width: 100 },
      ];
      const store = new ColStore();
      store.setColumns(cols);
      expect(store.isHidden(1)).toBe(true);
      expect(store.visibleColumnCount).toBe(2);
    });
  });

  describe('hidden columns', () => {
    it('hide makes column hidden', () => {
      const store = new ColStore(makeColumns(5));
      store.hide(2);
      expect(store.isHidden(2)).toBe(true);
      expect(store.visibleColumnCount).toBe(4);
      expect(store.hiddenCount).toBe(1);
    });

    it('show restores column visibility', () => {
      const store = new ColStore(makeColumns(5));
      store.hide(2);
      store.show(2);
      expect(store.isHidden(2)).toBe(false);
      expect(store.visibleColumnCount).toBe(5);
    });

    it('hide out-of-bounds index is a no-op', () => {
      const store = new ColStore(makeColumns(3));
      const v = store.version;
      store.hide(10);
      store.hide(-1);
      expect(store.version).toBe(v);
      expect(store.hiddenCount).toBe(0);
    });

    it('hide twice does not double-count', () => {
      const store = new ColStore(makeColumns(3));
      store.hide(1);
      const v = store.version;
      store.hide(1);
      expect(store.version).toBe(v);
      expect(store.hiddenCount).toBe(1);
    });

    it('show on visible column is a no-op', () => {
      const store = new ColStore(makeColumns(3));
      const v = store.version;
      store.show(0);
      expect(store.version).toBe(v);
    });
  });

  describe('visibleColumns', () => {
    it('yields all columns when none hidden', () => {
      const store = new ColStore(makeColumns(3));
      const visible = [...store.visibleColumns()];
      expect(visible).toHaveLength(3);
      expect(visible[0]).toEqual({ index: 0, column: store.getColumn(0) });
      expect(visible[2]).toEqual({ index: 2, column: store.getColumn(2) });
    });

    it('skips hidden columns', () => {
      const store = new ColStore(makeColumns(5));
      store.hide(1);
      store.hide(3);
      const visible = [...store.visibleColumns()];
      expect(visible).toHaveLength(3);
      expect(visible.map((v) => v.index)).toEqual([0, 2, 4]);
    });
  });

  describe('visibleColumnsInRange', () => {
    it('yields visible columns in range', () => {
      const store = new ColStore(makeColumns(10));
      store.hide(3);
      store.hide(5);
      const cols = [...store.visibleColumnsInRange(2, 6)];
      expect(cols).toEqual([2, 4, 6]);
    });

    it('clamps to column bounds', () => {
      const store = new ColStore(makeColumns(3));
      const cols = [...store.visibleColumnsInRange(-2, 10)];
      expect(cols).toEqual([0, 1, 2]);
    });

    it('returns empty for out-of-bounds range', () => {
      const store = new ColStore(makeColumns(3));
      const cols = [...store.visibleColumnsInRange(5, 10)];
      expect(cols).toEqual([]);
    });
  });

  describe('findByKey', () => {
    it('returns index of column by key', () => {
      const store = new ColStore(makeColumns(5));
      expect(store.findByKey('col2')).toBe(2);
    });

    it('returns -1 for unknown key', () => {
      const store = new ColStore(makeColumns(3));
      expect(store.findByKey('unknown')).toBe(-1);
    });
  });

  describe('clear', () => {
    it('removes all columns and hidden state', () => {
      const store = new ColStore(makeColumns(5));
      store.hide(1);
      store.clear();
      expect(store.columnCount).toBe(0);
      expect(store.hiddenCount).toBe(0);
    });
  });

  describe('version tracking', () => {
    it('starts at 0', () => {
      expect(new ColStore().version).toBe(0);
    });

    it('increments on setColumns', () => {
      const store = new ColStore();
      store.setColumns(makeColumns(3));
      expect(store.version).toBe(1);
    });

    it('increments on hide', () => {
      const store = new ColStore(makeColumns(3));
      store.hide(0);
      expect(store.version).toBe(1);
    });

    it('increments on show', () => {
      const store = new ColStore(makeColumns(3));
      store.hide(0);
      store.show(0);
      expect(store.version).toBe(2);
    });

    it('increments on clear', () => {
      const store = new ColStore(makeColumns(3));
      store.clear();
      expect(store.version).toBe(1);
    });
  });
});
