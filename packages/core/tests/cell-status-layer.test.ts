import { describe, it, expect, vi } from 'vitest';
import { CellStatusLayer } from '../src/renderer/layers/cell-status-layer';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { lightTheme, darkTheme } from '../src/themes/built-in-themes';
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
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
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

describe('CellStatusLayer', () => {
  it('does nothing when no cells have status', () => {
    const ctx = createMockCtx();
    const store = new CellStore();
    store.setValue(0, 0, 'test');
    const columns = makeColumns(3);
    const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
    const viewport = makeViewport(0, 0, 0, 2);
    const rc = makeRenderContext(ctx, geometry, viewport);

    new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

    // save/restore called for clip region, but no fill/arc calls for indicators
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  describe('error indicator', () => {
    it('draws a triangle for error status', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'bad');
      store.setMetadata(0, 0, { status: 'error', errorMessage: 'Invalid' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // Triangle draws moveTo, lineTo, lineTo, closePath, fill
      const moveToCall = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
      const lineToCall = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;
      expect(moveToCall.length).toBe(1);
      expect(lineToCall.length).toBe(2);
      expect(ctx.closePath).toHaveBeenCalledTimes(1);
      expect(ctx.fill).toHaveBeenCalledTimes(1);
    });

    it('uses red color for error triangle', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'bad');
      store.setMetadata(0, 0, { status: 'error' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // fillStyle is set to error red before fill()
      expect(ctx.fillStyle).toBe('#e53935');
    });

    it('positions triangle at top-right corner of cell', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'bad');
      store.setMetadata(0, 0, { status: 'error' });
      const colWidth = 100;
      const columns = makeColumns(1, colWidth);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 0);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // moveTo should be at (cellX + colWidth, headerHeight + rowY)
      const moveToCall = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(moveToCall[0]).toBe(colWidth); // right edge of cell
      expect(moveToCall[1]).toBe(lightTheme.dimensions.headerHeight); // top of cell
    });
  });

  describe('changed indicator', () => {
    it('draws a dot for changed status', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'modified');
      store.setMetadata(0, 0, { status: 'changed' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // Dot draws arc, fill
      expect(ctx.arc).toHaveBeenCalledTimes(1);
      expect(ctx.fill).toHaveBeenCalledTimes(1);
    });

    it('uses changedIndicator theme color', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'modified');
      store.setMetadata(0, 0, { status: 'changed' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.fillStyle).toBe(lightTheme.colors.changedIndicator);
    });
  });

  describe('saved indicator', () => {
    it('draws a dot for saved status', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'saved');
      store.setMetadata(0, 0, { status: 'saved' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.arc).toHaveBeenCalledTimes(1);
      expect(ctx.fill).toHaveBeenCalledTimes(1);
    });

    it('uses savedIndicator theme color', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'saved');
      store.setMetadata(0, 0, { status: 'saved' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.fillStyle).toBe(lightTheme.colors.savedIndicator);
    });
  });

  describe('saving indicator', () => {
    it('draws same as changed (blue dot)', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'saving');
      store.setMetadata(0, 0, { status: 'saving' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.arc).toHaveBeenCalledTimes(1);
      expect(ctx.fillStyle).toBe(lightTheme.colors.changedIndicator);
    });
  });

  describe('viewport clipping', () => {
    it('clips to cell area excluding header and row numbers', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'err');
      store.setMetadata(0, 0, { status: 'error' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: true });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      const rectCalls = (ctx.rect as ReturnType<typeof vi.fn>).mock.calls;
      expect(rectCalls.length).toBe(1);
      // Clip region starts at (rowNumberWidth, headerHeight)
      expect(rectCalls[0][0]).toBe(lightTheme.dimensions.rowNumberWidth);
      expect(rectCalls[0][1]).toBe(lightTheme.dimensions.headerHeight);
    });

    it('applies scroll offset to indicator positions', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'err');
      store.setMetadata(0, 0, { status: 'error' });
      const columns = makeColumns(3, 100);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const scrollX = 30;
      const rc = makeRenderContext(ctx, geometry, viewport, scrollX, 0);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // Triangle top-right should be at (colWidth - scrollX)
      const moveToCall = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(moveToCall[0]).toBe(100 - scrollX); // right edge minus scroll
    });
  });

  describe('multiple statuses in viewport', () => {
    it('renders indicators for multiple cells with different statuses', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'bad');
      store.setMetadata(0, 0, { status: 'error' });
      store.setValue(0, 1, 'modified');
      store.setMetadata(0, 1, { status: 'changed' });
      store.setValue(1, 0, 'ok');
      store.setMetadata(1, 0, { status: 'saved' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 1, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      // 1 error (triangle: moveTo + 2 lineTo + fill) + 2 dots (arc + fill each)
      expect(ctx.moveTo).toHaveBeenCalledTimes(1); // triangle
      expect(ctx.arc).toHaveBeenCalledTimes(2); // 2 dots
      expect(ctx.fill).toHaveBeenCalledTimes(3); // all 3
    });
  });

  describe('dark theme', () => {
    it('uses same red error color in dark theme', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'bad');
      store.setMetadata(0, 0, { status: 'error' });
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: darkTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc: RenderContext = {
        ctx,
        geometry,
        theme: darkTheme,
        canvasWidth: 800,
        canvasHeight: 600,
        viewport,
        scrollX: 0,
        scrollY: 0,
        renderMode: 'full',
      };

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.fillStyle).toBe('#e53935');
    });
  });

  describe('cells without metadata', () => {
    it('skips cells with no data', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      // Empty store — no cells at all
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 2, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('skips cells with value but no metadata', () => {
      const ctx = createMockCtx();
      const store = new CellStore();
      store.setValue(0, 0, 'hello');
      const columns = makeColumns(3);
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: false });
      const viewport = makeViewport(0, 0, 0, 2);
      const rc = makeRenderContext(ctx, geometry, viewport);

      new CellStatusLayer(store, new DataView({ totalRowCount: 100 })).render(rc);

      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });
});
