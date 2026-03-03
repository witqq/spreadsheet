import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteCursorLayer } from '../../src/collaboration/cursor-layer';
import type { RenderContext } from '@witqq/spreadsheet';

function createMockRenderContext(overrides?: Partial<RenderContext>): RenderContext {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    textAlign: 'left' as CanvasTextAlign,
  } as unknown as CanvasRenderingContext2D;

  return {
    ctx,
    geometry: {
      computeCellRect: vi.fn().mockReturnValue({ x: 100, y: 50, width: 120, height: 30 }),
    } as unknown as RenderContext['geometry'],
    theme: {
      dimensions: { headerHeight: 32, rowNumberWidth: 60 },
    } as unknown as RenderContext['theme'],
    viewport: { startRow: 0, endRow: 50, startCol: 0, endCol: 20 },
    scrollX: 0,
    scrollY: 0,
    canvasWidth: 1200,
    canvasHeight: 600,
    renderMode: 'full' as const,
    paneRegion: undefined,
    ...overrides,
  } as unknown as RenderContext;
}

describe('RemoteCursorLayer', () => {
  let layer: RemoteCursorLayer;

  beforeEach(() => {
    layer = new RemoteCursorLayer();
  });

  it('starts with no cursors', () => {
    expect(layer.getCursors()).toEqual([]);
  });

  it('adds a cursor via setCursor', () => {
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 5,
      col: 3,
    });
    expect(layer.getCursors()).toHaveLength(1);
    expect(layer.getCursors()[0].name).toBe('Alice');
  });

  it('removes a cursor via setCursor(null)', () => {
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 5,
      col: 3,
    });
    layer.setCursor('user1', null);
    expect(layer.getCursors()).toHaveLength(0);
  });

  it('removes a cursor via removeCursor', () => {
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 5,
      col: 3,
    });
    layer.removeCursor('user1');
    expect(layer.getCursors()).toHaveLength(0);
  });

  it('updates existing cursor position', () => {
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 5,
      col: 3,
    });
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 10,
      col: 7,
    });
    expect(layer.getCursors()).toHaveLength(1);
    expect(layer.getCursors()[0].row).toBe(10);
    expect(layer.getCursors()[0].col).toBe(7);
  });

  it('supports multiple cursors', () => {
    layer.setCursor('user1', {
      clientId: 'user1',
      color: '#e74c3c',
      name: 'Alice',
      row: 5,
      col: 3,
    });
    layer.setCursor('user2', {
      clientId: 'user2',
      color: '#3498db',
      name: 'Bob',
      row: 8,
      col: 1,
    });
    expect(layer.getCursors()).toHaveLength(2);
  });

  describe('render', () => {
    it('does nothing when no cursors', () => {
      const rc = createMockRenderContext();
      layer.render(rc);
      expect(rc.ctx.save).not.toHaveBeenCalled();
    });

    it('does nothing in placeholder mode', () => {
      layer.setCursor('user1', {
        clientId: 'user1',
        color: '#e74c3c',
        name: 'Alice',
        row: 5,
        col: 3,
      });
      const rc = createMockRenderContext({ renderMode: 'placeholder' as 'full' });
      layer.render(rc);
      expect(rc.ctx.save).not.toHaveBeenCalled();
    });

    it('renders visible cursor with fill, border, and label', () => {
      layer.setCursor('user1', {
        clientId: 'user1',
        color: '#e74c3c',
        name: 'Alice',
        row: 5,
        col: 3,
      });
      const rc = createMockRenderContext();
      layer.render(rc);

      expect(rc.ctx.save).toHaveBeenCalled();
      expect(rc.ctx.restore).toHaveBeenCalled();
      // Cell highlight (semi-transparent fill)
      expect(rc.ctx.fillRect).toHaveBeenCalled();
      // Cell border
      expect(rc.ctx.strokeRect).toHaveBeenCalled();
      // Name label text
      expect(rc.ctx.fillText).toHaveBeenCalledWith('Alice', expect.any(Number), expect.any(Number));
    });

    it('skips cursors outside viewport', () => {
      layer.setCursor('user1', {
        clientId: 'user1',
        color: '#e74c3c',
        name: 'Alice',
        row: 100, // outside viewport endRow=50
        col: 3,
      });
      const rc = createMockRenderContext();
      layer.render(rc);

      expect(rc.ctx.save).toHaveBeenCalled();
      // fillRect is NOT called since cursor is outside viewport
      expect(rc.ctx.fillRect).not.toHaveBeenCalled();
    });
  });
});
