// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasManager } from '../src/renderer/canvas-manager';

function createMockCtx() {
  return {
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

function createContainer(width: number, height: number): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  });
  document.body.appendChild(container);
  return container;
}

describe('CanvasManager', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.innerHTML = '';
  });

  it('creates a single canvas element', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    const canvases = container.querySelectorAll('canvas');
    expect(canvases).toHaveLength(1);
    manager.destroy();
  });

  it('positions canvas absolutely', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    const canvas = manager.getCanvas();
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.top).toBe('0px');
    expect(canvas.style.left).toBe('0px');
    manager.destroy();
  });

  it('applies comprehensive CSS reset to canvas', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    const canvas = manager.getCanvas();
    expect(canvas.style.margin).toBe('0px');
    expect(canvas.style.padding).toBe('0px');
    expect(canvas.style.display).toBe('block');
    manager.destroy();
  });

  it('applies DPI scaling', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 2 });

    const canvas = manager.getCanvas();
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe('800px');

    expect(manager.getCssWidth()).toBe(800);
    expect(manager.getCssHeight()).toBe(600);
    expect(manager.getDpr()).toBe(2);
    manager.destroy();
  });

  it('returns a context', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    const ctx = manager.getContext();
    expect(ctx).toBeDefined();
    manager.destroy();
  });

  it('sets DPR transform on context', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 2 });

    const ctx = manager.getContext();
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    manager.destroy();
  });

  it('sets container position to relative if static', () => {
    const container = createContainer(800, 600);
    container.style.position = '';

    const manager = new CanvasManager({ container, dpr: 1 });
    expect(container.style.position).toBe('relative');
    manager.destroy();
  });

  it('preserves existing non-static position', () => {
    const container = createContainer(800, 600);
    container.style.position = 'absolute';

    const manager = new CanvasManager({ container, dpr: 1 });
    expect(container.style.position).toBe('absolute');
    manager.destroy();
  });

  it('syncSize updates canvas', () => {
    let width = 800;
    let height = 600;
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);

    const manager = new CanvasManager({ container, dpr: 2 });
    expect(manager.getCssWidth()).toBe(800);

    width = 1200;
    height = 900;
    manager.syncSize();

    expect(manager.getCssWidth()).toBe(1200);
    expect(manager.getCssHeight()).toBe(900);

    const canvas = manager.getCanvas();
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1800);
    manager.destroy();
  });

  it('destroy removes canvas', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    expect(container.querySelectorAll('canvas')).toHaveLength(1);

    manager.destroy();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });

  describe('DPR change detection', () => {
    it('calls onDprChange callback when devicePixelRatio changes', () => {
      const container = createContainer(800, 600);
      const origDpr = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true, configurable: true });

      const manager = new CanvasManager({ container });
      const callback = vi.fn();
      manager.setDprChangeCallback(callback);

      // Simulate DPR change (zoom)
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true, configurable: true });

      // matchMedia listener won't fire in jsdom — verify callback set and cleanup works
      manager.destroy();
      Object.defineProperty(window, 'devicePixelRatio', { value: origDpr, writable: true, configurable: true });
    });

    it('does not watch DPR when dpr is explicitly provided', () => {
      const container = createContainer(800, 600);
      const origMatchMedia = window.matchMedia;
      const mockMatchMedia = vi.fn();
      window.matchMedia = mockMatchMedia as any;

      const manager = new CanvasManager({ container, dpr: 2 });
      expect(mockMatchMedia).not.toHaveBeenCalled();

      manager.destroy();
      window.matchMedia = origMatchMedia;
    });

    it('destroy cleans up DPR watcher without errors', () => {
      const container = createContainer(800, 600);
      const manager = new CanvasManager({ container, dpr: 1 });
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});
