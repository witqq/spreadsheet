import { describe, it, expect } from 'vitest';
import { MergeManager } from '../src/merge/merge-manager';

describe('MergeManager', () => {
  describe('merge', () => {
    it('creates region and updates spatial index', () => {
      const mm = new MergeManager();
      const ok = mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      expect(ok).toBe(true);
      expect(mm.getAllRegions()).toHaveLength(1);
      expect(mm.getMergedRegion(0, 0)).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      expect(mm.getMergedRegion(1, 1)).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    });

    it('rejects single-cell merge (min 2 cells)', () => {
      const mm = new MergeManager();
      const ok = mm.merge({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      expect(ok).toBe(false);
      expect(mm.getAllRegions()).toHaveLength(0);
    });

    it('rejects overlapping merge', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      const ok = mm.merge({ startRow: 1, startCol: 1, endRow: 2, endCol: 2 });
      expect(ok).toBe(false);
      expect(mm.getAllRegions()).toHaveLength(1);
    });

    it('rejects inverted coordinates', () => {
      const mm = new MergeManager();
      expect(mm.merge({ startRow: 5, startCol: 5, endRow: 2, endCol: 2 })).toBe(false);
      expect(mm.merge({ startRow: 0, startCol: 3, endRow: 2, endCol: 1 })).toBe(false);
      expect(mm.getAllRegions()).toHaveLength(0);
    });
  });

  describe('getMergedRegion', () => {
    it('returns correct region for any cell in merged area', () => {
      const mm = new MergeManager();
      const region = { startRow: 2, startCol: 3, endRow: 4, endCol: 5 };
      mm.merge(region);

      for (let r = 2; r <= 4; r++) {
        for (let c = 3; c <= 5; c++) {
          expect(mm.getMergedRegion(r, c)).toEqual(region);
        }
      }
    });

    it('returns null for cell outside any merged region', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      expect(mm.getMergedRegion(5, 5)).toBeNull();
    });
  });

  describe('isAnchorCell', () => {
    it('returns true only for top-left cell', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 1, startCol: 2, endRow: 3, endCol: 4 });

      expect(mm.isAnchorCell(1, 2)).toBe(true);
      expect(mm.isAnchorCell(1, 3)).toBe(false);
      expect(mm.isAnchorCell(2, 2)).toBe(false);
      expect(mm.isAnchorCell(3, 4)).toBe(false);
    });
  });

  describe('isHiddenCell', () => {
    it('returns true for non-anchor cells in merged area', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 2 });

      // Anchor is not hidden
      expect(mm.isHiddenCell(0, 0)).toBe(false);
      // All other cells in region are hidden
      expect(mm.isHiddenCell(0, 1)).toBe(true);
      expect(mm.isHiddenCell(0, 2)).toBe(true);
      expect(mm.isHiddenCell(1, 0)).toBe(true);
      expect(mm.isHiddenCell(1, 1)).toBe(true);
      expect(mm.isHiddenCell(1, 2)).toBe(true);
    });

    it('returns false for cell outside any merged region', () => {
      const mm = new MergeManager();
      expect(mm.isHiddenCell(0, 0)).toBe(false);
    });
  });

  describe('unmerge', () => {
    it('removes region and clears spatial index', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      const ok = mm.unmerge(0, 0);
      expect(ok).toBe(true);
      expect(mm.getAllRegions()).toHaveLength(0);
      expect(mm.getMergedRegion(0, 0)).toBeNull();
      expect(mm.getMergedRegion(1, 1)).toBeNull();
    });

    it('returns false for non-merged cell', () => {
      const mm = new MergeManager();
      expect(mm.unmerge(5, 5)).toBe(false);
    });
  });

  describe('getAllRegions', () => {
    it('returns all active regions', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      mm.merge({ startRow: 5, startCol: 5, endRow: 6, endCol: 6 });
      expect(mm.getAllRegions()).toHaveLength(2);
    });
  });

  describe('validateMerge', () => {
    it('rejects cross-boundary merge for frozen rows', () => {
      const mm = new MergeManager();
      const error = mm.validateMerge(
        { startRow: 1, startCol: 0, endRow: 3, endCol: 1 },
        2, 0,
      );
      expect(error).toBe('Merge region cannot cross frozen row boundary');
    });

    it('rejects cross-boundary merge for frozen cols', () => {
      const mm = new MergeManager();
      const error = mm.validateMerge(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 2 },
        0, 2,
      );
      expect(error).toBe('Merge region cannot cross frozen column boundary');
    });

    it('allows merge entirely within frozen area', () => {
      const mm = new MergeManager();
      const error = mm.validateMerge(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
        3, 3,
      );
      expect(error).toBeNull();
    });

    it('allows merge entirely outside frozen area', () => {
      const mm = new MergeManager();
      const error = mm.validateMerge(
        { startRow: 5, startCol: 5, endRow: 6, endCol: 6 },
        2, 2,
      );
      expect(error).toBeNull();
    });

    it('rejects single-cell merge', () => {
      const mm = new MergeManager();
      const error = mm.validateMerge(
        { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        0, 0,
      );
      expect(error).toBe('Merge region must contain at least 2 cells');
    });

    it('rejects overlapping merge', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
      const error = mm.validateMerge(
        { startRow: 1, startCol: 1, endRow: 3, endCol: 3 },
        0, 0,
      );
      expect(error).toBe('Merge region overlaps with an existing merged region');
    });
  });

  describe('validate-then-merge flow (SpreadsheetEngine pattern)', () => {
    it('frozen boundary rejection prevents merge', () => {
      const mm = new MergeManager();
      const region = { startRow: 1, startCol: 0, endRow: 3, endCol: 1 };
      const frozenRows = 2;
      const frozenCols = 0;

      const error = mm.validateMerge(region, frozenRows, frozenCols);
      expect(error).toBe('Merge region cannot cross frozen row boundary');

      // Simulate SpreadsheetEngine: don't call merge if validation fails
      if (error) {
        expect(mm.getAllRegions()).toHaveLength(0);
        return;
      }
      mm.merge(region);
    });

    it('valid merge after validation succeeds', () => {
      const mm = new MergeManager();
      const region = { startRow: 3, startCol: 3, endRow: 4, endCol: 4 };
      const error = mm.validateMerge(region, 2, 2);
      expect(error).toBeNull();

      const ok = mm.merge(region);
      expect(ok).toBe(true);
      expect(mm.getAllRegions()).toHaveLength(1);
    });
  });

  describe('hasAnyRegions', () => {
    it('returns false when no regions exist', () => {
      const mm = new MergeManager();
      expect(mm.hasAnyRegions()).toBe(false);
    });

    it('returns true after merging', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      expect(mm.hasAnyRegions()).toBe(true);
    });

    it('returns false after unmerging all regions', () => {
      const mm = new MergeManager();
      mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      mm.unmerge(0, 0);
      expect(mm.hasAnyRegions()).toBe(false);
    });
  });
});
