import { describe, it, expect, vi } from 'vitest';
import { SelectionManager } from '../src/selection/selection-manager';
import { MergeManager } from '../src/merge/merge-manager';

function createManager(opts?: { rowCount?: number; colCount?: number; onChange?: () => void }) {
  return new SelectionManager({
    rowCount: opts?.rowCount ?? 100,
    colCount: opts?.colCount ?? 5,
    onChange: opts?.onChange,
  });
}

describe('SelectionManager', () => {
  describe('selectCell (plain click)', () => {
    it('selects a single cell', () => {
      const sm = createManager();
      sm.selectCell(3, 2);

      const sel = sm.getSelection();
      expect(sel.type).toBe('cell');
      expect(sel.activeCell).toEqual({ row: 3, col: 2 });
      expect(sel.anchorCell).toEqual({ row: 3, col: 2 });
      expect(sel.ranges).toEqual([{ startRow: 3, startCol: 2, endRow: 3, endCol: 2 }]);
    });

    it('replaces previous selection', () => {
      const sm = createManager();
      sm.selectCell(0, 0);
      sm.selectCell(5, 3);

      const sel = sm.getSelection();
      expect(sel.ranges).toHaveLength(1);
      expect(sel.activeCell).toEqual({ row: 5, col: 3 });
    });

    it('clamps row and col to bounds', () => {
      const sm = createManager({ rowCount: 10, colCount: 3 });
      sm.selectCell(100, 50);

      const sel = sm.getSelection();
      expect(sel.activeCell).toEqual({ row: 9, col: 2 });
    });

    it('clamps negative values to 0', () => {
      const sm = createManager();
      sm.selectCell(-5, -10);

      const sel = sm.getSelection();
      expect(sel.activeCell).toEqual({ row: 0, col: 0 });
    });
  });

  describe('extendSelection (Shift+click)', () => {
    it('extends selection from anchor to clicked cell', () => {
      const sm = createManager();
      sm.selectCell(2, 1); // anchor at (2,1)
      sm.extendSelection(5, 3);

      const sel = sm.getSelection();
      expect(sel.type).toBe('range');
      expect(sel.activeCell).toEqual({ row: 5, col: 3 });
      expect(sel.anchorCell).toEqual({ row: 2, col: 1 }); // anchor unchanged
      expect(sel.ranges).toEqual([{ startRow: 2, startCol: 1, endRow: 5, endCol: 3 }]);
    });

    it('normalizes range when extending upward/left', () => {
      const sm = createManager();
      sm.selectCell(5, 3); // anchor at (5,3)
      sm.extendSelection(2, 1);

      const sel = sm.getSelection();
      expect(sel.ranges).toEqual([{ startRow: 2, startCol: 1, endRow: 5, endCol: 3 }]);
    });

    it('replaces last range on successive extends', () => {
      const sm = createManager();
      sm.selectCell(2, 1);
      sm.extendSelection(5, 3);
      sm.extendSelection(7, 4);

      const sel = sm.getSelection();
      expect(sel.ranges).toHaveLength(1);
      expect(sel.ranges[0]).toEqual({ startRow: 2, startCol: 1, endRow: 7, endCol: 4 });
    });
  });

  describe('addRange (Ctrl+click)', () => {
    it('adds a new range to existing selection', () => {
      const sm = createManager();
      sm.selectCell(0, 0);
      sm.addRange(5, 3);

      const sel = sm.getSelection();
      expect(sel.ranges).toHaveLength(2);
      expect(sel.ranges[0]).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      expect(sel.ranges[1]).toEqual({ startRow: 5, startCol: 3, endRow: 5, endCol: 3 });
      expect(sel.activeCell).toEqual({ row: 5, col: 3 });
    });

    it('sets anchor to the new range cell', () => {
      const sm = createManager();
      sm.selectCell(0, 0);
      sm.addRange(3, 2);

      expect(sm.getSelection().anchorCell).toEqual({ row: 3, col: 2 });
    });
  });

  describe('selectRow (row number click)', () => {
    it('selects entire row', () => {
      const sm = createManager({ colCount: 5 });
      sm.selectRow(3);

      const sel = sm.getSelection();
      expect(sel.type).toBe('row');
      expect(sel.activeCell).toEqual({ row: 3, col: 0 });
      expect(sel.ranges).toEqual([{ startRow: 3, startCol: 0, endRow: 3, endCol: 4 }]);
    });

    it('clamps to valid row range', () => {
      const sm = createManager({ rowCount: 10 });
      sm.selectRow(999);

      expect(sm.getSelection().activeCell.row).toBe(9);
    });
  });

  describe('selectColumn (header click)', () => {
    it('selects entire column', () => {
      const sm = createManager({ rowCount: 100, colCount: 5 });
      sm.selectColumn(2);

      const sel = sm.getSelection();
      expect(sel.type).toBe('column');
      expect(sel.activeCell).toEqual({ row: 0, col: 2 });
      expect(sel.ranges).toEqual([{ startRow: 0, startCol: 2, endRow: 99, endCol: 2 }]);
    });

    it('clamps to valid column range', () => {
      const sm = createManager({ colCount: 3 });
      sm.selectColumn(100);

      expect(sm.getSelection().activeCell.col).toBe(2);
    });
  });

  describe('selectAll (corner click / Ctrl+A)', () => {
    it('selects all cells', () => {
      const sm = createManager({ rowCount: 100, colCount: 5 });
      sm.selectAll();

      const sel = sm.getSelection();
      expect(sel.type).toBe('all');
      expect(sel.activeCell).toEqual({ row: 0, col: 0 });
      expect(sel.ranges).toEqual([{ startRow: 0, startCol: 0, endRow: 99, endCol: 4 }]);
    });
  });

  describe('isSelected', () => {
    it('returns true for cells in selection range', () => {
      const sm = createManager();
      sm.selectCell(2, 1);
      sm.extendSelection(4, 3);

      expect(sm.isSelected(2, 1)).toBe(true);
      expect(sm.isSelected(3, 2)).toBe(true);
      expect(sm.isSelected(4, 3)).toBe(true);
    });

    it('returns false for cells outside selection range', () => {
      const sm = createManager();
      sm.selectCell(2, 1);
      sm.extendSelection(4, 3);

      expect(sm.isSelected(1, 1)).toBe(false);
      expect(sm.isSelected(5, 3)).toBe(false);
      expect(sm.isSelected(3, 0)).toBe(false);
    });

    it('checks across multiple ranges (Ctrl+click)', () => {
      const sm = createManager();
      sm.selectCell(0, 0);
      sm.addRange(5, 3);

      expect(sm.isSelected(0, 0)).toBe(true);
      expect(sm.isSelected(5, 3)).toBe(true);
      expect(sm.isSelected(2, 2)).toBe(false);
    });

    it('handles row selection', () => {
      const sm = createManager({ colCount: 5 });
      sm.selectRow(3);

      expect(sm.isSelected(3, 0)).toBe(true);
      expect(sm.isSelected(3, 4)).toBe(true);
      expect(sm.isSelected(2, 0)).toBe(false);
    });

    it('handles column selection', () => {
      const sm = createManager({ rowCount: 100 });
      sm.selectColumn(2);

      expect(sm.isSelected(0, 2)).toBe(true);
      expect(sm.isSelected(99, 2)).toBe(true);
      expect(sm.isSelected(0, 1)).toBe(false);
    });
  });

  describe('isActiveCell', () => {
    it('returns true for the active cell', () => {
      const sm = createManager();
      sm.selectCell(3, 2);

      expect(sm.isActiveCell(3, 2)).toBe(true);
    });

    it('returns false for non-active cells', () => {
      const sm = createManager();
      sm.selectCell(3, 2);

      expect(sm.isActiveCell(0, 0)).toBe(false);
      expect(sm.isActiveCell(3, 1)).toBe(false);
    });

    it('tracks active cell through extend', () => {
      const sm = createManager();
      sm.selectCell(2, 1);
      sm.extendSelection(5, 3);

      expect(sm.isActiveCell(5, 3)).toBe(true);
      expect(sm.isActiveCell(2, 1)).toBe(false); // anchor, not active
    });
  });

  describe('getSelection immutability', () => {
    it('returns a new object each time', () => {
      const sm = createManager();
      sm.selectCell(1, 1);

      const sel1 = sm.getSelection();
      const sel2 = sm.getSelection();

      expect(sel1).not.toBe(sel2);
      expect(sel1.activeCell).not.toBe(sel2.activeCell);
      expect(sel1.ranges).not.toBe(sel2.ranges);
    });

    it('does not mutate internal state when snapshot is modified', () => {
      const sm = createManager();
      sm.selectCell(1, 1);

      const sel = sm.getSelection();
      (sel.ranges as unknown[]).push({ startRow: 99, startCol: 99, endRow: 99, endCol: 99 });

      expect(sm.getSelection().ranges).toHaveLength(1);
    });
  });

  describe('onChange callback', () => {
    it('fires on selectCell', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectCell(3, 2);

      expect(onChange).toHaveBeenCalledOnce();
      const [current, previous] = onChange.mock.calls[0];
      expect(current.activeCell).toEqual({ row: 3, col: 2 });
      expect(previous.activeCell).toEqual({ row: 0, col: 0 });
    });

    it('fires on extendSelection', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectCell(2, 1);
      sm.extendSelection(5, 3);

      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('fires on selectAll', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectAll();

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0].type).toBe('all');
    });

    it('fires on selectRow', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectRow(5);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0].type).toBe('row');
    });

    it('fires on selectColumn', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectColumn(2);

      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0].type).toBe('column');
    });

    it('fires on addRange', () => {
      const onChange = vi.fn();
      const sm = createManager({ onChange });
      sm.selectCell(0, 0);
      sm.addRange(3, 2);

      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('merge-aware selection', () => {
    function createMergeAwareManager() {
      const sm = createManager({ rowCount: 20, colCount: 10 });
      const mm = new MergeManager();
      mm.merge({ startRow: 2, startCol: 3, endRow: 4, endCol: 5 });
      sm.setMergeManager(mm);
      return { sm, mm };
    }

    it('selectCell on hidden cell redirects to anchor', () => {
      const { sm } = createMergeAwareManager();
      sm.selectCell(3, 4); // hidden cell in merge

      const sel = sm.getSelection();
      expect(sel.activeCell).toEqual({ row: 2, col: 3 }); // anchor
      expect(sel.anchorCell).toEqual({ row: 2, col: 3 });
    });

    it('selectCell on anchor expands range to full merge', () => {
      const { sm } = createMergeAwareManager();
      sm.selectCell(2, 3); // anchor cell

      const sel = sm.getSelection();
      expect(sel.ranges[0]).toEqual({ startRow: 2, startCol: 3, endRow: 4, endCol: 5 });
    });

    it('selectCell on non-merged cell works normally', () => {
      const { sm } = createMergeAwareManager();
      sm.selectCell(0, 0);

      const sel = sm.getSelection();
      expect(sel.activeCell).toEqual({ row: 0, col: 0 });
      expect(sel.ranges[0]).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    });

    it('extendSelection with merge expands to include full region', () => {
      const { sm } = createMergeAwareManager();
      sm.selectCell(0, 0);
      sm.extendSelection(3, 4); // hidden cell in merge

      const sel = sm.getSelection();
      // Should include the full merge region bounds
      expect(sel.ranges[0].endRow).toBeGreaterThanOrEqual(4);
      expect(sel.ranges[0].endCol).toBeGreaterThanOrEqual(5);
    });

    it('addRange on hidden cell redirects to anchor with full range', () => {
      const { sm } = createMergeAwareManager();
      sm.selectCell(0, 0);
      sm.addRange(4, 5); // hidden cell in merge

      const sel = sm.getSelection();
      expect(sel.ranges).toHaveLength(2);
      expect(sel.activeCell).toEqual({ row: 2, col: 3 });
      expect(sel.ranges[1]).toEqual({ startRow: 2, startCol: 3, endRow: 4, endCol: 5 });
    });
  });
});
