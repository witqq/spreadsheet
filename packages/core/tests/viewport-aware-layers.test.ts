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
    store.bulkLoad(
      data,
      cols.map((c) => c.key),
    );
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
        ([x, y, w, h]) =>
          x === 0 && y === 0 && w === 800 && h === lightTheme.dimensions.headerHeight,
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
      const clipCall = rectCalls.find(([x, y, _w, _h]) => x === 0 && y === headerHeight);
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

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

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
      const columns = makeColumns(5);
      const cellStore = new CellStore();
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(5, 10, 1, 3);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1000 })).render(rc);

      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('fills per-cell bgColor for styled cells', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // Set a cell with bgColor style
      cellStore.set(1, 1, {
        value: 'styled',
        style: { ref: 'bg1', style: { bgColor: '#ff0000' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1000 })).render(rc);

      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      // First call is canvas-wide theme fill
      expect(fillRectCalls[0]).toEqual([0, 0, 800, 600]);
      // Second call should be the per-cell bgColor fill
      expect(fillRectCalls.length).toBeGreaterThan(1);
      // Verify the fillStyle was set to #ff0000 before the per-cell fill
      const fillStyleSets = (ctx as unknown as { fillStyle: string }).fillStyle;
      // The last fillStyle set should be the per-cell color (since it was the last styled cell)
      expect(fillStyleSets).toBe('#ff0000');
    });

    it('does not fill bgColor for unstyled cells', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // No styled cells
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1000 })).render(rc);

      // Only 1 fillRect call (the canvas-wide fill)
      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
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
      const verticalLineXs = moveToArgs.filter(([, y]) => y === headerHeight).map(([x]) => x);

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

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

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

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

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

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      // Only rows 3-4 have data (rows 5-10 are undefined)
      expect(ctx.fillText).toHaveBeenCalledTimes(2 * 3); // 2 rows × 3 cols
    });

    it('uses per-cell textColor when defined', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = new CellStore();
      // Row 0: unstyled cell, Row 1: styled cell with textColor
      cellStore.set(0, 0, { value: 'plain' });
      cellStore.set(1, 0, {
        value: 'colored',
        style: { ref: 'tc1', style: { textColor: '#ff0000' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillTextCalls).toHaveLength(2);
      // Collect fillStyle values set before each fillText call
      // After rendering, ctx.fillStyle should reflect the last set value
      // The styled cell should have changed fillStyle to #ff0000
      expect(fillTextCalls[0][0]).toBe('plain');
      expect(fillTextCalls[1][0]).toBe('colored');
    });

    it('uses per-cell font overrides when defined', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'bold',
        style: { ref: 'f1', style: { fontWeight: 'bold', fontSize: 16 } },
      });
      cellStore.set(1, 0, { value: 'normal' });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      // Verify both cells rendered
      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillTextCalls).toHaveLength(2);
      expect(fillTextCalls[0][0]).toBe('bold');
      expect(fillTextCalls[1][0]).toBe('normal');
    });

    it('falls back to theme defaults for unstyled cells after styled cells', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      // First cell: custom color and font
      cellStore.set(0, 0, {
        value: 'styled',
        style: { ref: 's1', style: { textColor: '#00ff00', fontWeight: 'bold' } },
      });
      // Second cell: no style — should use theme defaults
      cellStore.set(1, 0, { value: 'default' });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      // Both cells should render successfully
      const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillTextCalls).toHaveLength(2);
      // After the styled cell, the unstyled cell should reset to theme defaults
      // ctx.fillStyle after render should be theme.colors.cellText (for the last cell)
      expect(ctx.fillStyle).toBe(lightTheme.colors.cellText);
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

  describe('CellTextLayer — style value assertions', () => {
    /**
     * Creates a mock ctx that captures fillStyle and font at each fillText call,
     * so we can verify the correct per-cell style was active when text rendered.
     */
    function createTrackingCtx() {
      const base = createMockCtx();
      const styleCaptures: { text: string; fillStyle: string; font: string }[] = [];
      base.fillText = vi.fn(function (this: typeof base, text: string) {
        styleCaptures.push({
          text,
          fillStyle: base.fillStyle,
          font: base.font,
        });
      }) as unknown as CanvasRenderingContext2D['fillText'];
      return { ctx: base as unknown as CanvasRenderingContext2D, styleCaptures };
    }

    it('sets ctx.fillStyle to per-cell textColor at fillText time', () => {
      const { ctx, styleCaptures } = createTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      cellStore.set(0, 0, { value: 'plain' });
      cellStore.set(1, 0, {
        value: 'red',
        style: { ref: 'tc1', style: { textColor: '#ff0000' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(styleCaptures).toHaveLength(2);
      expect(styleCaptures[0].text).toBe('plain');
      expect(styleCaptures[0].fillStyle).toBe(lightTheme.colors.cellText);
      expect(styleCaptures[1].text).toBe('red');
      expect(styleCaptures[1].fillStyle).toBe('#ff0000');
    });

    it('sets ctx.font to per-cell bold+fontSize override at fillText time', () => {
      const { ctx, styleCaptures } = createTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'bold-large',
        style: { ref: 'f1', style: { fontWeight: 'bold', fontSize: 16 } },
      });
      cellStore.set(1, 0, { value: 'normal' });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(styleCaptures).toHaveLength(2);
      // Bold cell: font should contain 'bold' and '16px'
      expect(styleCaptures[0].text).toBe('bold-large');
      expect(styleCaptures[0].font).toContain('bold');
      expect(styleCaptures[0].font).toContain('16px');
      // Normal cell: font should be the default theme font
      expect(styleCaptures[1].text).toBe('normal');
      expect(styleCaptures[1].font).toContain(`${lightTheme.fonts.cellSize}px`);
      expect(styleCaptures[1].font).not.toContain('bold');
    });

    it('builds italic font string from fontStyle override', () => {
      const { ctx, styleCaptures } = createTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'italic-text',
        style: { ref: 'it1', style: { fontStyle: 'italic' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(styleCaptures).toHaveLength(1);
      expect(styleCaptures[0].font).toContain('italic');
      expect(styleCaptures[0].font).toContain(`${lightTheme.fonts.cellSize}px`);
    });

    it('builds font with custom fontFamily override', () => {
      const { ctx, styleCaptures } = createTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'courier-text',
        style: { ref: 'ff1', style: { fontFamily: 'Courier New' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(styleCaptures).toHaveLength(1);
      expect(styleCaptures[0].font).toContain('Courier New');
      expect(styleCaptures[0].font).not.toContain(lightTheme.fonts.cell);
    });

    it('builds combined italic+bold+custom family font string', () => {
      const { ctx, styleCaptures } = createTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'all-overrides',
        style: {
          ref: 'combo1',
          style: {
            fontStyle: 'italic',
            fontWeight: 'bold',
            fontSize: 20,
            fontFamily: 'Georgia',
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1000 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(styleCaptures).toHaveLength(1);
      const font = styleCaptures[0].font;
      expect(font).toContain('italic');
      expect(font).toContain('bold');
      expect(font).toContain('20px');
      expect(font).toContain('Georgia');
      // Verify order: italic before bold, bold before size
      expect(font.indexOf('italic')).toBeLessThan(font.indexOf('bold'));
      expect(font.indexOf('bold')).toBeLessThan(font.indexOf('20px'));
    });
  });

  describe('BackgroundLayer — merged cell bgColor', () => {
    function createMergeManager(
      merges: { startRow: number; endRow: number; startCol: number; endCol: number }[],
    ) {
      const hiddenCells = new Set<string>();
      const anchorCells = new Map<string, (typeof merges)[0]>();

      for (const m of merges) {
        for (let r = m.startRow; r <= m.endRow; r++) {
          for (let c = m.startCol; c <= m.endCol; c++) {
            if (r === m.startRow && c === m.startCol) {
              anchorCells.set(`${r},${c}`, m);
            } else {
              hiddenCells.add(`${r},${c}`);
            }
          }
        }
      }

      return {
        isHiddenCell: (row: number, col: number) => hiddenCells.has(`${row},${col}`),
        isAnchorCell: (row: number, col: number) => anchorCells.has(`${row},${col}`),
        getMergedRegion: (row: number, col: number) => anchorCells.get(`${row},${col}`) ?? null,
      };
    }

    it('fills merged cell bgColor spanning multiple columns and rows', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(4);
      const cellStore = new CellStore();
      // Anchor cell at (1,1) with bgColor, merge spans 1:2 rows, 1:2 cols
      cellStore.set(1, 1, {
        value: 'merged',
        style: { ref: 'bg-merge', style: { bgColor: '#00ff00' } },
      });

      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const mergeManager = createMergeManager([{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }]);
      const viewport = makeViewport(0, 3, 0, 3);
      const rc = makeRenderContext(ctx, geometry, viewport);
      rc.mergeManager = mergeManager as RenderContext['mergeManager'];

      const dataView = new DataView({ totalRowCount: 1000 });
      new BackgroundLayer(cellStore, dataView).render(rc);

      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      // First call: canvas-wide theme fill
      expect(fillRectCalls[0]).toEqual([0, 0, 800, 600]);
      // Second call: merged cell bgColor fill — width spans 2 columns, height spans 2 rows
      expect(fillRectCalls).toHaveLength(2);
      const [, , mergedW, mergedH] = fillRectCalls[1];
      const expectedWidth = columns[1].width + columns[2].width; // 200px
      const expectedHeight = lightTheme.dimensions.rowHeight * 2;
      expect(mergedW).toBe(expectedWidth);
      expect(mergedH).toBe(expectedHeight);
      expect(ctx.fillStyle).toBe('#00ff00');
    });

    it('skips hidden cells in merged region', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = new CellStore();
      // Anchor cell at (0,0) with bgColor
      cellStore.set(0, 0, {
        value: 'anchor',
        style: { ref: 'bg-a', style: { bgColor: '#0000ff' } },
      });
      // Hidden cell (0,1) also has bgColor — should NOT render separately
      cellStore.set(0, 1, {
        value: 'hidden',
        style: { ref: 'bg-h', style: { bgColor: '#ff0000' } },
      });

      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const mergeManager = createMergeManager([{ startRow: 0, endRow: 0, startCol: 0, endCol: 1 }]);
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);
      rc.mergeManager = mergeManager as RenderContext['mergeManager'];

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1000 })).render(rc);

      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      // Canvas-wide fill + 1 merged anchor fill = 2 total (NOT 3)
      expect(fillRectCalls).toHaveLength(2);
      // The fill should be blue (anchor color), not red (hidden cell color)
      expect(ctx.fillStyle).toBe('#0000ff');
    });

    it('sets up lazy clip region before first per-cell bgColor fill', () => {
      const ctx = createMockCtx();
      const columns = makeColumns(3);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'styled',
        style: { ref: 'clip1', style: { bgColor: '#aabbcc' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: true,
      });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1000 })).render(rc);

      // Verify clip setup: save → beginPath → rect → clip happened
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.beginPath).toHaveBeenCalledTimes(1);
      expect(ctx.clip).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);

      // Verify clip rect bounds exclude header and row number areas
      const rectCalls = (ctx.rect as ReturnType<typeof vi.fn>).mock.calls;
      expect(rectCalls).toHaveLength(1);
      const [clipX, clipY, clipW, clipH] = rectCalls[0];
      expect(clipX).toBe(geometry.rowNumberWidth);
      expect(clipY).toBe(geometry.headerHeight);
      expect(clipW).toBe(800 - geometry.rowNumberWidth);
      expect(clipH).toBe(600 - geometry.headerHeight);
    });
  });

  describe('Edge cases — empty data and single row', () => {
    it('BackgroundLayer renders no per-cell fills when data is empty', () => {
      const ctx = createMockCtx();
      const cellStore = new CellStore();
      const geometry = new GridGeometry({
        columns: [],
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx as unknown as CanvasRenderingContext2D, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 0 })).render(rc);

      // Should fill entire background but never call save (no per-cell bgColor)
      expect(ctx.fillRect).toHaveBeenCalledTimes(1); // only full background fill
      expect(ctx.save).not.toHaveBeenCalled();
    });

    it('BackgroundLayer renders single row with bgColor correctly', () => {
      const columns = makeColumns(1);
      const ctx = createMockCtx();
      const cellStore = new CellStore();
      cellStore.set(0, 0, { value: 'X', style: { ref: 's1', style: { bgColor: '#ff0000' } } });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx as unknown as CanvasRenderingContext2D, geometry, viewport);

      new BackgroundLayer(cellStore, new DataView({ totalRowCount: 1 })).render(rc);

      // Should have background fill + per-cell fill
      const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(2);
      // Should have set fillStyle to red for per-cell bg
      expect(ctx.fillStyle).toBe('#ff0000');
    });

    it('CellTextLayer renders nothing for empty data viewport', () => {
      const ctx = createMockCtx();
      const cellStore = new CellStore();
      const geometry = new GridGeometry({
        columns: [],
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx as unknown as CanvasRenderingContext2D, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 0 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('CellTextLayer renders single styled cell correctly', () => {
      const columns = makeColumns(1);
      const ctx = createMockCtx();
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'Hello',
        style: { ref: 's1', style: { textColor: '#0000ff', fontWeight: 'bold' } },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx as unknown as CanvasRenderingContext2D, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillStyle).toBe('#0000ff');
      expect(ctx.font).toContain('bold');
    });
  });

  describe('CellTextLayer — per-cell textAlign', () => {
    function createPositionTrackingCtx() {
      const base = createMockCtx();
      const captures: { text: string; x: number; y: number; textAlign: string }[] = [];
      base.fillText = vi.fn(function (this: typeof base, text: string, x: number, y: number) {
        captures.push({ text, x, y, textAlign: base.textAlign });
      }) as unknown as CanvasRenderingContext2D['fillText'];
      return { ctx: base as unknown as CanvasRenderingContext2D, captures };
    }

    it('uses per-cell textAlign override instead of type default', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns = makeColumns(1);
      const cellStore = new CellStore();
      // String type defaults to 'left' alignment
      cellStore.set(0, 0, {
        value: 'right-aligned',
        style: { ref: 'ta1', style: { textAlign: 'right' } },
      });
      cellStore.set(1, 0, { value: 'default-left' });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 2 }),
        new TextMeasureCache(),
      ).render(rc);

      const rightCell = captures.find((c) => c.text === 'right-aligned');
      const leftCell = captures.find((c) => c.text === 'default-left');
      expect(rightCell).toBeDefined();
      expect(rightCell!.textAlign).toBe('right');
      expect(leftCell).toBeDefined();
      expect(leftCell!.textAlign).toBe('left');
    });

    it('center-aligns text when textAlign is center', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns = makeColumns(1, 200);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'centered',
        style: { ref: 'ta2', style: { textAlign: 'center' } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      const cell = captures.find((c) => c.text === 'centered');
      expect(cell).toBeDefined();
      expect(cell!.textAlign).toBe('center');
      // Center-aligned text should be at cellX + cellWidth / 2
      expect(cell!.x).toBe(100); // 0 + 200/2
    });
  });

  describe('CellTextLayer — per-cell verticalAlign', () => {
    function createPositionTrackingCtx() {
      const base = createMockCtx();
      const captures: { text: string; x: number; y: number }[] = [];
      base.fillText = vi.fn(function (this: typeof base, text: string, x: number, y: number) {
        captures.push({ text, x, y });
      }) as unknown as CanvasRenderingContext2D['fillText'];
      return { ctx: base as unknown as CanvasRenderingContext2D, captures };
    }

    it('positions text at top when verticalAlign is top', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      // Two columns in same row — compare vertical positions
      const columns = makeColumns(2);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'top-text',
        style: { ref: 'va1', style: { verticalAlign: 'top' } },
      });
      cellStore.set(0, 1, { value: 'middle-text' });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 1);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      const topCell = captures.find((c) => c.text === 'top-text');
      const middleCell = captures.find((c) => c.text === 'middle-text');
      expect(topCell).toBeDefined();
      expect(middleCell).toBeDefined();
      // Same row: top-aligned text y should be less than middle-aligned y
      expect(topCell!.y).toBeLessThan(middleCell!.y);
    });

    it('positions text at bottom when verticalAlign is bottom', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      // Two columns in same row — compare vertical positions
      const columns = makeColumns(2);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'bottom-text',
        style: { ref: 'va2', style: { verticalAlign: 'bottom' } },
      });
      cellStore.set(0, 1, { value: 'middle-text' });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 1);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      const bottomCell = captures.find((c) => c.text === 'bottom-text');
      const middleCell = captures.find((c) => c.text === 'middle-text');
      expect(bottomCell).toBeDefined();
      expect(middleCell).toBeDefined();
      // Same row: bottom-aligned y should be greater than middle-aligned y
      expect(bottomCell!.y).toBeGreaterThan(middleCell!.y);
    });
  });

  describe('CellTextLayer — per-cell textWrap', () => {
    function createPositionTrackingCtx() {
      const base = createMockCtx();
      // measureText must return realistic widths for wrapping to work
      base.measureText = vi.fn().mockImplementation((text: string) => ({
        width: text.length * 7,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }));
      const captures: { text: string; x: number; y: number }[] = [];
      base.fillText = vi.fn(function (this: typeof base, text: string, x: number, y: number) {
        captures.push({ text, x, y });
      }) as unknown as CanvasRenderingContext2D['fillText'];
      return { ctx: base as unknown as CanvasRenderingContext2D, captures };
    }

    it('wraps text when per-cell textWrap is true even if column wrapText is false', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      // Narrow column to force wrapping
      const columns: ColumnDef[] = [{ key: 'col0', title: 'Col', width: 60 }];
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'This is a long text that should wrap',
        style: { ref: 'tw1', style: { textWrap: true } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      // With wrapping, text should be rendered as multiple lines (multiple fillText calls)
      expect(captures.length).toBeGreaterThan(1);
    });

    it('does not wrap text when per-cell textWrap is not set and column wrapText is false', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns: ColumnDef[] = [{ key: 'col0', title: 'Col', width: 60 }];
      const cellStore = new CellStore();
      cellStore.set(0, 0, { value: 'This is a long text that should not wrap' });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      // Without wrapping, should be single line (1 fillText call)
      expect(captures).toHaveLength(1);
    });

    it('per-cell textWrap false overrides column wrapText true', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns: ColumnDef[] = [{ key: 'col0', title: 'Col', width: 60, wrapText: true }];
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'This is a long text that should not wrap despite column setting',
        style: { ref: 'tw-off', style: { textWrap: false } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      ).render(rc);

      // Per-cell textWrap:false disables column wrapping — single fillText call
      expect(captures).toHaveLength(1);
    });

    it('measureHeights accounts for per-cell textWrap', () => {
      const ctx = createMockCtx();
      ctx.measureText = vi.fn().mockImplementation((text: string) => ({
        width: text.length * 7,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }));
      const columns: ColumnDef[] = [{ key: 'col0', title: 'Col', width: 60 }];
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'A long text that wraps across multiple lines for height measurement',
        style: { ref: 'tw2', style: { textWrap: true } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      const layer = new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 1 }),
        new TextMeasureCache(),
      );
      const heights = layer.measureHeights(rc);

      // Should have a height entry for row 0 since per-cell textWrap is enabled
      expect(heights.has(0)).toBe(true);
      expect(heights.get(0)!).toBeGreaterThan(0);
    });
  });

  describe('CellTextLayer — per-cell indent', () => {
    function createPositionTrackingCtx() {
      const base = createMockCtx();
      const captures: { text: string; x: number; y: number }[] = [];
      base.fillText = vi.fn(function (this: typeof base, text: string, x: number, y: number) {
        captures.push({ text, x, y });
      }) as unknown as CanvasRenderingContext2D['fillText'];
      return { ctx: base as unknown as CanvasRenderingContext2D, captures };
    }

    it('shifts left-aligned text rightward by indent * padding', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns = makeColumns(1, 200);
      const cellStore = new CellStore();
      cellStore.set(0, 0, { value: 'no-indent' });
      cellStore.set(1, 0, {
        value: 'indented',
        style: { ref: 'ind1', style: { indent: 2 } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 2 }),
        new TextMeasureCache(),
      ).render(rc);

      const noIndent = captures.find((c) => c.text === 'no-indent');
      const indented = captures.find((c) => c.text === 'indented');
      expect(noIndent).toBeDefined();
      expect(indented).toBeDefined();
      // Indented text should have a larger x position
      const padding = lightTheme.dimensions.cellPadding;
      expect(indented!.x).toBe(noIndent!.x + 2 * padding);
    });

    it('indent does not affect right-aligned text x position', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns = makeColumns(1, 200);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'right-no-indent',
        style: { ref: 'ri1', style: { textAlign: 'right' } },
      });
      cellStore.set(1, 0, {
        value: 'right-indented',
        style: { ref: 'ri2', style: { textAlign: 'right', indent: 3 } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 2 }),
        new TextMeasureCache(),
      ).render(rc);

      const noIndent = captures.find((c) => c.text === 'right-no-indent');
      const indented = captures.find((c) => c.text === 'right-indented');
      expect(noIndent).toBeDefined();
      expect(indented).toBeDefined();
      // Right-aligned: x should be at cellWidth - padding regardless of indent
      expect(indented!.x).toBe(noIndent!.x);
    });

    it('indent does not affect center-aligned text x position', () => {
      const { ctx, captures } = createPositionTrackingCtx();
      const columns = makeColumns(1, 200);
      const cellStore = new CellStore();
      cellStore.set(0, 0, {
        value: 'center-no-indent',
        style: { ref: 'ci1', style: { textAlign: 'center' } },
      });
      cellStore.set(1, 0, {
        value: 'center-indented',
        style: { ref: 'ci2', style: { textAlign: 'center', indent: 3 } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 2 }),
        new TextMeasureCache(),
      ).render(rc);

      const noIndent = captures.find((c) => c.text === 'center-no-indent');
      const indented = captures.find((c) => c.text === 'center-indented');
      expect(noIndent).toBeDefined();
      expect(indented).toBeDefined();
      // Center-aligned: x at cellWidth/2 regardless of indent
      expect(indented!.x).toBe(noIndent!.x);
    });

    it('measureHeights accounts for indent reducing available width', () => {
      const ctx = createMockCtx();
      ctx.measureText = vi.fn().mockImplementation((text: string) => ({
        width: text.length * 7,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }));
      const columns: ColumnDef[] = [{ key: 'col0', title: 'Col', width: 80, wrapText: true }];
      const cellStore = new CellStore();
      const longText = 'Word wrap test text for indent measurement verification';
      cellStore.set(0, 0, { value: longText });
      cellStore.set(1, 0, {
        value: longText,
        style: { ref: 'ind2', style: { indent: 3 } },
      });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      const layer = new CellTextLayer(
        cellStore,
        new DataView({ totalRowCount: 2 }),
        new TextMeasureCache(),
      );
      const heights = layer.measureHeights(rc);

      // Indented row should need more height (less width = more lines)
      expect(heights.has(0)).toBe(true);
      expect(heights.has(1)).toBe(true);
      expect(heights.get(1)!).toBeGreaterThanOrEqual(heights.get(0)!);
    });
  });

  describe('GridLinesLayer — per-cell borders', () => {
    function createBorderTrackingCtx() {
      const base = createMockCtx();
      const strokes: Array<{
        strokeStyle: string;
        lineWidth: number;
        dash: number[];
        segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
      }> = [];
      let currentDash: number[] = [];
      let pendingSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      let lastMove = { x: 0, y: 0 };

      (base as unknown as Record<string, unknown>).setLineDash = vi.fn((dash: number[]) => {
        currentDash = [...dash];
      });
      (base as unknown as Record<string, unknown>).getLineDash = vi.fn().mockReturnValue([]);

      const origBeginPath = base.beginPath as ReturnType<typeof vi.fn>;
      (base as unknown as Record<string, unknown>).beginPath = vi.fn(() => {
        pendingSegments = [];
        origBeginPath();
      });

      (base as unknown as Record<string, unknown>).moveTo = vi.fn((x: number, y: number) => {
        lastMove = { x, y };
      });
      (base as unknown as Record<string, unknown>).lineTo = vi.fn((x: number, y: number) => {
        pendingSegments.push({ x1: lastMove.x, y1: lastMove.y, x2: x, y2: y });
        lastMove = { x, y };
      });

      const origStroke = base.stroke as ReturnType<typeof vi.fn>;
      (base as unknown as Record<string, unknown>).stroke = vi.fn(() => {
        if (pendingSegments.length > 0) {
          strokes.push({
            strokeStyle: base.strokeStyle,
            lineWidth: base.lineWidth,
            dash: [...currentDash],
            segments: [...pendingSegments],
          });
        }
        origStroke();
      });

      return { ctx: base as unknown as CanvasRenderingContext2D, strokes };
    }

    it('draws per-cell border with correct color and width', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // Set a red 2px solid border on all sides of cell (1, 1)
      cellStore.set(1, 1, {
        value: 'bordered',
        style: {
          ref: 'b1',
          style: {
            borderTop: { width: 2, color: '#ff0000', style: 'solid' },
            borderRight: { width: 2, color: '#ff0000', style: 'solid' },
            borderBottom: { width: 2, color: '#ff0000', style: 'solid' },
            borderLeft: { width: 2, color: '#ff0000', style: 'solid' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      // First stroke is the default grid lines; subsequent strokes are per-cell borders
      const borderStrokes = strokes.filter((s) => s.strokeStyle === '#ff0000' && s.lineWidth === 2);
      expect(borderStrokes.length).toBeGreaterThanOrEqual(1);
      // 4 edges total
      const totalSegments = borderStrokes.reduce((sum, s) => sum + s.segments.length, 0);
      expect(totalSegments).toBe(4);
    });

    it('renders dashed border with setLineDash', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      cellStore.set(2, 0, {
        value: 'dashed',
        style: {
          ref: 'd1',
          style: {
            borderTop: { width: 1, color: '#00ff00', style: 'dashed' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      const dashedStrokes = strokes.filter((s) => s.strokeStyle === '#00ff00' && s.dash.length > 0);
      expect(dashedStrokes.length).toBe(1);
      // dashed = [width*3, width*2] = [3, 2]
      expect(dashedStrokes[0].dash).toEqual([3, 2]);
    });

    it('renders dotted border with setLineDash', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      cellStore.set(0, 2, {
        value: 'dotted',
        style: {
          ref: 'dot1',
          style: {
            borderBottom: { width: 2, color: '#0000ff', style: 'dotted' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      const dottedStrokes = strokes.filter((s) => s.strokeStyle === '#0000ff' && s.dash.length > 0);
      expect(dottedStrokes.length).toBe(1);
      // dotted = [width, width*2] = [2, 4]
      expect(dottedStrokes[0].dash).toEqual([2, 4]);
    });

    it('resolves shared border conflict: thicker wins', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // Cell (1,1) has thin right border
      cellStore.set(1, 1, {
        value: 'thin-right',
        style: {
          ref: 'thin',
          style: {
            borderRight: { width: 1, color: '#aaaaaa', style: 'solid' },
          },
        },
      });
      // Cell (1,2) has thick left border at the same shared edge
      cellStore.set(1, 2, {
        value: 'thick-left',
        style: {
          ref: 'thick',
          style: {
            borderLeft: { width: 3, color: '#333333', style: 'solid' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      // The shared edge should use the thicker border (#333333 width 3)
      const thickStrokes = strokes.filter((s) => s.strokeStyle === '#333333' && s.lineWidth === 3);
      expect(thickStrokes.length).toBe(1);
      // The thin border should NOT appear at all (overwritten)
      const thinStrokes = strokes.filter((s) => s.strokeStyle === '#aaaaaa' && s.lineWidth === 1);
      expect(thinStrokes.length).toBe(0);
    });

    it('resolves equal-thickness conflict: rightmost/bottommost cell wins', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // Cell (1,0) has right border (blue)
      cellStore.set(1, 0, {
        value: 'left-cell',
        style: {
          ref: 'blue',
          style: {
            borderRight: { width: 2, color: '#0000ff', style: 'solid' },
          },
        },
      });
      // Cell (1,1) has left border (red) — same edge, same width
      cellStore.set(1, 1, {
        value: 'right-cell',
        style: {
          ref: 'red',
          style: {
            borderLeft: { width: 2, color: '#ff0000', style: 'solid' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      // Both borders are width 2 — cell (1,1) is rightmost, so red wins
      const redStrokes = strokes.filter((s) => s.strokeStyle === '#ff0000' && s.lineWidth === 2);
      expect(redStrokes.length).toBe(1);
      const blueStrokes = strokes.filter((s) => s.strokeStyle === '#0000ff' && s.lineWidth === 2);
      expect(blueStrokes.length).toBe(0);
    });

    it('cells without custom borders still render standard grid lines', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      // Only one cell has a border; others don't
      cellStore.set(0, 0, {
        value: 'bordered',
        style: {
          ref: 'b1',
          style: {
            borderTop: { width: 2, color: '#ff0000', style: 'solid' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      // Default grid lines are the first stroke (uses theme color)
      const defaultStroke = strokes.find((s) => s.strokeStyle === lightTheme.colors.gridLine);
      expect(defaultStroke).toBeDefined();
      expect(defaultStroke!.segments.length).toBeGreaterThan(0);
    });

    it('uses subpixel offset for crisp border rendering', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const cellStore = makeCellStore(5, columns);
      cellStore.set(0, 0, {
        value: 'bordered',
        style: {
          ref: 'b1',
          style: {
            borderTop: { width: 1, color: '#ff0000', style: 'solid' },
            borderLeft: { width: 1, color: '#00ff00', style: 'solid' },
          },
        },
      });
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const dv = new DataView({ totalRowCount: 5 });
      const rc = makeRenderContext(ctx, geometry, viewport);

      new GridLinesLayer(cellStore, dv).render(rc);

      // Find the border strokes
      const redStroke = strokes.find((s) => s.strokeStyle === '#ff0000');
      expect(redStroke).toBeDefined();
      // Horizontal border — y should have +0.5 offset
      const hSeg = redStroke!.segments[0];
      expect(hSeg.y1 % 1).toBeCloseTo(0.5, 5);

      const greenStroke = strokes.find((s) => s.strokeStyle === '#00ff00');
      expect(greenStroke).toBeDefined();
      // Vertical border — x should have +0.5 offset
      const vSeg = greenStroke!.segments[0];
      expect(vSeg.x1 % 1).toBeCloseTo(0.5, 5);
    });

    it('does not draw per-cell borders when cellStore is not provided', () => {
      const { ctx, strokes } = createBorderTrackingCtx();
      const columns = makeColumns(3);
      const geometry = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      const viewport = makeViewport(0, 4, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      // No cellStore — only default grid lines
      new GridLinesLayer().render(rc);

      // Only one stroke call (default grid lines)
      expect(strokes.length).toBe(1);
    });
  });
});
