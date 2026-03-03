import { describe, it, expect, vi } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ViewportManager } from '../src/renderer/viewport-manager';
import { RenderPipeline } from '../src/renderer/render-pipeline';
import { GridRenderer } from '../src/renderer/grid-renderer';
import { GridGeometry } from '../src/renderer/grid-geometry';
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

function makeLayout(
  widths: number[],
  rowCount: number,
  overrides?: Partial<{ rowHeight: number; headerHeight: number; rowNumberWidth: number }>,
) {
  return new LayoutEngine({
    columns: makeColumns(widths),
    rowCount,
    rowHeight: overrides?.rowHeight ?? 30,
    headerHeight: overrides?.headerHeight ?? 32,
    rowNumberWidth: overrides?.rowNumberWidth ?? 50,
  });
}

describe('Frozen Panes', () => {
  describe('LayoutEngine.getFrozenRowsHeight', () => {
    it('returns 0 for count <= 0', () => {
      const engine = makeLayout([100, 100], 10);
      expect(engine.getFrozenRowsHeight(0)).toBe(0);
      expect(engine.getFrozenRowsHeight(-1)).toBe(0);
    });

    it('returns 0 when count exceeds row count', () => {
      const engine = makeLayout([100], 5);
      expect(engine.getFrozenRowsHeight(6)).toBe(0);
    });

    it('returns correct height for frozen rows', () => {
      const engine = makeLayout([100, 100], 10, { rowHeight: 30 });
      expect(engine.getFrozenRowsHeight(1)).toBe(30);
      expect(engine.getFrozenRowsHeight(2)).toBe(60);
      expect(engine.getFrozenRowsHeight(3)).toBe(90);
    });

    it('handles all rows frozen', () => {
      const engine = makeLayout([100], 5, { rowHeight: 25 });
      expect(engine.getFrozenRowsHeight(5)).toBe(125);
    });
  });

  describe('LayoutEngine.getFrozenColsWidth', () => {
    it('returns 0 for count <= 0', () => {
      const engine = makeLayout([100, 120, 80], 5);
      expect(engine.getFrozenColsWidth(0)).toBe(0);
      expect(engine.getFrozenColsWidth(-1)).toBe(0);
    });

    it('returns 0 when count exceeds column count', () => {
      const engine = makeLayout([100, 120], 5);
      expect(engine.getFrozenColsWidth(3)).toBe(0);
    });

    it('returns correct width for frozen columns', () => {
      const engine = makeLayout([100, 120, 80], 5);
      expect(engine.getFrozenColsWidth(1)).toBe(100);
      expect(engine.getFrozenColsWidth(2)).toBe(220);
      expect(engine.getFrozenColsWidth(3)).toBe(300);
    });
  });

  describe('ViewportManager.computeFrozenRanges', () => {
    it('returns correct corner range', () => {
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);

      expect(ranges.corner.startRow).toBe(0);
      expect(ranges.corner.endRow).toBe(1);
      expect(ranges.corner.startCol).toBe(0);
      expect(ranges.corner.endCol).toBe(0);
      expect(ranges.corner.visibleRowCount).toBe(2);
      expect(ranges.corner.visibleColCount).toBe(1);
    });

    it('returns correct frozenRow range', () => {
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);

      expect(ranges.frozenRow.startRow).toBe(0);
      expect(ranges.frozenRow.endRow).toBe(1);
      // Frozen row strip starts at col 1 (after frozen col 0)
      expect(ranges.frozenRow.startCol).toBe(1);
    });

    it('returns correct frozenCol range', () => {
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);

      // Frozen col strip starts at row 2 (after frozen rows 0-1)
      expect(ranges.frozenCol.startRow).toBe(2);
      expect(ranges.frozenCol.startCol).toBe(0);
      expect(ranges.frozenCol.endCol).toBe(0);
    });

    it('returns correct main range', () => {
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);

      // Main starts after frozen rows and cols
      expect(ranges.main.startRow).toBe(2);
      expect(ranges.main.startCol).toBe(1);
    });

    it('handles frozenRows only (no frozen cols)', () => {
      const layout = makeLayout([100, 100, 100], 10, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 300, 600, 3, 0);

      // Corner has no cols
      expect(ranges.corner.endCol).toBe(-1);
      expect(ranges.corner.visibleColCount).toBe(0);

      // Frozen row includes all cols
      expect(ranges.frozenRow.startRow).toBe(0);
      expect(ranges.frozenRow.endRow).toBe(2);
      expect(ranges.frozenRow.startCol).toBe(0);

      // Frozen col strip has no cols
      expect(ranges.frozenCol.endCol).toBe(-1);

      // Main starts at row 3
      expect(ranges.main.startRow).toBe(3);
      expect(ranges.main.startCol).toBe(0);
    });

    it('handles frozenColumns only (no frozen rows)', () => {
      const layout = makeLayout([100, 100, 100], 10, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 300, 600, 0, 2);

      // Corner has no rows
      expect(ranges.corner.endRow).toBe(-1);
      expect(ranges.corner.visibleRowCount).toBe(0);

      // Frozen row strip has no rows
      expect(ranges.frozenRow.endRow).toBe(-1);

      // Frozen col strip includes all rows
      expect(ranges.frozenCol.startRow).toBe(0);
      expect(ranges.frozenCol.startCol).toBe(0);
      expect(ranges.frozenCol.endCol).toBe(1);

      // Main starts at col 2
      expect(ranges.main.startRow).toBe(0);
      expect(ranges.main.startCol).toBe(2);
    });

    it('handles scrolled position correctly', () => {
      // 10 cols × 100px, 50 rows × 30px
      const layout = makeLayout(
        Array(10).fill(100),
        50,
        { rowHeight: 30 },
      );
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // Scroll to (300, 450) — should show cols 3+ and rows 15+
      const ranges = vm.computeFrozenRanges(300, 450, 400, 300, 2, 2);

      // Corner is always rows 0-1, cols 0-1
      expect(ranges.corner.startRow).toBe(0);
      expect(ranges.corner.endRow).toBe(1);
      expect(ranges.corner.startCol).toBe(0);
      expect(ranges.corner.endCol).toBe(1);

      // Frozen row: rows 0-1, scrolled cols (starting from col 2+)
      expect(ranges.frozenRow.startRow).toBe(0);
      expect(ranges.frozenRow.endRow).toBe(1);
      expect(ranges.frozenRow.startCol).toBeGreaterThanOrEqual(2);

      // Frozen col: scrolled rows, cols 0-1
      expect(ranges.frozenCol.startRow).toBeGreaterThanOrEqual(2);
      expect(ranges.frozenCol.startCol).toBe(0);
      expect(ranges.frozenCol.endCol).toBe(1);

      // Main: scrolled rows, scrolled cols (both start after frozen)
      expect(ranges.main.startRow).toBeGreaterThanOrEqual(2);
      expect(ranges.main.startCol).toBeGreaterThanOrEqual(2);
    });

    it('with frozenRows=0 and frozenCols=0, main covers everything', () => {
      const layout = makeLayout([100, 100, 100], 10, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      const ranges = vm.computeFrozenRanges(0, 0, 300, 300, 0, 0);

      // No frozen regions
      expect(ranges.corner.endRow).toBe(-1);
      expect(ranges.corner.endCol).toBe(-1);
      expect(ranges.frozenRow.endRow).toBe(-1);
      expect(ranges.frozenCol.endCol).toBe(-1);

      // Main covers all visible
      expect(ranges.main.startRow).toBe(0);
      expect(ranges.main.startCol).toBe(0);
    });

    it('frozen counts exceeding data are clamped', () => {
      const layout = makeLayout([100, 100], 5, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // Request 10 frozen rows but only 5 exist
      const ranges = vm.computeFrozenRanges(0, 0, 200, 300, 10, 5);

      expect(ranges.corner.endRow).toBe(4); // clamped to 5 rows (0-4)
      expect(ranges.corner.endCol).toBe(1); // clamped to 2 cols (0-1)
    });
  });

  describe('RenderPipeline frozen rendering', () => {
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

    it('calls save/clip/restore per region when frozen config provided', () => {
      const columns = makeColumns([100, 100, 100, 100]);
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: true });
      const pipeline = new RenderPipeline(geometry, lightTheme);

      const mockLayer = { render: vi.fn() };
      pipeline.addLayer(mockLayer);

      const ctx = createMockCtx();

      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });
      const frozenRanges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);
      const viewport = vm.computeVisibleRange(0, 0, 400, 600);

      pipeline.render(ctx, viewport, 400, 600, 0, 0, 'full', {
        frozenRows: 2,
        frozenColumns: 1,
        layoutEngine: layout,
        frozenRanges,
      });

      // save/restore should be called for each region the layer renders in
      // 4 data regions + 2 header splits + 2 row number splits = 8 total
      expect(ctx.save.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(ctx.restore.mock.calls.length).toEqual(ctx.save.mock.calls.length);

      // clip should be called for each region
      expect(ctx.clip.mock.calls.length).toBeGreaterThanOrEqual(4);

      // layer.render called multiple times (once per region)
      expect(mockLayer.render.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it('passes different paneRegion values to layer for different regions', () => {
      const columns = makeColumns([100, 100, 100, 100]);
      const layout = makeLayout([100, 100, 100, 100], 20, { rowHeight: 30 });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: true });
      const pipeline = new RenderPipeline(geometry, lightTheme);

      const regions: string[] = [];
      const mockLayer = {
        render: vi.fn((rc: { paneRegion: string }) => {
          regions.push(rc.paneRegion);
        }),
      };
      pipeline.addLayer(mockLayer);

      const ctx = createMockCtx();

      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });
      const frozenRanges = vm.computeFrozenRanges(0, 0, 400, 600, 2, 1);
      const viewport = vm.computeVisibleRange(0, 0, 400, 600);

      pipeline.render(ctx, viewport, 400, 600, 0, 0, 'full', {
        frozenRows: 2,
        frozenColumns: 1,
        layoutEngine: layout,
        frozenRanges,
      });

      // Should have corner, frozenRow, frozenCol, main regions
      expect(regions).toContain('corner');
      expect(regions).toContain('frozenRow');
      expect(regions).toContain('frozenCol');
      expect(regions).toContain('main');
    });

    it('renders with paneRegion=full when no frozen config', () => {
      const columns = makeColumns([100, 100]);
      const layout = makeLayout([100, 100], 10, { rowHeight: 30 });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: true });
      const pipeline = new RenderPipeline(geometry, lightTheme);

      let capturedRegion = '';
      const mockLayer = {
        render: vi.fn((rc: { paneRegion: string }) => {
          capturedRegion = rc.paneRegion;
        }),
      };
      pipeline.addLayer(mockLayer);

      const ctx = createMockCtx();
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });
      const viewport = vm.computeVisibleRange(0, 0, 200, 300);

      pipeline.render(ctx, viewport, 200, 300, 0, 0, 'full');

      expect(capturedRegion).toBe('full');
      // No clip calls in non-frozen mode
      expect(ctx.clip).not.toHaveBeenCalled();
    });

    it('draws separator lines on content canvas when frozen', () => {
      const columns = makeColumns([100, 100, 100]);
      const layout = makeLayout([100, 100, 100], 10, { rowHeight: 30 });
      const geometry = new GridGeometry({ columns, theme: lightTheme, showRowNumbers: true });
      const pipeline = new RenderPipeline(geometry, lightTheme);

      pipeline.addLayer({ render: vi.fn() });

      const ctx = createMockCtx();

      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });
      const frozenRanges = vm.computeFrozenRanges(0, 0, 300, 300, 2, 1);
      const viewport = vm.computeVisibleRange(0, 0, 300, 300);

      pipeline.render(ctx, viewport, 300, 300, 0, 0, 'full', {
        frozenRows: 2,
        frozenColumns: 1,
        layoutEngine: layout,
        frozenRanges,
      });

      // Should draw separator lines (moveTo + lineTo + stroke)
      expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(2); // h-line + v-line
      // strokeStyle should be set to frozenSeparator color
      expect(ctx.strokeStyle).toBe(lightTheme.colors.frozenSeparator);
    });
  });

  describe('GridRenderer.setFrozenConfig', () => {
    it('accepts and stores frozen config', () => {
      const columns = makeColumns([100, 100]);
      const renderer = new GridRenderer({
        columns,
        cellStore: new CellStore(),
        rowCount: 10,
        theme: lightTheme,
        showRowNumbers: true,
        showGridLines: true,
      });

      const layout = makeLayout([100, 100], 10, { rowHeight: 30 });
      const vm = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });
      const frozenRanges = vm.computeFrozenRanges(0, 0, 200, 300, 2, 1);

      // Should not throw
      expect(() => renderer.setFrozenConfig({
        frozenRows: 2,
        frozenColumns: 1,
        layoutEngine: layout,
        frozenRanges,
      })).not.toThrow();

      // Can also clear config
      expect(() => renderer.setFrozenConfig(undefined)).not.toThrow();
    });
  });
});
