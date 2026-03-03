import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(widths: number[]): ColumnDef[] {
  return widths.map((w, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: w,
  }));
}

function makeConfig(
  widths: number[],
  rowCount: number,
  overrides?: Partial<{ rowHeight: number; headerHeight: number; rowNumberWidth: number }>,
) {
  return {
    columns: makeColumns(widths),
    rowCount,
    rowHeight: overrides?.rowHeight ?? 28,
    headerHeight: overrides?.headerHeight ?? 32,
    rowNumberWidth: overrides?.rowNumberWidth ?? 50,
  };
}

describe('LayoutEngine', () => {
  describe('cumulative position calculation', () => {
    it('computes correct positions for uniform-width columns', () => {
      const engine = new LayoutEngine(makeConfig([100, 100, 100], 10));

      expect(engine.columnCount).toBe(3);
      expect(engine.contentWidth).toBe(300);
      expect(engine.getColumnX(0)).toBe(0);
      expect(engine.getColumnX(1)).toBe(100);
      expect(engine.getColumnX(2)).toBe(200);
    });

    it('computes correct positions for variable-width columns', () => {
      const engine = new LayoutEngine(makeConfig([80, 120, 60, 200], 5));

      expect(engine.columnCount).toBe(4);
      expect(engine.contentWidth).toBe(460);
      expect(engine.getColumnX(0)).toBe(0);
      expect(engine.getColumnX(1)).toBe(80);
      expect(engine.getColumnX(2)).toBe(200);
      expect(engine.getColumnX(3)).toBe(260);
    });

    it('excludes hidden columns from layout', () => {
      const columns: ColumnDef[] = [
        { key: 'a', title: 'A', width: 100 },
        { key: 'b', title: 'B', width: 100, hidden: true },
        { key: 'c', title: 'C', width: 100 },
      ];
      const engine = new LayoutEngine({
        columns,
        rowCount: 5,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      expect(engine.columnCount).toBe(2);
      expect(engine.contentWidth).toBe(200);
    });

    it('computes correct content height for uniform rows', () => {
      const engine = new LayoutEngine(makeConfig([100], 1000, { rowHeight: 28 }));
      expect(engine.contentHeight).toBe(28000);
    });
  });

  describe('total dimensions', () => {
    it('totalWidth includes rowNumberWidth', () => {
      const engine = new LayoutEngine(
        makeConfig([100, 150], 10, { rowNumberWidth: 50 }),
      );
      expect(engine.totalWidth).toBe(50 + 250);
    });

    it('totalHeight includes headerHeight', () => {
      const engine = new LayoutEngine(
        makeConfig([100], 100, { rowHeight: 28, headerHeight: 32 }),
      );
      expect(engine.totalHeight).toBe(32 + 100 * 28);
    });

    it('works with zero rowNumberWidth', () => {
      const engine = new LayoutEngine(
        makeConfig([100, 100], 10, { rowNumberWidth: 0 }),
      );
      expect(engine.totalWidth).toBe(200);
    });
  });

  describe('O(1) getCellRect', () => {
    it('returns correct rect for first cell', () => {
      const engine = new LayoutEngine(
        makeConfig([100, 120, 80], 10, {
          rowHeight: 28,
          headerHeight: 32,
          rowNumberWidth: 50,
        }),
      );
      const rect = engine.getCellRect(0, 0);
      expect(rect).toEqual({ x: 50, y: 32, width: 100, height: 28 });
    });

    it('returns correct rect for arbitrary cell', () => {
      const engine = new LayoutEngine(
        makeConfig([100, 120, 80], 10, {
          rowHeight: 28,
          headerHeight: 32,
          rowNumberWidth: 50,
        }),
      );
      const rect = engine.getCellRect(3, 1);
      expect(rect).toEqual({
        x: 50 + 100,
        y: 32 + 3 * 28,
        width: 120,
        height: 28,
      });
    });

    it('returns correct rect for last cell', () => {
      const engine = new LayoutEngine(
        makeConfig([100, 120, 80], 5, {
          rowHeight: 28,
          headerHeight: 32,
          rowNumberWidth: 50,
        }),
      );
      const rect = engine.getCellRect(4, 2);
      expect(rect).toEqual({
        x: 50 + 220,
        y: 32 + 4 * 28,
        width: 80,
        height: 28,
      });
    });

    it('returns zero rect for out-of-bounds indices', () => {
      const engine = new LayoutEngine(makeConfig([100], 5));
      expect(engine.getCellRect(-1, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(engine.getCellRect(0, -1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(engine.getCellRect(5, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      expect(engine.getCellRect(0, 1)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe('binary search - getRowAtY', () => {
    it('returns correct row at position 0', () => {
      const engine = new LayoutEngine(makeConfig([100], 100, { rowHeight: 28 }));
      expect(engine.getRowAtY(0)).toBe(0);
    });

    it('returns correct row in the middle', () => {
      const engine = new LayoutEngine(makeConfig([100], 100, { rowHeight: 28 }));
      expect(engine.getRowAtY(56)).toBe(2); // 56 / 28 = 2
    });

    it('returns correct row at exact boundary', () => {
      const engine = new LayoutEngine(makeConfig([100], 100, { rowHeight: 28 }));
      expect(engine.getRowAtY(28)).toBe(1); // exactly at row 1 start
      expect(engine.getRowAtY(27)).toBe(0); // last pixel of row 0
    });

    it('returns last row for position at end', () => {
      const engine = new LayoutEngine(makeConfig([100], 10, { rowHeight: 28 }));
      expect(engine.getRowAtY(279)).toBe(9); // last pixel of last row
    });

    it('returns -1 for position beyond total height', () => {
      const engine = new LayoutEngine(makeConfig([100], 10, { rowHeight: 28 }));
      expect(engine.getRowAtY(280)).toBe(-1); // 10 * 28 = 280, out of bounds
    });

    it('returns -1 for negative position', () => {
      const engine = new LayoutEngine(makeConfig([100], 10));
      expect(engine.getRowAtY(-1)).toBe(-1);
    });
  });

  describe('binary search - getColAtX', () => {
    it('returns correct column at position 0', () => {
      const engine = new LayoutEngine(makeConfig([100, 120, 80], 10));
      expect(engine.getColAtX(0)).toBe(0);
    });

    it('returns correct column in the middle of a column', () => {
      const engine = new LayoutEngine(makeConfig([100, 120, 80], 10));
      expect(engine.getColAtX(50)).toBe(0);
      expect(engine.getColAtX(150)).toBe(1);
      expect(engine.getColAtX(250)).toBe(2);
    });

    it('returns correct column at exact boundary', () => {
      const engine = new LayoutEngine(makeConfig([100, 120, 80], 10));
      expect(engine.getColAtX(100)).toBe(1); // start of col 1
      expect(engine.getColAtX(99)).toBe(0); // last pixel of col 0
      expect(engine.getColAtX(220)).toBe(2); // start of col 2
      expect(engine.getColAtX(219)).toBe(1); // last pixel of col 1
    });

    it('returns -1 for position beyond total width', () => {
      const engine = new LayoutEngine(makeConfig([100, 120, 80], 10));
      expect(engine.getColAtX(300)).toBe(-1); // 100+120+80 = 300, out of bounds
    });

    it('returns -1 for negative position', () => {
      const engine = new LayoutEngine(makeConfig([100, 120, 80], 10));
      expect(engine.getColAtX(-1)).toBe(-1);
    });

    it('handles single column', () => {
      const engine = new LayoutEngine(makeConfig([200], 10));
      expect(engine.getColAtX(0)).toBe(0);
      expect(engine.getColAtX(199)).toBe(0);
      expect(engine.getColAtX(200)).toBe(-1);
    });

    it('handles variable-width columns correctly', () => {
      const engine = new LayoutEngine(makeConfig([50, 200, 30, 150], 10));
      // positions: 0, 50, 250, 280, 430
      expect(engine.getColAtX(0)).toBe(0);
      expect(engine.getColAtX(49)).toBe(0);
      expect(engine.getColAtX(50)).toBe(1);
      expect(engine.getColAtX(249)).toBe(1);
      expect(engine.getColAtX(250)).toBe(2);
      expect(engine.getColAtX(279)).toBe(2);
      expect(engine.getColAtX(280)).toBe(3);
      expect(engine.getColAtX(429)).toBe(3);
      expect(engine.getColAtX(430)).toBe(-1);
    });
  });

  describe('large datasets', () => {
    it('handles 100K rows efficiently', () => {
      const engine = new LayoutEngine(makeConfig([100], 100_000, { rowHeight: 28 }));
      expect(engine.rowCount).toBe(100_000);
      expect(engine.contentHeight).toBe(2_800_000);
      expect(engine.getRowAtY(1_400_000)).toBe(50_000);
      expect(engine.getCellRect(99_999, 0).y).toBe(32 + 99_999 * 28);
    });
  });
});
