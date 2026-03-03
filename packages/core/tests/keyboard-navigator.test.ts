import { describe, it, expect, vi } from 'vitest';
import { KeyboardNavigator } from '../src/selection/keyboard-navigator';
import { SelectionManager } from '../src/selection/selection-manager';
import { MergeManager } from '../src/merge/merge-manager';
import type { GridKeyboardEvent } from '../src/events/event-types';

function createNav(opts?: { rowCount?: number; colCount?: number; visibleRows?: number }) {
  const sm = new SelectionManager({
    rowCount: opts?.rowCount ?? 100,
    colCount: opts?.colCount ?? 10,
  });
  const nav = new KeyboardNavigator({
    selectionManager: sm,
    getVisibleRowCount: () => opts?.visibleRows ?? 20,
  });
  return { sm, nav };
}

function makeEvent(
  key: string,
  opts?: { shiftKey?: boolean; ctrlKey?: boolean },
): GridKeyboardEvent {
  const preventDefault = vi.fn();
  return {
    key,
    shiftKey: opts?.shiftKey ?? false,
    ctrlKey: opts?.ctrlKey ?? false,
    originalEvent: { preventDefault } as unknown as KeyboardEvent,
  };
}

describe('KeyboardNavigator', () => {
  describe('Arrow keys', () => {
    it('ArrowDown moves active cell down by one', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowDown'));
      expect(result).toEqual({ row: 6, col: 3 });
      expect(sm.getSelection().activeCell).toEqual({ row: 6, col: 3 });
    });

    it('ArrowUp moves active cell up by one', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowUp'));
      expect(result).toEqual({ row: 4, col: 3 });
      expect(sm.getSelection().activeCell).toEqual({ row: 4, col: 3 });
    });

    it('ArrowRight moves active cell right by one', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowRight'));
      expect(result).toEqual({ row: 5, col: 4 });
      expect(sm.getSelection().activeCell).toEqual({ row: 5, col: 4 });
    });

    it('ArrowLeft moves active cell left by one', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowLeft'));
      expect(result).toEqual({ row: 5, col: 2 });
      expect(sm.getSelection().activeCell).toEqual({ row: 5, col: 2 });
    });

    it('ArrowUp at row 0 stays at row 0', () => {
      const { sm, nav } = createNav();
      sm.selectCell(0, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowUp'));
      expect(result).toEqual({ row: 0, col: 3 });
    });

    it('ArrowDown at last row stays at last row', () => {
      const { sm, nav } = createNav({ rowCount: 10 });
      sm.selectCell(9, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowDown'));
      expect(result).toEqual({ row: 9, col: 3 });
    });

    it('ArrowLeft at col 0 stays at col 0', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 0);

      const result = nav.handleKeyDown(makeEvent('ArrowLeft'));
      expect(result).toEqual({ row: 5, col: 0 });
    });

    it('ArrowRight at last col stays at last col', () => {
      const { sm, nav } = createNav({ colCount: 5 });
      sm.selectCell(5, 4);

      const result = nav.handleKeyDown(makeEvent('ArrowRight'));
      expect(result).toEqual({ row: 5, col: 4 });
    });
  });

  describe('Tab key', () => {
    it('Tab moves right', () => {
      const { sm, nav } = createNav();
      sm.selectCell(2, 3);

      const result = nav.handleKeyDown(makeEvent('Tab'));
      expect(result).toEqual({ row: 2, col: 4 });
    });

    it('Shift+Tab moves left', () => {
      const { sm, nav } = createNav();
      sm.selectCell(2, 3);

      const result = nav.handleKeyDown(makeEvent('Tab', { shiftKey: true }));
      expect(result).toEqual({ row: 2, col: 2 });
    });

    it('Tab at last column stays at last column', () => {
      const { sm, nav } = createNav({ colCount: 5 });
      sm.selectCell(2, 4);

      const result = nav.handleKeyDown(makeEvent('Tab'));
      expect(result).toEqual({ row: 2, col: 4 });
    });

    it('Shift+Tab at column 0 stays at column 0', () => {
      const { sm, nav } = createNav();
      sm.selectCell(2, 0);

      const result = nav.handleKeyDown(makeEvent('Tab', { shiftKey: true }));
      expect(result).toEqual({ row: 2, col: 0 });
    });
  });

  describe('Enter key', () => {
    it('Enter moves down', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('Enter'));
      expect(result).toEqual({ row: 6, col: 3 });
    });

    it('Shift+Enter moves up', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('Enter', { shiftKey: true }));
      expect(result).toEqual({ row: 4, col: 3 });
    });

    it('Enter at last row stays at last row', () => {
      const { sm, nav } = createNav({ rowCount: 10 });
      sm.selectCell(9, 3);

      const result = nav.handleKeyDown(makeEvent('Enter'));
      expect(result).toEqual({ row: 9, col: 3 });
    });

    it('Shift+Enter at row 0 stays at row 0', () => {
      const { sm, nav } = createNav();
      sm.selectCell(0, 3);

      const result = nav.handleKeyDown(makeEvent('Enter', { shiftKey: true }));
      expect(result).toEqual({ row: 0, col: 3 });
    });
  });

  describe('Home/End keys', () => {
    it('Home moves to first column', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 7);

      const result = nav.handleKeyDown(makeEvent('Home'));
      expect(result).toEqual({ row: 5, col: 0 });
    });

    it('End moves to last column', () => {
      const { sm, nav } = createNav({ colCount: 10 });
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('End'));
      expect(result).toEqual({ row: 5, col: 9 });
    });

    it('Ctrl+Home moves to top-left cell', () => {
      const { sm, nav } = createNav();
      sm.selectCell(50, 7);

      const result = nav.handleKeyDown(makeEvent('Home', { ctrlKey: true }));
      expect(result).toEqual({ row: 0, col: 0 });
    });

    it('Ctrl+End moves to bottom-right cell', () => {
      const { sm, nav } = createNav({ rowCount: 100, colCount: 10 });
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('End', { ctrlKey: true }));
      expect(result).toEqual({ row: 99, col: 9 });
    });
  });

  describe('PageUp/PageDown', () => {
    it('PageDown moves down by visible row count', () => {
      const { sm, nav } = createNav({ visibleRows: 20 });
      sm.selectCell(10, 3);

      const result = nav.handleKeyDown(makeEvent('PageDown'));
      expect(result).toEqual({ row: 30, col: 3 });
    });

    it('PageUp moves up by visible row count', () => {
      const { sm, nav } = createNav({ visibleRows: 20 });
      sm.selectCell(30, 3);

      const result = nav.handleKeyDown(makeEvent('PageUp'));
      expect(result).toEqual({ row: 10, col: 3 });
    });

    it('PageDown clamps to last row', () => {
      const { sm, nav } = createNav({ rowCount: 50, visibleRows: 20 });
      sm.selectCell(40, 3);

      const result = nav.handleKeyDown(makeEvent('PageDown'));
      expect(result).toEqual({ row: 49, col: 3 });
    });

    it('PageUp clamps to row 0', () => {
      const { sm, nav } = createNav({ visibleRows: 20 });
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('PageUp'));
      expect(result).toEqual({ row: 0, col: 3 });
    });
  });

  describe('Shift+Arrow extends selection', () => {
    it('Shift+ArrowDown extends selection range downward', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('ArrowDown', { shiftKey: true }));
      expect(result).toEqual({ row: 6, col: 3 });

      const sel = sm.getSelection();
      expect(sel.type).toBe('range');
      expect(sel.ranges[0]).toEqual({ startRow: 5, startCol: 3, endRow: 6, endCol: 3 });
      // Active cell moves but anchor stays
      expect(sel.activeCell).toEqual({ row: 6, col: 3 });
      expect(sel.anchorCell).toEqual({ row: 5, col: 3 });
    });

    it('Shift+ArrowRight extends selection range rightward', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      nav.handleKeyDown(makeEvent('ArrowRight', { shiftKey: true }));

      const sel = sm.getSelection();
      expect(sel.ranges[0]).toEqual({ startRow: 5, startCol: 3, endRow: 5, endCol: 4 });
    });

    it('multiple Shift+Arrow calls extend progressively', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      nav.handleKeyDown(makeEvent('ArrowDown', { shiftKey: true }));
      nav.handleKeyDown(makeEvent('ArrowDown', { shiftKey: true }));
      nav.handleKeyDown(makeEvent('ArrowRight', { shiftKey: true }));

      const sel = sm.getSelection();
      expect(sel.ranges[0]).toEqual({ startRow: 5, startCol: 3, endRow: 7, endCol: 4 });
    });

    it('Shift+ArrowUp extends selection upward', () => {
      const { sm, nav } = createNav();
      sm.selectCell(5, 3);

      nav.handleKeyDown(makeEvent('ArrowUp', { shiftKey: true }));

      const sel = sm.getSelection();
      expect(sel.ranges[0]).toEqual({ startRow: 4, startCol: 3, endRow: 5, endCol: 3 });
    });
  });

  describe('Ctrl+A selects all', () => {
    it('selects all cells', () => {
      const { sm, nav } = createNav({ rowCount: 50, colCount: 10 });
      sm.selectCell(5, 3);

      const result = nav.handleKeyDown(makeEvent('a', { ctrlKey: true }));
      expect(result).toEqual({ row: 5, col: 3 });

      const sel = sm.getSelection();
      expect(sel.type).toBe('all');
      expect(sel.ranges[0]).toEqual({ startRow: 0, startCol: 0, endRow: 49, endCol: 9 });
    });
  });

  describe('preventDefault', () => {
    it('calls preventDefault on handled navigation keys', () => {
      const { nav } = createNav();
      const event = makeEvent('ArrowDown');

      nav.handleKeyDown(event);
      expect(event.originalEvent.preventDefault).toHaveBeenCalledOnce();
    });

    it('calls preventDefault on Ctrl+A', () => {
      const { nav } = createNav();
      const event = makeEvent('a', { ctrlKey: true });

      nav.handleKeyDown(event);
      expect(event.originalEvent.preventDefault).toHaveBeenCalledOnce();
    });
  });

  describe('unhandled keys', () => {
    it('returns null for non-navigation keys', () => {
      const { nav } = createNav();

      expect(nav.handleKeyDown(makeEvent('x'))).toBeNull();
      expect(nav.handleKeyDown(makeEvent('Escape'))).toBeNull();
      expect(nav.handleKeyDown(makeEvent('F2'))).toBeNull();
      expect(nav.handleKeyDown(makeEvent('Delete'))).toBeNull();
    });

    it('does not call preventDefault for unhandled keys', () => {
      const { nav } = createNav();
      const event = makeEvent('x');

      nav.handleKeyDown(event);
      expect(event.originalEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('returns null for plain "a" without Ctrl', () => {
      const { nav } = createNav();
      expect(nav.handleKeyDown(makeEvent('a'))).toBeNull();
    });
  });

  describe('navigation with single row/column grid', () => {
    it('handles single row grid', () => {
      const { sm, nav } = createNav({ rowCount: 1, colCount: 5 });
      sm.selectCell(0, 2);

      expect(nav.handleKeyDown(makeEvent('ArrowUp'))).toEqual({ row: 0, col: 2 });
      expect(nav.handleKeyDown(makeEvent('ArrowDown'))).toEqual({ row: 0, col: 2 });
      expect(nav.handleKeyDown(makeEvent('ArrowRight'))).toEqual({ row: 0, col: 3 });
    });

    it('handles single column grid', () => {
      const { sm, nav } = createNav({ rowCount: 5, colCount: 1 });
      sm.selectCell(2, 0);

      expect(nav.handleKeyDown(makeEvent('ArrowLeft'))).toEqual({ row: 2, col: 0 });
      expect(nav.handleKeyDown(makeEvent('ArrowRight'))).toEqual({ row: 2, col: 0 });
      expect(nav.handleKeyDown(makeEvent('ArrowDown'))).toEqual({ row: 3, col: 0 });
    });
  });

  describe('merge-aware navigation', () => {
    function createMergeNav() {
      const sm = new SelectionManager({ rowCount: 20, colCount: 10 });
      const mm = new MergeManager();
      // Merge rows 3-5, cols 3-5
      mm.merge({ startRow: 3, startCol: 3, endRow: 5, endCol: 5 });
      const nav = new KeyboardNavigator({
        selectionManager: sm,
        getVisibleRowCount: () => 20,
      });
      nav.setMergeManager(mm);
      sm.setMergeManager(mm);
      return { sm, nav, mm };
    }

    it('ArrowDown skips hidden cells to end+1 of merge', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(2, 4); // row above merge, col inside merge range

      const result = nav.handleKeyDown(makeEvent('ArrowDown'));
      // Row 3, col 4 is hidden (not anchor). Should skip to row 6.
      expect(result).toEqual({ row: 6, col: 4 });
    });

    it('ArrowUp skips hidden cells to start-1 of merge', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(6, 4); // row below merge

      const result = nav.handleKeyDown(makeEvent('ArrowUp'));
      // Row 5, col 4 is hidden. Should skip to row 2.
      expect(result).toEqual({ row: 2, col: 4 });
    });

    it('ArrowRight skips hidden cells to end+1 of merge', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(4, 2); // inside merge row, col to the left

      const result = nav.handleKeyDown(makeEvent('ArrowRight'));
      // Row 4, col 3 is hidden. Should skip to col 6.
      expect(result).toEqual({ row: 4, col: 6 });
    });

    it('ArrowLeft skips hidden cells to start-1 of merge', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(4, 6); // inside merge row, col to the right

      const result = nav.handleKeyDown(makeEvent('ArrowLeft'));
      // Row 4, col 5 is hidden. Should skip to col 2.
      expect(result).toEqual({ row: 4, col: 2 });
    });

    it('ArrowDown into anchor cell is fine (selects it)', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(2, 3); // directly above anchor

      const result = nav.handleKeyDown(makeEvent('ArrowDown'));
      // Row 3, col 3 IS the anchor — should land there
      expect(result).toEqual({ row: 3, col: 3 });
    });

    it('navigation at boundary clamps to grid edges', () => {
      const sm = new SelectionManager({ rowCount: 5, colCount: 5 });
      const mm = new MergeManager();
      mm.merge({ startRow: 3, startCol: 3, endRow: 4, endCol: 4 });
      const nav = new KeyboardNavigator({
        selectionManager: sm,
        getVisibleRowCount: () => 5,
      });
      nav.setMergeManager(mm);

      sm.selectCell(2, 4); // above merge, col inside merge
      const result = nav.handleKeyDown(makeEvent('ArrowDown'));
      // Row 3, col 4 is hidden. endRow+1=5 but maxRow is 4. Clamps to 4.
      // But 4 is still hidden (since merge is 3-4). With clamping it stays at maxRow.
      expect(result!.row).toBeLessThanOrEqual(4);
    });

    it('Shift+Enter skips hidden cells upward (not downward)', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(6, 4); // below merge
      const result = nav.handleKeyDown(makeEvent('Enter', { shiftKey: true }));
      // Shift+Enter goes up: row 5 is hidden, should skip to startRow-1 = 2
      expect(result).toEqual({ row: 2, col: 4 });
    });

    it('Shift+Tab skips hidden cells leftward (not rightward)', () => {
      const { sm, nav } = createMergeNav();
      sm.selectCell(4, 6); // right of merge
      const result = nav.handleKeyDown(makeEvent('Tab', { shiftKey: true }));
      // Shift+Tab goes left: col 5 is hidden, should skip to startCol-1 = 2
      expect(result).toEqual({ row: 4, col: 2 });
    });

    it('PageDown skips hidden cells in merged region', () => {
      const sm = new SelectionManager({ rowCount: 100, colCount: 10 });
      const mm = new MergeManager();
      mm.merge({ startRow: 18, startCol: 3, endRow: 22, endCol: 5 });
      const nav = new KeyboardNavigator({
        selectionManager: sm,
        getVisibleRowCount: () => 20,
      });
      nav.setMergeManager(mm);

      sm.selectCell(0, 4); // col inside merge range
      const result = nav.handleKeyDown(makeEvent('PageDown'));
      // PageDown jumps 20 rows to row 20, col 4 is hidden inside merge
      // Should skip to endRow+1 = 23
      expect(result).toEqual({ row: 23, col: 4 });
    });
  });
});
