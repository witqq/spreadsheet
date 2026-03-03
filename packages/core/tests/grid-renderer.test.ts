import { describe, it, expect } from 'vitest';
import { GridRenderer } from '../src/renderer/grid-renderer';
import { CellStore } from '../src/model/cell-store';
import { lightTheme } from '../src/themes/built-in-themes';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(widths: number[]): ColumnDef[] {
  return widths.map((w, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: w,
  }));
}

function makeCellStore(rows: number, cols: ColumnDef[]): CellStore {
  const store = new CellStore();
  const data: Record<string, unknown>[] = Array.from({ length: rows }, (_, r) => {
    const row: Record<string, unknown> = {};
    for (const col of cols) {
      row[col.key] = `R${r}C${col.key}`;
    }
    return row;
  });
  if (data.length > 0) {
    store.bulkLoad(data, cols.map((c) => c.key));
  }
  return store;
}

describe('GridRenderer', () => {
  describe('computeColumnRects', () => {
    it('computes correct x positions for columns without row numbers', () => {
      const columns = makeColumns([100, 150, 80]);
      const renderer = new GridRenderer({
        columns,
        cellStore: new CellStore(),
        rowCount: 0,
        theme: lightTheme,
        showRowNumbers: false,
        showGridLines: true,
      });

      const rects = renderer.computeColumnRects();

      expect(rects).toHaveLength(3);
      expect(rects[0]).toEqual({ x: 0, y: 0, width: 100, height: lightTheme.dimensions.headerHeight });
      expect(rects[1]).toEqual({ x: 100, y: 0, width: 150, height: lightTheme.dimensions.headerHeight });
      expect(rects[2]).toEqual({ x: 250, y: 0, width: 80, height: lightTheme.dimensions.headerHeight });
    });

    it('offsets x by row number width when showRowNumbers is true', () => {
      const columns = makeColumns([100, 150]);
      const renderer = new GridRenderer({
        columns,
        cellStore: new CellStore(),
        rowCount: 0,
        theme: lightTheme,
        showRowNumbers: true,
        showGridLines: true,
      });

      const rects = renderer.computeColumnRects();

      expect(rects[0].x).toBe(lightTheme.dimensions.rowNumberWidth);
      expect(rects[1].x).toBe(lightTheme.dimensions.rowNumberWidth + 100);
    });

    it('skips hidden columns', () => {
      const columns: ColumnDef[] = [
        { key: 'a', title: 'A', width: 100 },
        { key: 'b', title: 'B', width: 150, hidden: true },
        { key: 'c', title: 'C', width: 80 },
      ];
      const renderer = new GridRenderer({
        columns,
        cellStore: new CellStore(),
        rowCount: 0,
        theme: lightTheme,
        showRowNumbers: false,
        showGridLines: true,
      });

      const rects = renderer.computeColumnRects();

      expect(rects).toHaveLength(2);
      expect(rects[0]).toEqual({ x: 0, y: 0, width: 100, height: lightTheme.dimensions.headerHeight });
      expect(rects[1]).toEqual({ x: 100, y: 0, width: 80, height: lightTheme.dimensions.headerHeight });
    });
  });

  describe('computeCellRect', () => {
    it('computes correct cell rectangle for given row and col', () => {
      const columns = makeColumns([100, 150, 80]);
      const cellStore = makeCellStore(5, columns);
      const renderer = new GridRenderer({
        columns,
        cellStore,
        rowCount: 5,
        theme: lightTheme,
        showRowNumbers: false,
        showGridLines: true,
      });

      const rect = renderer.computeCellRect(2, 1);

      expect(rect).toEqual({
        x: 100,
        y: lightTheme.dimensions.headerHeight + 2 * lightTheme.dimensions.rowHeight,
        width: 150,
        height: lightTheme.dimensions.rowHeight,
      });
    });

    it('returns zero-rect for out of bounds column index', () => {
      const columns = makeColumns([100]);
      const cellStore = makeCellStore(1, columns);
      const renderer = new GridRenderer({
        columns,
        cellStore,
        rowCount: 1,
        theme: lightTheme,
        showRowNumbers: false,
        showGridLines: true,
      });

      const rect = renderer.computeCellRect(0, 5);
      expect(rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe('computeAllCellRects', () => {
    it('produces correct 2D array of cell rectangles', () => {
      const columns = makeColumns([100, 80]);
      const cellStore = makeCellStore(3, columns);
      const renderer = new GridRenderer({
        columns,
        cellStore,
        rowCount: 3,
        theme: lightTheme,
        showRowNumbers: false,
        showGridLines: true,
      });

      const allRects = renderer.computeAllCellRects();

      expect(allRects).toHaveLength(3);
      expect(allRects[0]).toHaveLength(2);

      expect(allRects[0][0]).toEqual({
        x: 0,
        y: lightTheme.dimensions.headerHeight,
        width: 100,
        height: lightTheme.dimensions.rowHeight,
      });

      expect(allRects[1][1]).toEqual({
        x: 100,
        y: lightTheme.dimensions.headerHeight + lightTheme.dimensions.rowHeight,
        width: 80,
        height: lightTheme.dimensions.rowHeight,
      });

      expect(allRects[2][0]).toEqual({
        x: 0,
        y: lightTheme.dimensions.headerHeight + 2 * lightTheme.dimensions.rowHeight,
        width: 100,
        height: lightTheme.dimensions.rowHeight,
      });
    });

    it('accounts for row number gutter width', () => {
      const columns = makeColumns([120]);
      const cellStore = makeCellStore(1, columns);
      const renderer = new GridRenderer({
        columns,
        cellStore,
        rowCount: 1,
        theme: lightTheme,
        showRowNumbers: true,
        showGridLines: true,
      });

      const allRects = renderer.computeAllCellRects();
      expect(allRects[0][0].x).toBe(lightTheme.dimensions.rowNumberWidth);
    });
  });
});
