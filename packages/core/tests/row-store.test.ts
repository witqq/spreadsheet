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

  describe('height overrides (manual)', () => {
    it('stores and retrieves height override', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      expect(store.getHeight(5, 32)).toBe(60);
      expect(store.overrideCount).toBe(1);
      expect(store.manualOverrideCount).toBe(1);
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

    it('isManual returns true for manual overrides', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      expect(store.isManual(5)).toBe(true);
      expect(store.isManual(6)).toBe(false);
    });
  });

  describe('auto height overrides', () => {
    it('stores and retrieves auto height', () => {
      const store = new RowStore();
      store.setAutoHeight(5, 48);
      expect(store.getHeight(5, 32)).toBe(48);
      expect(store.autoOverrideCount).toBe(1);
      expect(store.isAuto(5)).toBe(true);
    });

    it('manual override takes priority over auto', () => {
      const store = new RowStore();
      store.setAutoHeight(5, 48);
      store.setHeight(5, 60);
      expect(store.getHeight(5, 32)).toBe(60);
    });

    it('manual wins even if set before auto', () => {
      const store = new RowStore();
      store.setHeight(5, 60);
      store.setAutoHeight(5, 48);
      expect(store.getHeight(5, 32)).toBe(60);
    });

    it('clearing manual reveals auto height', () => {
      const store = new RowStore();
      store.setAutoHeight(5, 48);
      store.setHeight(5, 60);
      expect(store.getHeight(5, 32)).toBe(60);
      store.clearHeight(5);
      expect(store.getHeight(5, 32)).toBe(48);
    });

    it('clearAutoHeight removes auto override', () => {
      const store = new RowStore();
      store.setAutoHeight(5, 48);
      store.clearAutoHeight(5);
      expect(store.getHeight(5, 32)).toBe(32);
      expect(store.autoOverrideCount).toBe(0);
    });

    it('clearAllAutoHeights removes all auto overrides', () => {
      const store = new RowStore();
      store.setAutoHeight(1, 40);
      store.setAutoHeight(2, 50);
      store.setAutoHeight(3, 60);
      store.clearAllAutoHeights();
      expect(store.autoOverrideCount).toBe(0);
      expect(store.getHeight(1, 32)).toBe(32);
      expect(store.getHeight(2, 32)).toBe(32);
    });

    it('clearAllAutoHeights is no-op on empty', () => {
      const store = new RowStore();
      const v = store.version;
      store.clearAllAutoHeights();
      expect(store.version).toBe(v);
    });

    it('hidden row returns 0 even with auto override', () => {
      const store = new RowStore();
      store.setAutoHeight(2, 48);
      store.hide(2);
      expect(store.getHeight(2, 32)).toBe(0);
    });

    it('overrideCount includes both manual and auto', () => {
      const store = new RowStore();
      store.setHeight(1, 40);
      store.setAutoHeight(2, 50);
      expect(store.overrideCount).toBe(2);
      expect(store.manualOverrideCount).toBe(1);
      expect(store.autoOverrideCount).toBe(1);
    });
  });

  describe('setAutoHeightsBatch', () => {
    it('sets multiple auto heights in one call', () => {
      const store = new RowStore();
      const updates = new Map([
        [0, 40],
        [1, 50],
        [2, 60],
      ]);
      const changed = store.setAutoHeightsBatch(updates, 32);
      expect(changed.size).toBe(3);
      expect(store.getHeight(0, 32)).toBe(40);
      expect(store.getHeight(1, 32)).toBe(50);
      expect(store.getHeight(2, 32)).toBe(60);
    });

    it('skips rows with manual overrides', () => {
      const store = new RowStore();
      store.setHeight(1, 70);
      const updates = new Map([
        [0, 40],
        [1, 50],
        [2, 60],
      ]);
      const changed = store.setAutoHeightsBatch(updates, 32);
      expect(changed.has(1)).toBe(false);
      expect(store.getHeight(1, 32)).toBe(70); // manual wins
      expect(changed.has(0)).toBe(true);
      expect(changed.has(2)).toBe(true);
    });

    it('only reports changed rows', () => {
      const store = new RowStore();
      store.setAutoHeight(0, 40);
      const updates = new Map([
        [0, 40], // same as existing — not changed
        [1, 50], // new — changed
      ]);
      const changed = store.setAutoHeightsBatch(updates, 32);
      expect(changed.has(0)).toBe(false);
      expect(changed.has(1)).toBe(true);
    });

    it('detects change from default height', () => {
      const store = new RowStore();
      const updates = new Map([[5, 32]]); // same as default
      const changed = store.setAutoHeightsBatch(updates, 32);
      expect(changed.size).toBe(0);
    });

    it('increments version only once for batch', () => {
      const store = new RowStore();
      const v = store.version;
      const updates = new Map([
        [0, 40],
        [1, 50],
        [2, 60],
      ]);
      store.setAutoHeightsBatch(updates, 32);
      expect(store.version).toBe(v + 1);
    });

    it('does not increment version when nothing changes', () => {
      const store = new RowStore();
      const v = store.version;
      const updates = new Map([[0, 32]]); // same as default
      store.setAutoHeightsBatch(updates, 32);
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
      store.setAutoHeight(1, 60);
      store.hide(2);
      store.clear();
      expect(store.overrideCount).toBe(0);
      expect(store.manualOverrideCount).toBe(0);
      expect(store.autoOverrideCount).toBe(0);
      expect(store.hiddenCount).toBe(0);
      expect(store.getHeight(0, 32)).toBe(32);
      expect(store.getHeight(1, 32)).toBe(32);
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

    it('increments on setAutoHeight', () => {
      const store = new RowStore();
      store.setAutoHeight(0, 50);
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

    it('increments on clearAutoHeight', () => {
      const store = new RowStore();
      store.setAutoHeight(0, 50);
      store.clearAutoHeight(0);
      expect(store.version).toBe(2);
    });
  });

  describe('shiftRowsUp', () => {
    it('shifts manual height overrides above deleted row down by 1', () => {
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

    it('shifts auto height overrides above deleted row down by 1', () => {
      const store = new RowStore();
      store.setAutoHeight(2, 40);
      store.setAutoHeight(5, 60);

      store.shiftRowsUp(3);

      expect(store.getHeight(2, 30)).toBe(40);
      expect(store.getHeight(4, 30)).toBe(60);
      expect(store.getHeight(5, 30)).toBe(30);
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

  describe('height priority resolution', () => {
    it('resolves: hidden > manual > auto > default', () => {
      const store = new RowStore();
      // Default
      expect(store.getHeight(0, 28)).toBe(28);
      // Auto
      store.setAutoHeight(0, 48);
      expect(store.getHeight(0, 28)).toBe(48);
      // Manual wins over auto
      store.setHeight(0, 60);
      expect(store.getHeight(0, 28)).toBe(60);
      // Hidden wins over everything
      store.hide(0);
      expect(store.getHeight(0, 28)).toBe(0);
    });
  });
});
