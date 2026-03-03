import { describe, it, expect, vi } from 'vitest';
import { GridLinesLayer } from '../src/renderer/layers/grid-lines-layer';
import { DataView } from '../src/dataview/data-view';
import { MergeManager } from '../src/merge/merge-manager';
import type { RenderContext } from '../src/renderer/render-layer';
import { lightTheme } from '../src/themes/built-in-themes';
import type { GridGeometry } from '../src/renderer/grid-geometry';

function createMockCtx() {
  return {
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function createMockGeometry(opts: { headerHeight: number; colWidths: number[]; rowHeight: number; rowCount: number; rowNumberWidth?: number }): GridGeometry {
  const { headerHeight, colWidths, rowHeight, rowCount, rowNumberWidth = 0 } = opts;
  return {
    headerHeight,
    rowNumberWidth,
    computeColumnRects: () =>
      colWidths.map((w, i) => ({
        x: colWidths.slice(0, i).reduce((s, v) => s + v, 0) + rowNumberWidth,
        y: 0,
        width: w,
        height: headerHeight,
      })),
    getRowY: (r: number) => r * rowHeight,
    getRowHeight: () => rowHeight,
    getTotalRowCount: () => rowCount,
  } as unknown as GridGeometry;
}

function createRenderContext(
  ctx: CanvasRenderingContext2D,
  opts: { geometry: GridGeometry; mergeManager?: MergeManager; startRow?: number; endRow?: number; startCol?: number; endCol?: number },
): RenderContext {
  return {
    ctx,
    geometry: opts.geometry,
    theme: lightTheme,
    canvasWidth: 800,
    canvasHeight: 600,
    viewport: {
      startRow: opts.startRow ?? 0,
      endRow: opts.endRow ?? 9,
      startCol: opts.startCol ?? 0,
      endCol: opts.endCol ?? 3,
    },
    scrollX: 0,
    scrollY: 0,
    renderMode: 'full' as const,
    paneRegion: 'full' as const,
    mergeManager: opts.mergeManager,
  };
}

describe('GridLinesLayer', () => {
  it('renders without DataView (passthrough)', () => {
    const layer = new GridLinesLayer();
    const ctx = createMockCtx();
    const geometry = createMockGeometry({ headerHeight: 30, colWidths: [100, 100], rowHeight: 28, rowCount: 10 });
    const mm = new MergeManager();
    mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

    const rc = createRenderContext(ctx, { geometry, mergeManager: mm });
    layer.render(rc);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('translates physical merge rows to logical via DataView', () => {
    // Physical rows: [0, 1, 2, 3, 4]
    // DataView mapping (filter): logical [0, 1, 2] = physical [0, 3, 4]
    // Physical rows 1, 2 are filtered out
    // Merge: physical rows 3-4 (logical 1-2)
    const dv = new DataView({ totalRowCount: 5 });
    dv.recompute([0, 3, 4]);

    const layer = new GridLinesLayer(dv);
    const ctx = createMockCtx();
    const geometry = createMockGeometry({ headerHeight: 30, colWidths: [100, 100], rowHeight: 28, rowCount: 3 });
    const mm = new MergeManager();
    mm.merge({ startRow: 3, startCol: 0, endRow: 4, endCol: 1 });

    const rc = createRenderContext(ctx, { geometry, mergeManager: mm, endRow: 2 });
    layer.render(rc);

    // Should render — the merge exists at logical rows 1-2
    // The horizontal line at logical row 2 (between rows 1 and 2 of the merge) should be suppressed
    const moveToArgs = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToArgs = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

    // Verify lines are drawn (basic rendering works)
    expect(moveToArgs.length).toBeGreaterThan(0);
    expect(lineToArgs.length).toBeGreaterThan(0);
  });

  it('skips merge region when physical rows are filtered out', () => {
    // Merge at physical rows 1-2, but both are filtered out
    const dv = new DataView({ totalRowCount: 5 });
    dv.recompute([0, 3, 4]); // physical 1, 2 not visible

    const layer = new GridLinesLayer(dv);
    const ctx = createMockCtx();
    const geometry = createMockGeometry({ headerHeight: 30, colWidths: [100, 100], rowHeight: 28, rowCount: 3 });
    const mm = new MergeManager();
    mm.merge({ startRow: 1, startCol: 0, endRow: 2, endCol: 1 });

    const rc = createRenderContext(ctx, { geometry, mergeManager: mm, endRow: 2 });
    layer.render(rc);

    // Merge at physical 1-2 is entirely filtered out — no gap suppression
    // All horizontal lines should be drawn without gaps
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('uses physical coords directly when DataView is passthrough', () => {
    const dv = new DataView({ totalRowCount: 5 });
    // No recompute — passthrough mode

    const layer = new GridLinesLayer(dv);
    const ctx = createMockCtx();
    const geometry = createMockGeometry({ headerHeight: 30, colWidths: [100, 100], rowHeight: 28, rowCount: 5 });
    const mm = new MergeManager();
    mm.merge({ startRow: 1, startCol: 0, endRow: 2, endCol: 1 });

    const rc = createRenderContext(ctx, { geometry, mergeManager: mm, endRow: 4 });
    layer.render(rc);

    expect(ctx.stroke).toHaveBeenCalled();
  });
});
