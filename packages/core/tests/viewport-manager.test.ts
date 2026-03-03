import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ViewportManager } from '../src/renderer/viewport-manager';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(widths: number[]): ColumnDef[] {
  return widths.map((w, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: w,
  }));
}

function makeLayout(
  widths: number[],
  rowCount: number,
  overrides?: Partial<{ rowHeight: number; headerHeight: number; rowNumberWidth: number }>,
) {
  return new LayoutEngine({
    columns: makeColumns(widths),
    rowCount,
    rowHeight: overrides?.rowHeight ?? 28,
    headerHeight: overrides?.headerHeight ?? 32,
    rowNumberWidth: overrides?.rowNumberWidth ?? 50,
  });
}

describe('ViewportManager', () => {
  describe('basic visible range computation', () => {
    it('computes correct range at scroll position 0', () => {
      // 100 rows × 28px = 2800px content height
      // viewport 600px → shows ~21 rows (600/28=21.4)
      const layout = makeLayout([100, 100, 100], 100, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const range = vm.computeVisibleRange(0, 0, 300, 600);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(21); // floor((600-1)/28) = 21
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(2);
    });

    it('computes correct range scrolled partway', () => {
      const layout = makeLayout([100, 100, 100], 100, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // scrollY = 280 → first visible row = 280/28 = 10
      // last visible row: (280+600-1)/28 = (879)/28 = 31
      const range = vm.computeVisibleRange(0, 280, 300, 600);
      expect(range.startRow).toBe(10);
      expect(range.endRow).toBe(31);
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(2);
    });

    it('computes correct range with horizontal scroll', () => {
      // 10 columns × 100px each = 1000px content width
      const widths = Array(10).fill(100) as number[];
      const layout = makeLayout(widths, 50, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // scrollX = 300 → first visible col = 3, viewport 400px wide → last = col 6
      const range = vm.computeVisibleRange(300, 0, 400, 600);
      expect(range.startCol).toBe(3);
      expect(range.endCol).toBe(6); // 300+400-1=699 → col 6
    });
  });

  describe('buffer zone', () => {
    it('includes buffer rows above and below', () => {
      const layout = makeLayout([100], 100, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 10, colBuffer: 0 });

      // scrollY = 280 → visible rows 10-31
      // with buffer: startRow = max(0, 10-10) = 0, endRow = min(99, 31+10) = 41
      const range = vm.computeVisibleRange(0, 280, 100, 600);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(41);
    });

    it('includes buffer columns left and right', () => {
      const widths = Array(20).fill(100) as number[];
      const layout = makeLayout(widths, 10);
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 5 });

      // scrollX = 500 → visible cols 5-9, with buffer: 0-14
      const range = vm.computeVisibleRange(500, 0, 500, 300);
      expect(range.startCol).toBe(0); // max(0, 5-5)
      expect(range.endCol).toBe(14); // min(19, 9+5)
    });

    it('clamps buffer to valid range', () => {
      const layout = makeLayout([100], 20, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 50, colBuffer: 50 });

      // Even with huge buffer, results clamped to [0, rowCount-1]
      const range = vm.computeVisibleRange(0, 0, 100, 600);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(19); // only 20 rows
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(0); // only 1 column
    });
  });

  describe('default buffer values', () => {
    it('uses default buffer of 10 rows and 5 columns', () => {
      const widths = Array(20).fill(100) as number[];
      const layout = makeLayout(widths, 100, { rowHeight: 28 });
      const vm = new ViewportManager(layout);

      // scrollY = 560 → visible rows 20-41
      // with default buffer 10: startRow = 10, endRow = 51
      const range = vm.computeVisibleRange(500, 560, 500, 600);
      expect(range.startRow).toBe(10);
      expect(range.endRow).toBe(51);
      // scrollX = 500 → visible cols 5-9
      // with default buffer 5: startCol = 0, endCol = 14
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(14);
    });
  });

  describe('edge cases', () => {
    it('handles scroll at 0,0 with buffer', () => {
      const layout = makeLayout([100, 100], 50, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 10, colBuffer: 5 });

      const range = vm.computeVisibleRange(0, 0, 200, 600);
      expect(range.startRow).toBe(0); // can't go below 0
      expect(range.startCol).toBe(0);
    });

    it('handles scroll at max position', () => {
      const layout = makeLayout([100, 100], 50, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 10, colBuffer: 5 });

      // scroll to very bottom: contentHeight=1400, scrollY=1400-600=800
      const range = vm.computeVisibleRange(0, 800, 200, 600);
      expect(range.endRow).toBe(49); // clamped to last row
    });

    it('handles viewport larger than content', () => {
      const layout = makeLayout([100, 100], 5, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // viewport 2000px but content only 140px (5*28)
      const range = vm.computeVisibleRange(0, 0, 2000, 2000);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(4);
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(1);
      expect(range.visibleRowCount).toBe(5);
      expect(range.visibleColCount).toBe(2);
    });

    it('handles zero rows', () => {
      const layout = makeLayout([100], 0);
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const range = vm.computeVisibleRange(0, 0, 500, 500);
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(-1);
      expect(range.visibleRowCount).toBe(0);
    });

    it('handles zero columns', () => {
      const layout = makeLayout([], 10);
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const range = vm.computeVisibleRange(0, 0, 500, 500);
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBe(-1);
      expect(range.visibleColCount).toBe(0);
    });

    it('returns correct visibleRowCount and visibleColCount', () => {
      const layout = makeLayout([100, 100, 100], 50, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const range = vm.computeVisibleRange(0, 0, 300, 280);
      // 280px / 28px = 10 rows (0-9)
      expect(range.visibleRowCount).toBe(10);
      expect(range.visibleColCount).toBe(3);
    });
  });

  describe('large datasets', () => {
    it('correctly computes viewport for 100K rows', () => {
      const layout = makeLayout([100], 100_000, { rowHeight: 28 });
      const vm = new ViewportManager(layout, { rowBuffer: 10, colBuffer: 0 });

      // Scroll to middle: row 50000 → scrollY = 50000*28 = 1400000
      const range = vm.computeVisibleRange(0, 1_400_000, 100, 600);
      // visible: 50000 to ~50021, buffer: 49990 to 50031
      expect(range.startRow).toBe(49_990);
      expect(range.endRow).toBe(50_031);
      expect(range.visibleRowCount).toBe(42);
    });
  });

  describe('zero rows edge case', () => {
    it('returns valid column range when rowCount=0 for header rendering', () => {
      const layout = makeLayout([100, 100, 100], 0);
      const vm = new ViewportManager(layout);
      const range = vm.computeVisibleRange(0, 0, 300, 400);

      expect(range.visibleRowCount).toBe(0);
      expect(range.endRow).toBe(-1);
      // Columns should still be valid for header rendering
      expect(range.startCol).toBe(0);
      expect(range.endCol).toBeGreaterThanOrEqual(0);
      expect(range.visibleColCount).toBeGreaterThan(0);
    });

    it('returns empty range when both rows and columns are 0', () => {
      const layout = makeLayout([], 0);
      const vm = new ViewportManager(layout);
      const range = vm.computeVisibleRange(0, 0, 300, 400);

      expect(range.visibleRowCount).toBe(0);
      expect(range.visibleColCount).toBe(0);
      expect(range.endRow).toBe(-1);
      expect(range.endCol).toBe(-1);
    });
  });
});
