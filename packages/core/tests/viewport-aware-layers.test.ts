import { describe, it, expect, vi } from 'vitest';
import { GridLinesLayer } from '../src/renderer/layers/grid-lines-layer';
import { HeaderLayer } from '../src/renderer/layers/header-layer';
import { RowNumberLayer } from '../src/renderer/layers/row-number-layer';
import { CellTextLayer } from '../src/renderer/layers/cell-text-layer';
import { BackgroundLayer } from '../src/renderer/layers/background-layer';
import { EmptyStateLayer } from '../src/renderer/layers/empty-state-layer';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { TextMeasureCache } from '../src/renderer/text-measure-cache';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { lightTheme } from '../src/themes/built-in-themes';
import type { RenderContext } from '../src/renderer/render-layer';
import type { ViewportRange } from '../src/renderer/viewport-manager';
import type { RenderMode } from '../src/renderer/render-layer';
import type { ColumnDef } from '../src/types/interfaces';

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    canvas: {} as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

function makeColumns(count: number, width = 100): ColumnDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width,
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

function makeViewport(
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): ViewportRange {
  return {
    startRow,
    endRow,
    startCol,
    endCol,
    visibleRowCount: endRow - startRow + 1,
    visibleColCount: endCol - startCol + 1,
  };
}

function makeRenderContext(
  ctx: CanvasRenderingContext2D,
  geometry: GridGeometry,
  viewport: ViewportRange,
  scrollX = 0,
  scrollY = 0,
  renderMode: RenderMode = 'full',
): RenderContext {
  return {
    ctx,
    geometry,
    theme: lightTheme,
    canvasWidth: 800,
    canvasHeight: 600,
    viewport,
    scrollX,
    scrollY,
    renderMode,
  };
}

describe('Fixed positioning and content clipping', () => {
  describe('HeaderLayer — fixed at top', () => {
    it('renders header at y=0 regardless of scrollY', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Scroll down by 200px — header should still be at y=0
      const viewport = makeViewport(7, 12, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport, 0, 200);

      new HeaderLayer().render(rc);

      // Header background at y=0 (not -200)
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      const headerBgCall = fillRectCalls.find(
        ([x, y, w, h]) => x === 0 && y === 0 && w === 800 && h === lightTheme.dimensions.headerHeight,
      );
      expect(headerBgCall).toBeDefined();
    });

    it('scrolls column text horizontally with scrollX', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(5, 100);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      const viewport = makeViewport(0, 5, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport, 50, 0);

      new HeaderLayer().render(rc);

      // Column text x positions should be offset by -scrollX
      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      // Column 1 center: 100 + 50 - 50 = 100 (x=100 + width/2=50 - scrollX=50)
      const col1Text = fillTextCalls.find(([text]) => text === 'Column 1');
      expect(col1Text).toBeDefined();
      expect(col1Text![1]).toBe(100 + 50 - 50); // cr.x + cr.width/2 - scrollX
    });
  });

  describe('RowNumberLayer — fixed at left', () => {
    it('renders row numbers at x=0 regardless of scrollX', () => {
      const ctx = createMockCtx();
      const geometry = new GridGeometry({
        columns: makeColumns(3),
        theme: lightTheme,
        showRowNumbers: true,
      });

      // Scroll right by 100px — row numbers should still be at x center = rnWidth/2
      const viewport = makeViewport(0, 3, 2, 4);
      const rc = makeRenderContext(ctx, geometry, viewport, 100, 0);

      new RowNumberLayer().render(rc);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const rnWidth = lightTheme.dimensions.rowNumberWidth;
      // All row number x positions should be at rnWidth/2 (not shifted by scrollX)
      for (const call of fillTextCalls) {
        expect(call[1]).toBe(rnWidth / 2);
      }
    });

    it('clips row numbers to below header area', () => {
      const ctx = createMockCtx();
      const geometry = new GridGeometry({
        columns: makeColumns(3),
        theme: lightTheme,
        showRowNumbers: true,
      });

      const viewport = makeViewport(0, 5, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport, 0, 0);

      new RowNumberLayer().render(rc);

      // Should have clip rect starting at headerHeight
      const rectCalls = (ctx.rect as ReturnType<typeof vi.fn>).mock.calls;
      const headerHeight = lightTheme.dimensions.headerHeight;
      const rnWidth = lightTheme.dimensions.rowNumberWidth;
      const clipCall = rectCalls.find(
        ([x, y, _w, _h]) => x === 0 && y === headerHeight,
      );
      expect(clipCall).toBeDefined();
      expect(clipCall![2]).toBe(rnWidth); // width = rnWidth
    });
  });

  describe('CellTextLayer — content area clipping', () => {
    it('clips cells to content area excluding header and gutter', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: true,
      });

      const viewport = makeViewport(0, 4, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport, 0, 0);

      new CellTextLayer(cellStore, new DataView({ totalRowCount: 1000 }), new TextMeasureCache()).render(rc);

      // First rect call should be the content area clip
      const rectCalls = (ctx.rect as ReturnType<typeof vi.fn>).mock.calls;
      const headerHeight = lightTheme.dimensions.headerHeight;
      const rnWidth = lightTheme.dimensions.rowNumberWidth;
      const contentClip = rectCalls[0];
      expect(contentClip[0]).toBe(rnWidth); // x = rnWidth
      expect(contentClip[1]).toBe(headerHeight); // y = headerHeight
      expect(contentClip[2]).toBe(800 - rnWidth); // width = canvasWidth - rnWidth
      expect(contentClip[3]).toBe(600 - headerHeight); // height = canvasHeight - headerHeight
    });
  });

  describe('GridLinesLayer — fixed gutter border', () => {
    it('draws gutter border at fixed x position regardless of scrollX', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(5);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: true,
      });

      // Scroll right by 100px — gutter border should stay at rnWidth
      const viewport = makeViewport(0, 5, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport, 100, 0);

      new GridLinesLayer().render(rc);

      const moveToArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const rnWidth = lightTheme.dimensions.rowNumberWidth;
      // Gutter border should be at rnWidth + 0.5 (not rnWidth - 100 + 0.5)
      const gutterBorder = moveToArgs.find(([x, y]) => x === rnWidth + 0.5 && y === 0);
      expect(gutterBorder).toBeDefined();
    });
  });
});

describe('Viewport-aware render layers', () => {
  describe('BackgroundLayer', () => {
    it('fills entire canvas regardless of viewport', () => {
      const ctx = createMockCtx();
      const geometry = new GridGeometry({
        columns: makeColumns(5),
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(5, 10, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new BackgroundLayer().render(rc);

      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('GridLinesLayer', () => {
    it('draws horizontal lines only for visible rows', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // 100 rows total, viewport shows rows 5-10
      const viewport = makeViewport(5, 10, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer().render(rc);

      // moveTo calls include horizontal lines (rows 5-11) and vertical lines (cols 0-2)
      const moveToArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const horizontalLineYs = moveToArgs
        .filter(([x]) => x === 0) // horizontal lines start at x=0
        .map(([, y]) => y);

      const headerHeight = lightTheme.dimensions.headerHeight;
      const rowHeight = lightTheme.dimensions.rowHeight;

      // Should have lines for rows 5 through 11 (endRow+1)
      for (let r = 5; r <= 11; r++) {
        const expectedY = headerHeight + r * rowHeight + 0.5;
        expect(horizontalLineYs).toContain(expectedY);
      }

      // Should NOT have lines for row 0 through 4
      for (let r = 0; r < 5; r++) {
        const unexpectedY = headerHeight + r * rowHeight + 0.5;
        expect(horizontalLineYs).not.toContain(unexpectedY);
      }
    });

    it('draws vertical lines only for visible columns', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(10, 80);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Viewport shows cols 3-6
      const viewport = makeViewport(0, 5, 3, 6);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer().render(rc);

      const moveToArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const headerHeight = lightTheme.dimensions.headerHeight;

      // Vertical lines start at y=headerHeight, pick those
      const verticalLineXs = moveToArgs
        .filter(([, y]) => y === headerHeight)
        .map(([x]) => x);

      // Columns 3-6 right edges: (3+1)*80+0.5, (4+1)*80+0.5, (5+1)*80+0.5, (6+1)*80+0.5
      expect(verticalLineXs).toContain(4 * 80 + 0.5);
      expect(verticalLineXs).toContain(5 * 80 + 0.5);
      expect(verticalLineXs).toContain(6 * 80 + 0.5);
      expect(verticalLineXs).toContain(7 * 80 + 0.5);

      // Should NOT have vertical lines for columns 0-2
      expect(verticalLineXs).not.toContain(1 * 80 + 0.5);
      expect(verticalLineXs).not.toContain(2 * 80 + 0.5);
    });
  });

  describe('HeaderLayer', () => {
    it('draws header text only for visible columns', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(10);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Viewport shows cols 2-4
      const viewport = makeViewport(0, 5, 2, 4);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new HeaderLayer().render(rc);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const headerTexts = fillTextCalls.map(([text]) => text);

      // Only columns 2, 3, 4 should have their titles drawn
      expect(headerTexts).toContain('Column 2');
      expect(headerTexts).toContain('Column 3');
      expect(headerTexts).toContain('Column 4');

      // Columns 0, 1, 5-9 should NOT be drawn
      expect(headerTexts).not.toContain('Column 0');
      expect(headerTexts).not.toContain('Column 1');
      expect(headerTexts).not.toContain('Column 5');
    });
  });

  describe('RowNumberLayer', () => {
    it('draws row numbers only for visible rows', () => {
      const ctx = createMockCtx();
      const geometry = new GridGeometry({
        columns: makeColumns(3),
        theme: lightTheme,
        showRowNumbers: true,
      });

      // Viewport shows rows 5-8 (1-based: 6-9)
      const viewport = makeViewport(5, 8, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new RowNumberLayer().render(rc);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const rowNumbers = fillTextCalls.map(([text]) => text);

      // Row numbers are 1-based: 6, 7, 8, 9
      expect(rowNumbers).toContain('6');
      expect(rowNumbers).toContain('7');
      expect(rowNumbers).toContain('8');
      expect(rowNumbers).toContain('9');

      // Should NOT have row numbers 1-5
      expect(rowNumbers).not.toContain('1');
      expect(rowNumbers).not.toContain('2');
      expect(rowNumbers).not.toContain('3');
      expect(rowNumbers).not.toContain('4');
      expect(rowNumbers).not.toContain('5');
    });

    it('skips rendering when rowNumberWidth is 0', () => {
      const ctx = createMockCtx();
      const geometry = new GridGeometry({
        columns: makeColumns(3),
        theme: lightTheme,
        showRowNumbers: false,
      });

      const viewport = makeViewport(0, 5, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new RowNumberLayer().render(rc);

      expect(ctx.fillText).not.toHaveBeenCalled();
    });
  });

  describe('CellTextLayer', () => {
    it('draws text only for visible cells', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(5);
      const cellStore = makeCellStore(20, columns);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Viewport shows rows 3-6, cols 1-3
      const viewport = makeViewport(3, 6, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(cellStore, new DataView({ totalRowCount: 1000 }), new TextMeasureCache()).render(rc);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const cellTexts = fillTextCalls.map(([text]) => text);

      // Should have cells for rows 3-6, cols 1-3
      expect(cellTexts).toContain('R3Ccol1');
      expect(cellTexts).toContain('R3Ccol2');
      expect(cellTexts).toContain('R3Ccol3');
      expect(cellTexts).toContain('R6Ccol3');

      // Should NOT have cells from row 0 or col 0
      expect(cellTexts).not.toContain('R0Ccol0');
      expect(cellTexts).not.toContain('R0Ccol1');
      expect(cellTexts).not.toContain('R3Ccol0');

      // Should NOT have cells from row 7+ or col 4+
      expect(cellTexts).not.toContain('R7Ccol1');
      expect(cellTexts).not.toContain('R3Ccol4');
    });

    it('renders exactly the right number of cells', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(5);
      const cellStore = makeCellStore(20, columns);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Viewport: 4 rows × 3 cols = 12 cells
      const viewport = makeViewport(3, 6, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(cellStore, new DataView({ totalRowCount: 1000 }), new TextMeasureCache()).render(rc);

      // Each cell does save + beginPath + rect + clip + fillText + restore
      // fillText called once per cell
      expect(ctx.fillText).toHaveBeenCalledTimes(12);
    });

    it('handles viewport beyond data range gracefully', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Viewport extends beyond data (rows 3-10, but only 5 rows exist)
      const viewport = makeViewport(3, 10, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(cellStore, new DataView({ totalRowCount: 1000 }), new TextMeasureCache()).render(rc);

      // Only rows 3-4 have data (rows 5-10 are undefined)
      expect(ctx.fillText).toHaveBeenCalledTimes(2 * 3); // 2 rows × 3 cols
    });
  });

  describe('GridLinesLayer — phantom lines when 0 rows', () => {
    it('draws horizontal grid lines even when viewport has no rows', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      // Empty viewport: endRow < startRow means 0 visible rows
      const viewport: ViewportRange = {
        startRow: 0,
        endRow: -1,
        startCol: 0,
        endCol: 2,
        visibleRowCount: 0,
        visibleColCount: 3,
      };
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer().render(rc);

      // moveTo should be called multiple times for phantom horizontal lines
      const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      // Should have at least some horizontal lines filling the 600px canvas
      expect(moveToCalls.length).toBeGreaterThan(3);
    });
  });

  describe('EmptyStateLayer', () => {
    it('renders "No data" text when viewport has 0 rows', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      const viewport: ViewportRange = {
        startRow: 0,
        endRow: -1,
        startCol: 0,
        endCol: 2,
        visibleRowCount: 0,
        visibleColCount: 3,
      };
      const rc = makeRenderContext(ctx, geometry, viewport);

      new EmptyStateLayer().render(rc);

      expect(ctx.fillText).toHaveBeenCalledWith('No data', expect.any(Number), expect.any(Number));
    });

    it('does not render when rows are visible', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });

      const viewport = makeViewport(0, 5, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new EmptyStateLayer().render(rc);

      expect(ctx.fillText).not.toHaveBeenCalled();
    });
  });
});
