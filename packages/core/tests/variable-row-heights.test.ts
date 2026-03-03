import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { RowStore } from '../src/model/row-store';
import type { ColumnDef } from '../src/types/interfaces';
import { lightTheme } from '../src/themes/built-in-themes';

function makeColumns(widths: number[]): ColumnDef[] {
  return widths.map((w, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: w,
  }));
}

describe('Variable row heights', () => {
  describe('LayoutEngine with RowStore', () => {
    it('builds cumulative row positions from RowStore overrides', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(1, 60); // row 1 = 60px instead of 28px
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 5,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      expect(engine.getRowY(0)).toBe(0);
      expect(engine.getRowHeight(0)).toBe(28);
      expect(engine.getRowY(1)).toBe(28);
      expect(engine.getRowHeight(1)).toBe(60);
      expect(engine.getRowY(2)).toBe(88); // 28 + 60
      expect(engine.getRowHeight(2)).toBe(28);
      expect(engine.contentHeight).toBe(28 + 60 + 28 + 28 + 28); // 172
    });

    it('defaults to uniform heights when no RowStore provided', () => {
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 5,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      expect(engine.getRowY(0)).toBe(0);
      expect(engine.getRowY(1)).toBe(28);
      expect(engine.getRowY(4)).toBe(112);
      expect(engine.getRowHeight(3)).toBe(28);
      expect(engine.contentHeight).toBe(140);
    });

    it('handles hidden rows (height 0) from RowStore', () => {
      const rowStore = new RowStore();
      rowStore.hide(1); // row 1 hidden
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 4,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      expect(engine.getRowY(0)).toBe(0);
      expect(engine.getRowHeight(0)).toBe(28);
      expect(engine.getRowY(1)).toBe(28);
      expect(engine.getRowHeight(1)).toBe(0); // hidden
      expect(engine.getRowY(2)).toBe(28); // same as row 1 since it has 0 height
      expect(engine.getRowHeight(2)).toBe(28);
      expect(engine.contentHeight).toBe(84); // 28 + 0 + 28 + 28
    });

    it('getRowAtY binary search works with mixed heights', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(0, 50);
      rowStore.setHeight(2, 100);
      // rows: 50, 28, 100, 28, 28 = positions: 0, 50, 78, 178, 206, 234
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 5,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      expect(engine.getRowAtY(0)).toBe(0);
      expect(engine.getRowAtY(49)).toBe(0);
      expect(engine.getRowAtY(50)).toBe(1);
      expect(engine.getRowAtY(77)).toBe(1);
      expect(engine.getRowAtY(78)).toBe(2);
      expect(engine.getRowAtY(177)).toBe(2);
      expect(engine.getRowAtY(178)).toBe(3);
      expect(engine.getRowAtY(205)).toBe(3);
      expect(engine.getRowAtY(206)).toBe(4);
      expect(engine.getRowAtY(233)).toBe(4);
      expect(engine.getRowAtY(234)).toBe(-1);
      expect(engine.getRowAtY(-1)).toBe(-1);
    });

    it('getCellRect uses variable row heights', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(1, 60);
      const engine = new LayoutEngine({
        columns: makeColumns([100, 120]),
        rowCount: 3,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      // Row 0: y = 32 + 0 = 32, h = 28
      expect(engine.getCellRect(0, 0)).toEqual({ x: 50, y: 32, width: 100, height: 28 });
      // Row 1: y = 32 + 28 = 60, h = 60
      expect(engine.getCellRect(1, 0)).toEqual({ x: 50, y: 60, width: 100, height: 60 });
      // Row 2: y = 32 + 88 = 120, h = 28
      expect(engine.getCellRect(2, 1)).toEqual({ x: 150, y: 120, width: 120, height: 28 });
    });

    it('setRowHeight mutates and recomputes positions', () => {
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 4,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      expect(engine.contentHeight).toBe(112); // 4 * 28

      engine.setRowHeight(1, 60);
      expect(engine.getRowHeight(1)).toBe(60);
      expect(engine.getRowY(2)).toBe(88); // 28 + 60
      expect(engine.contentHeight).toBe(144); // 28 + 60 + 28 + 28

      engine.setRowHeight(0, 50);
      expect(engine.getRowY(1)).toBe(50);
      expect(engine.getRowY(2)).toBe(110); // 50 + 60
      expect(engine.contentHeight).toBe(166); // 50 + 60 + 28 + 28
    });

    it('getRowY/getRowHeight return 0 for out-of-bounds', () => {
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 3,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      expect(engine.getRowY(-1)).toBe(0);
      expect(engine.getRowY(4)).toBe(0); // beyond sentinel
      expect(engine.getRowHeight(-1)).toBe(0);
      expect(engine.getRowHeight(3)).toBe(0);
    });

    it('getRowY returns sentinel position at rowCount (content height)', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(1, 60);
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 3,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      // rowPositions[3] = 28 + 60 + 28 = 116 = contentHeight
      expect(engine.getRowY(3)).toBe(116);
      expect(engine.contentHeight).toBe(116);
    });

    it('getRowPositions and getRowHeightsArray expose shared references', () => {
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 3,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      const positions = engine.getRowPositions();
      const heights = engine.getRowHeightsArray();
      expect(positions).toBeInstanceOf(Float64Array);
      expect(heights).toBeInstanceOf(Float64Array);
      expect(positions.length).toBe(4); // rowCount + 1
      expect(heights.length).toBe(3);

      // Mutating via setRowHeight should be visible through shared reference
      engine.setRowHeight(0, 50);
      expect(heights[0]).toBe(50);
      expect(positions[1]).toBe(50);
    });

    it('totalHeight includes headerHeight + variable row content', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(0, 50);
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 3,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      expect(engine.totalHeight).toBe(32 + 50 + 28 + 28); // 138
    });

    it('handles 100K rows with variable heights efficiently', () => {
      const rowStore = new RowStore();
      rowStore.setHeight(50000, 100);
      rowStore.setHeight(99999, 200);
      const engine = new LayoutEngine({
        columns: makeColumns([100]),
        rowCount: 100_000,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
        rowStore,
      });

      // Content height = 99998 * 28 + 100 + 200 = 2799944 + 300 = 2800244
      expect(engine.contentHeight).toBe(99998 * 28 + 100 + 200);
      // Row 50000 should be at sum of preceding rows
      expect(engine.getRowAtY(engine.getRowY(50000))).toBe(50000);
      expect(engine.getRowHeight(50000)).toBe(100);
      // Row lookup for modified row
      expect(engine.getRowAtY(engine.getRowY(99999))).toBe(99999);
      expect(engine.getRowHeight(99999)).toBe(200);
    });
  });

  describe('GridGeometry with row position data', () => {
    it('getRowY and getRowHeight use provided arrays', () => {
      const rowPositions = new Float64Array([0, 28, 88, 116]);
      const rowHeights = new Float64Array([28, 60, 28]);

      const geom = new GridGeometry({
        columns: makeColumns([100]),
        theme: lightTheme,
        showRowNumbers: true,
        rowPositions,
        rowHeights,
      });

      expect(geom.getRowY(0)).toBe(0);
      expect(geom.getRowY(1)).toBe(28);
      expect(geom.getRowY(2)).toBe(88);
      // Sentinel: rowPositions[3] = contentHeight
      expect(geom.getRowY(3)).toBe(116);
      expect(geom.getRowHeight(0)).toBe(28);
      expect(geom.getRowHeight(1)).toBe(60);
      expect(geom.getRowHeight(2)).toBe(28);
    });

    it('falls back to uniform heights without row data', () => {
      const geom = new GridGeometry({
        columns: makeColumns([100]),
        theme: lightTheme,
        showRowNumbers: true,
      });

      // Default theme rowHeight
      const defaultH = lightTheme.dimensions.rowHeight;
      expect(geom.getRowY(5)).toBe(5 * defaultH);
      expect(geom.getRowHeight(5)).toBe(defaultH);
    });

    it('computeCellRect uses variable row heights', () => {
      const rowPositions = new Float64Array([0, 28, 88, 116]);
      const rowHeights = new Float64Array([28, 60, 28]);

      const geom = new GridGeometry({
        columns: makeColumns([100, 120]),
        theme: lightTheme,
        showRowNumbers: true,
        rowPositions,
        rowHeights,
      });

      const headerH = lightTheme.dimensions.headerHeight;
      const rnW = lightTheme.dimensions.rowNumberWidth;

      // Row 1, col 0: y = headerH + 28, h = 60
      const rect = geom.computeCellRect(1, 0);
      expect(rect.y).toBe(headerH + 28);
      expect(rect.height).toBe(60);
      expect(rect.x).toBe(rnW);
      expect(rect.width).toBe(100);
    });

    it('setRowData updates row position data', () => {
      const geom = new GridGeometry({
        columns: makeColumns([100]),
        theme: lightTheme,
        showRowNumbers: true,
      });

      // Initially uses fallback
      const defaultH = lightTheme.dimensions.rowHeight;
      expect(geom.getRowHeight(0)).toBe(defaultH);

      // Set row data
      const rowPositions = new Float64Array([0, 50, 80]);
      const rowHeights = new Float64Array([50, 30]);
      geom.setRowData(rowPositions, rowHeights);

      expect(geom.getRowHeight(0)).toBe(50);
      expect(geom.getRowHeight(1)).toBe(30);
      expect(geom.getRowY(1)).toBe(50);
    });
  });
});
