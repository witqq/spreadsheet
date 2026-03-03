import { describe, it, expect } from 'vitest';
import { RowStore } from '../src/model/row-store';

describe('RowStore', () => {
  describe('empty store', () => {
    it('has zero overrides and hidden rows', () => {
      const store = new RowStore();
      expect(store.overrideCount).toBe(0);
      expect(store.hiddenCount).toBe(0);
    });

    it('returns default height for any row', () => {
      const store = new RowStore();
      expect(store.getHeight(0, 32)).toBe(32);
      expect(store.getHeight(999, 40)).toBe(40);
    });

    it('no rows are hidden', () => {
      const store = new RowStore();
      expect(store.isHidden(0)).toBe(false);
      expect(store.isHidden(999)).toBe(false);
    });
  });

  describe('height overrides', () => {
    it('stores and retrieves height override', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      expect(store.getHeight(5, 32)).toBe(60);
      expect(store.overrideCount).toBe(1);
    });

    it('non-overridden rows use default', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      expect(store.getHeight(4, 32)).toBe(32);
      expect(store.getHeight(6, 32)).toBe(32);
    });

    it('overwrites existing height override', () => {
      const store = new RowStore();
      store.setHeight(3, 50);
      store.setHeight(3, 80);
      expect(store.getHeight(3, 32)).toBe(80);
      expect(store.overrideCount).toBe(1);
    });

    it('clearHeight removes override', () => {
      const store = new RowStore();
      store.setHeight(3, 50);
      store.clearHeight(3);
      expect(store.getHeight(3, 32)).toBe(32);
      expect(store.overrideCount).toBe(0);
    });

    it('clearHeight on non-existing row is a no-op', () => {
      const store = new RowStore();
      const v = store.version;
      store.clearHeight(99);
      expect(store.version).toBe(v);
    });
  });

  describe('hidden rows', () => {
    it('hidden row returns height 0', () => {
      const store = new RowStore();
      store.hide(2);
      expect(store.getHeight(2, 32)).toBe(0);
      expect(store.isHidden(2)).toBe(true);
      expect(store.hiddenCount).toBe(1);
    });

    it('hidden row returns 0 even with height override', () => {
      const store = new RowStore();
      store.setHeight(2, 60);
      store.hide(2);
      expect(store.getHeight(2, 32)).toBe(0);
    });

    it('show restores row visibility', () => {
      const store = new RowStore();
      store.hide(2);
      store.show(2);
      expect(store.isHidden(2)).toBe(false);
      expect(store.getHeight(2, 32)).toBe(32);
      expect(store.hiddenCount).toBe(0);
    });

    it('show on visible row is a no-op', () => {
      const store = new RowStore();
      const v = store.version;
      store.show(5);
      expect(store.version).toBe(v);
    });

    it('hide twice does not double-count', () => {
      const store = new RowStore();
      store.hide(1);
      const v = store.version;
      store.hide(1);
      expect(store.hiddenCount).toBe(1);
      expect(store.version).toBe(v);
    });
  });

  describe('visibleRowsInRange', () => {
    it('yields all rows when none hidden', () => {
      const store = new RowStore();
      const rows = [...store.visibleRowsInRange(0, 4)];
      expect(rows).toEqual([0, 1, 2, 3, 4]);
    });

    it('skips hidden rows', () => {
      const store = new RowStore();
      store.hide(1);
      store.hide(3);
      const rows = [...store.visibleRowsInRange(0, 4)];
      expect(rows).toEqual([0, 2, 4]);
    });

    it('returns empty for fully hidden range', () => {
      const store = new RowStore();
      store.hide(0);
      store.hide(1);
      store.hide(2);
      const rows = [...store.visibleRowsInRange(0, 2)];
      expect(rows).toEqual([]);
    });
  });

  describe('clear', () => {
    it('removes all overrides and hidden rows', () => {
      const store = new RowStore();
      store.setHeight(0, 50);
      store.setHeight(1, 60);
      store.hide(2);
      store.clear();
      expect(store.overrideCount).toBe(0);
      expect(store.hiddenCount).toBe(0);
      expect(store.getHeight(0, 32)).toBe(32);
      expect(store.isHidden(2)).toBe(false);
    });

    it('clear on empty store does not change version', () => {
      const store = new RowStore();
      const v = store.version;
      store.clear();
      expect(store.version).toBe(v);
    });
  });

  describe('version tracking', () => {
    it('starts at 0', () => {
      expect(new RowStore().version).toBe(0);
    });

    it('increments on setHeight', () => {
      const store = new RowStore();
      store.setHeight(0, 50);
      expect(store.version).toBe(1);
    });

    it('increments on hide', () => {
      const store = new RowStore();
      store.hide(0);
      expect(store.version).toBe(1);
    });

    it('increments on show', () => {
      const store = new RowStore();
      store.hide(0);
      store.show(0);
      expect(store.version).toBe(2);
    });

    it('increments on clearHeight', () => {
      const store = new RowStore();
      store.setHeight(0, 50);
      store.clearHeight(0);
      expect(store.version).toBe(2);
    });
  });

  describe('shiftRowsUp', () => {
    it('shifts height overrides above deleted row down by 1', () => {
      const store = new RowStore();
      store.setHeight(2, 40);
      store.setHeight(5, 60);
      store.setHeight(8, 80);

      store.shiftRowsUp(3);

      // Row 2 stays (below deleted), row 5→4, row 8→7
      expect(store.getHeight(2, 30)).toBe(40);
      expect(store.getHeight(4, 30)).toBe(60);
      expect(store.getHeight(7, 30)).toBe(80);
      // Original positions cleared
      expect(store.getHeight(5, 30)).toBe(30);
      expect(store.getHeight(8, 30)).toBe(30);
    });

    it('removes height override at deleted row', () => {
      const store = new RowStore();
      store.setHeight(3, 50);
      store.setHeight(5, 70);

      store.shiftRowsUp(3);

      // Row 3 override dropped, row 5→4
      expect(store.getHeight(3, 30)).toBe(30);
      expect(store.getHeight(4, 30)).toBe(70);
      expect(store.overrideCount).toBe(1);
    });

    it('shifts hidden rows above deleted row down by 1', () => {
      const store = new RowStore();
      store.hide(1);
      store.hide(4);
      store.hide(7);

      store.shiftRowsUp(2);

      // Row 1 stays, row 4→3, row 7→6
      expect(store.isHidden(1)).toBe(true);
      expect(store.isHidden(3)).toBe(true);
      expect(store.isHidden(6)).toBe(true);
      expect(store.isHidden(4)).toBe(false);
      expect(store.isHidden(7)).toBe(false);
    });

    it('handles empty store without error', () => {
      const store = new RowStore();
      store.shiftRowsUp(5);
      expect(store.overrideCount).toBe(0);
      expect(store.hiddenCount).toBe(0);
    });

    it('increments version when data exists', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      const v = store.version;
      store.shiftRowsUp(3);
      expect(store.version).toBeGreaterThan(v);
    });
  });
});
