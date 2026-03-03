import { describe, it, expect } from 'vitest';
import { DirtyTracker } from '../src/renderer/dirty-tracker';

describe('DirtyTracker', () => {
  it('starts clean', () => {
    const tracker = new DirtyTracker();
    expect(tracker.isDirty()).toBe(false);
  });

  it('markDirty makes tracker dirty', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    expect(tracker.isDirty()).toBe(true);
  });

  it('tracks multiple regions independently', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.markDirty('viewport-change');

    expect(tracker.isRegionDirty('full')).toBe(true);
    expect(tracker.isRegionDirty('viewport-change')).toBe(true);
    expect(tracker.isRegionDirty('cell-update')).toBe(false);
  });

  it('deduplicates same region', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.markDirty('full');
    tracker.markDirty('full');

    const flushed = tracker.flush();
    expect(flushed.size).toBe(1);
    expect(flushed.has('full')).toBe(true);
  });

  it('flush returns dirty regions and clears state', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.markDirty('cell-update');

    const flushed = tracker.flush();
    expect(flushed.size).toBe(2);
    expect(flushed.has('full')).toBe(true);
    expect(flushed.has('cell-update')).toBe(true);

    // After flush, tracker is clean
    expect(tracker.isDirty()).toBe(false);
    expect(tracker.isRegionDirty('full')).toBe(false);
  });

  it('flush returns empty set when clean', () => {
    const tracker = new DirtyTracker();
    const flushed = tracker.flush();
    expect(flushed.size).toBe(0);
  });

  it('clear removes all dirty flags', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.markDirty('viewport-change');
    tracker.markDirty('cell-update');

    tracker.clear();
    expect(tracker.isDirty()).toBe(false);
    expect(tracker.isRegionDirty('full')).toBe(false);
    expect(tracker.isRegionDirty('viewport-change')).toBe(false);
    expect(tracker.isRegionDirty('cell-update')).toBe(false);
  });

  it('can mark dirty again after flush', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.flush();

    tracker.markDirty('viewport-change');
    expect(tracker.isDirty()).toBe(true);
    expect(tracker.isRegionDirty('viewport-change')).toBe(true);
    expect(tracker.isRegionDirty('full')).toBe(false);
  });

  it('can mark dirty again after clear', () => {
    const tracker = new DirtyTracker();
    tracker.markDirty('full');
    tracker.clear();

    tracker.markDirty('cell-update');
    expect(tracker.isDirty()).toBe(true);
    expect(tracker.isRegionDirty('cell-update')).toBe(true);
  });

  // Cell-level dirty tracking tests
  describe('markCellDirty', () => {
    it('stores dirty cell and sets cell-update region', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(5, 3);

      expect(tracker.isRegionDirty('cell-update')).toBe(true);
      const cells = tracker.flushCells();
      expect(cells).toEqual([{ row: 5, col: 3 }]);
    });

    it('stores multiple dirty cells', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(0, 0);
      tracker.markCellDirty(1, 2);
      tracker.markCellDirty(3, 4);

      const cells = tracker.flushCells();
      expect(cells).toHaveLength(3);
      expect(cells).toContainEqual({ row: 0, col: 0 });
      expect(cells).toContainEqual({ row: 1, col: 2 });
      expect(cells).toContainEqual({ row: 3, col: 4 });
    });

    it('deduplicates same cell', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(2, 3);
      tracker.markCellDirty(2, 3);
      tracker.markCellDirty(2, 3);

      const cells = tracker.flushCells();
      expect(cells).toHaveLength(1);
      expect(cells).toEqual([{ row: 2, col: 3 }]);
    });
  });

  describe('flushCells', () => {
    it('returns null when full is also dirty', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(1, 1);
      tracker.markDirty('full');

      expect(tracker.flushCells()).toBeNull();
    });

    it('returns null when viewport-change is also dirty', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(1, 1);
      tracker.markDirty('viewport-change');

      expect(tracker.flushCells()).toBeNull();
    });

    it('returns null when no cells recorded', () => {
      const tracker = new DirtyTracker();
      expect(tracker.flushCells()).toBeNull();
    });

    it('returns null when MAX_DIRTY_CELLS exceeded', () => {
      const tracker = new DirtyTracker();
      for (let i = 0; i < 51; i++) {
        tracker.markCellDirty(i, 0);
      }
      expect(tracker.flushCells()).toBeNull();
    });

    it('clears cell list after flush', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(1, 1);
      tracker.flushCells();

      // Second flush returns null (no cells)
      expect(tracker.flushCells()).toBeNull();
    });

    it('returns cells when only cell-update is dirty', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(5, 10);

      const cells = tracker.flushCells();
      expect(cells).toEqual([{ row: 5, col: 10 }]);
    });
  });

  describe('clear with cells', () => {
    it('clears dirty cells along with regions', () => {
      const tracker = new DirtyTracker();
      tracker.markCellDirty(1, 1);
      tracker.markCellDirty(2, 2);
      tracker.clear();

      expect(tracker.isDirty()).toBe(false);
      expect(tracker.flushCells()).toBeNull();
    });
  });
});
