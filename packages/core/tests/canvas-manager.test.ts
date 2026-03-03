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

  it('creates canvas and appends to container', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(manager.getCanvas()).toBeInstanceOf(HTMLCanvasElement);
    manager.destroy();
  });

  it('applies DPI scaling correctly with dpr=2', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 2 });

    expect(manager.getCssWidth()).toBe(800);
    expect(manager.getCssHeight()).toBe(600);
    expect(manager.getPixelWidth()).toBe(1600);
    expect(manager.getPixelHeight()).toBe(1200);

    const canvas = manager.getCanvas();
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');

    const ctx = manager.getContext();
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(manager.getDpr()).toBe(2);
    manager.destroy();
  });

  it('applies DPI scaling correctly with dpr=1', () => {
    const container = createContainer(1024, 768);
    const manager = new CanvasManager({ container, dpr: 1 });

    expect(manager.getPixelWidth()).toBe(1024);
    expect(manager.getPixelHeight()).toBe(768);
    expect(manager.getCssWidth()).toBe(1024);
    expect(manager.getCssHeight()).toBe(768);
    manager.destroy();
  });

  it('applies DPI scaling with fractional dpr=1.5', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1.5 });

    expect(manager.getPixelWidth()).toBe(1200);
    expect(manager.getPixelHeight()).toBe(900);

    const ctx = manager.getContext();
    expect(ctx.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 0, 0);
    manager.destroy();
  });

  it('syncSize updates dimensions when container changes', () => {
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
    expect(manager.getPixelWidth()).toBe(1600);

    width = 1200;
    height = 900;
    manager.syncSize();

    expect(manager.getCssWidth()).toBe(1200);
    expect(manager.getCssHeight()).toBe(900);
    expect(manager.getPixelWidth()).toBe(2400);
    expect(manager.getPixelHeight()).toBe(1800);
    manager.destroy();
  });

  it('throws if Canvas 2D context is not available', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null) as any;
    const container = createContainer(800, 600);

    expect(() => new CanvasManager({ container, dpr: 1 })).toThrow(
      'Failed to get Canvas 2D context',
    );
  });

  it('destroy removes canvas from parent', () => {
    const container = createContainer(800, 600);
    const manager = new CanvasManager({ container, dpr: 1 });

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    manager.destroy();
    expect(container.querySelectorAll('canvas')).toHaveLength(0);
  });
});
