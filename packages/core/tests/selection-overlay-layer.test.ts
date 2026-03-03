import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectionOverlayLayer } from '../src/renderer/layers/selection-overlay-layer';
import { SelectionManager } from '../src/selection/selection-manager';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { DataView } from '../src/dataview/data-view';
import { MergeManager } from '../src/merge/merge-manager';
import type { RenderContext } from '../src/renderer/render-layer';
import type { ColumnDef } from '../src/types/interfaces';
import { lightTheme } from '../src/themes/built-in-themes';

function makeColumns(): ColumnDef[] {
  return [
    { key: 'a', title: 'A', width: 100 },
    { key: 'b', title: 'B', width: 120 },
    { key: 'c', title: 'C', width: 80 },
  ];
}

/** Create a mock CanvasRenderingContext2D with spyable methods. */
function mockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createRenderContext(ctx: CanvasRenderingContext2D, overrides?: Partial<RenderContext>): RenderContext {
  const geometry = new GridGeometry({
    columns: makeColumns(),
    theme: lightTheme,
    showRowNumbers: true,
  });

  return {
    ctx,
    geometry,
    theme: lightTheme,
    canvasWidth: 800,
    canvasHeight: 600,
    viewport: { startRow: 0, endRow: 20, startCol: 0, endCol: 2 },
    scrollX: 0,
    scrollY: 0,
    renderMode: 'full',
    paneRegion: 'full',
    ...overrides,
  };
}

describe('SelectionOverlayLayer', () => {
  let selectionManager: SelectionManager;
  let dataView: DataView;
  let layer: SelectionOverlayLayer;

  beforeEach(() => {
    selectionManager = new SelectionManager({ rowCount: 100, colCount: 3 });
    dataView = new DataView({ totalRowCount: 100 });
    layer = new SelectionOverlayLayer(selectionManager, dataView);
  });

  it('does not draw when no selection ranges', () => {
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('draws fill and border for single cell selection', () => {
    selectionManager.selectCell(2, 1);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('sets fill style to theme selection fill color', () => {
    selectionManager.selectCell(0, 0);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    // fillStyle is set before fillRect call
    expect(ctx.fillStyle).toBe(lightTheme.colors.selectionFill);
  });

  it('draws active cell border with distinct style', () => {
    selectionManager.selectCell(3, 1);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    // 2 strokeRect calls: range border + active cell border
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });

  it('draws fill with correct dimensions for extended range', () => {
    selectionManager.selectCell(1, 0);
    selectionManager.extendSelection(4, 2);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    expect(ctx.fillRect).toHaveBeenCalled();
    const fillCall = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0];
    const fillHeight = fillCall[3];
    // 4 rows (1,2,3,4) × rowHeight
    expect(fillHeight).toBe(4 * lightTheme.dimensions.rowHeight);
  });

  it('clips to cell area (excludes header and row number gutter)', () => {
    selectionManager.selectCell(0, 0);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    expect(ctx.rect).toHaveBeenCalledWith(
      lightTheme.dimensions.rowNumberWidth,
      lightTheme.dimensions.headerHeight,
      800 - lightTheme.dimensions.rowNumberWidth,
      600 - lightTheme.dimensions.headerHeight,
    );
    expect(ctx.clip).toHaveBeenCalled();
  });

  it('does not draw active cell border for out-of-viewport cells', () => {
    selectionManager.selectCell(50, 1); // row 50 outside viewport 0-20
    const ctx = mockContext();
    const rc = createRenderContext(ctx, {
      viewport: { startRow: 0, endRow: 20, startCol: 0, endCol: 2 },
    });

    layer.render(rc);

    // Range fill and border won't draw (row 50 > endRow 20)
    // Active cell border won't draw (row 50 outside viewport)
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('draws fill for each range with Ctrl+click', () => {
    selectionManager.selectCell(1, 0);
    selectionManager.addRange(5, 2);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    // Two fill rects (one per range)
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
  });

  it('accounts for scroll offset in y position', () => {
    selectionManager.selectCell(5, 1);
    const ctx = mockContext();
    const rc = createRenderContext(ctx, { scrollY: 100 });

    layer.render(rc);

    const fillCall = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0];
    const fillY = fillCall[1];
    const expectedY = lightTheme.dimensions.headerHeight + 5 * lightTheme.dimensions.rowHeight - 100;
    expect(fillY).toBe(expectedY);
  });

  it('saves and restores context state', () => {
    selectionManager.selectCell(0, 0);
    const ctx = mockContext();
    const rc = createRenderContext(ctx);

    layer.render(rc);

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  describe('merge-aware rendering', () => {
    it('active cell border wraps full merged region', () => {
      
      const mm = new MergeManager();
      mm.merge({ startRow: 2, startCol: 0, endRow: 4, endCol: 1 });

      // Select anchor cell of merge (row 2, col 0)
      selectionManager.selectCell(2, 0);
      const ctx = mockContext();
      const rc = createRenderContext(ctx, { mergeManager: mm });

      layer.render(rc);

      // Active cell border: last strokeRect call should span 3 rows × 2 cols
      const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = strokeCalls[strokeCalls.length - 1];
      const borderWidth = lastCall[2] + 1; // +1 because we subtract 1 in rendering
      const borderHeight = lastCall[3] + 1;
      const expectedWidth = 100 + 120; // col 0 (100) + col 1 (120)
      const expectedHeight = 3 * lightTheme.dimensions.rowHeight; // 3 rows
      expect(borderWidth).toBe(expectedWidth);
      expect(borderHeight).toBe(expectedHeight);
    });

    it('active cell border wraps merge when clicking hidden cell', () => {
      
      const mm = new MergeManager();
      mm.merge({ startRow: 1, startCol: 0, endRow: 2, endCol: 1 });

      // SelectionManager should snap to anchor, but even if activeCell is anchor (1,0),
      // the overlay should still wrap the full merge
      selectionManager.selectCell(1, 0);
      const ctx = mockContext();
      const rc = createRenderContext(ctx, { mergeManager: mm });

      layer.render(rc);

      const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = strokeCalls[strokeCalls.length - 1];
      const borderWidth = lastCall[2] + 1;
      const borderHeight = lastCall[3] + 1;
      expect(borderWidth).toBe(100 + 120); // 2 cols
      expect(borderHeight).toBe(2 * lightTheme.dimensions.rowHeight); // 2 rows
    });

    it('single cell active border when no merge manager', () => {
      selectionManager.selectCell(2, 1);
      const ctx = mockContext();
      const rc = createRenderContext(ctx); // no mergeManager

      layer.render(rc);

      const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = strokeCalls[strokeCalls.length - 1];
      const borderWidth = lastCall[2] + 1;
      const borderHeight = lastCall[3] + 1;
      expect(borderWidth).toBe(120); // col 1 width
      expect(borderHeight).toBe(lightTheme.dimensions.rowHeight);
    });

    it('active cell border for non-merged cell with merge manager present', () => {
      
      const mm = new MergeManager();
      mm.merge({ startRow: 5, startCol: 0, endRow: 6, endCol: 1 }); // merge elsewhere

      selectionManager.selectCell(2, 1); // select non-merged cell
      const ctx = mockContext();
      const rc = createRenderContext(ctx, { mergeManager: mm });

      layer.render(rc);

      const strokeCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = strokeCalls[strokeCalls.length - 1];
      const borderWidth = lastCall[2] + 1;
      expect(borderWidth).toBe(120); // single col width, not merged
    });
  });
});
