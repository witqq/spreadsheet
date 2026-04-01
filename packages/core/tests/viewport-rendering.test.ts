// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import { lightTheme } from '../src/themes/built-in-themes';
import type { ColumnDef } from '../src/types/interfaces';

// ─── Mocks ────────────────────────────────────────────────────────────────────

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 800, writable: true });
  Object.defineProperty(container, 'clientHeight', { value: 600, writable: true });
  Object.defineProperty(container, 'offsetWidth', { value: 800, writable: true });
  Object.defineProperty(container, 'offsetHeight', { value: 600, writable: true });
  container.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return container;
}

function setupCanvasMocks() {
  const drawCalls: { method: string; args: unknown[]; fillStyle?: string }[] = [];

  let _fillStyle = '';
  const ctxProxy = {
    scale: vi.fn(),
    clearRect: vi.fn((...args: unknown[]) => drawCalls.push({ method: 'clearRect', args })),
    fillRect: vi.fn((...args: unknown[]) =>
      drawCalls.push({ method: 'fillRect', args, fillStyle: _fillStyle }),
    ),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    measureText: vi
      .fn()
      .mockReturnValue({ width: 50, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }),
    beginPath: vi.fn(),
    moveTo: vi.fn((...args: unknown[]) => drawCalls.push({ method: 'moveTo', args })),
    lineTo: vi.fn((...args: unknown[]) => drawCalls.push({ method: 'lineTo', args })),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn().mockReturnValue([]),
    canvas: { width: 800, height: 600 },
    font: '',
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(v: string) {
      _fillStyle = v;
    },
    strokeStyle: '',
    textAlign: 'left',
    textBaseline: 'top',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    setTransform: vi.fn(),
    getTransform: vi.fn().mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    resetTransform: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  };

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctxProxy);

  return drawCalls;
}

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name', width: 150 },
  { key: 'value', title: 'Value', width: 100 },
  { key: 'city', title: 'City', width: 120 },
];

const data = [
  { name: 'Alice', value: 100, city: 'NYC' },
  { name: 'Bob', value: 200, city: 'LA' },
  { name: 'Carol', value: 300, city: 'Chicago' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Viewport Rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    container = createMockContainer();
  });

  describe('clipGridLinesToData', () => {
    it('grid lines extend to canvas edges by default', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({ columns, data });
      engine.mount(container);

      // Find lineTo calls that go to canvas width (800) or height (600)
      const toCanvasWidth = drawCalls.filter((c) => c.method === 'lineTo' && c.args[0] === 800);
      const toCanvasHeight = drawCalls.filter((c) => c.method === 'lineTo' && c.args[1] === 600);

      expect(toCanvasWidth.length).toBeGreaterThan(0);
      expect(toCanvasHeight.length).toBeGreaterThan(0);
      engine.destroy();
    });

    it('grid lines stop at data boundary when clipGridLinesToData=true', () => {
      // First render without clipping to get baseline
      const defaultCalls = setupCanvasMocks();
      const defaultEngine = new SpreadsheetEngine({ columns, data });
      defaultEngine.mount(container);
      const defaultToWidth = defaultCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;
      defaultEngine.destroy();

      // Now render with clipping
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data,
        clipGridLinesToData: true,
      });
      engine.mount(container);

      const clippedToWidth = drawCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;

      // Clipping should result in significantly fewer lines reaching canvas width
      // (header layer still draws to full width, but grid lines should stop at data boundary)
      expect(clippedToWidth).toBeLessThan(defaultToWidth);
      engine.destroy();
    });

    it('clipGridLinesToData defaults to false', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({ columns, data });
      engine.mount(container);

      // Default behavior: lines extend to canvas edges
      const toCanvasWidth = drawCalls.filter((c) => c.method === 'lineTo' && c.args[0] === 800);
      expect(toCanvasWidth.length).toBeGreaterThan(0);
      engine.destroy();
    });

    it('phantom grid lines are not drawn when clipGridLinesToData=true and no data', () => {
      // First render without clipping to get baseline
      const defaultCalls = setupCanvasMocks();
      const defaultEngine = new SpreadsheetEngine({
        columns,
        data: [],
        rowCount: 0,
      });
      defaultEngine.mount(container);
      const defaultToWidth = defaultCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;
      defaultEngine.destroy();

      // Now render with clipping
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data: [],
        rowCount: 0,
        clipGridLinesToData: true,
      });
      engine.mount(container);

      // With no data and clipToData, phantom grid lines should not be drawn
      const clippedToWidth = drawCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;
      // Should have fewer lines to canvas width (phantom lines suppressed)
      expect(clippedToWidth).toBeLessThan(defaultToWidth);
      engine.destroy();
    });

    it('phantom grid lines are drawn when clipGridLinesToData=false and no data', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data: [],
        rowCount: 0,
        clipGridLinesToData: false,
      });
      engine.mount(container);

      // Default: phantom grid lines fill the canvas
      const hLines = drawCalls.filter((c) => c.method === 'lineTo' && c.args[0] === 800);
      expect(hLines.length).toBeGreaterThan(0);
      engine.destroy();
    });

    it('vertical grid lines stop at last data row boundary when clipped', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data,
        clipGridLinesToData: true,
      });
      engine.mount(container);

      // Vertical lines should NOT go to canvas height (600)
      const toCanvasHeight = drawCalls.filter((c) => c.method === 'lineTo' && c.args[1] === 600);
      expect(toCanvasHeight.length).toBe(0);
      engine.destroy();
    });

    it('gutter border clips to data boundary when clipped', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data,
        clipGridLinesToData: true,
        showRowNumbers: true,
      });
      engine.mount(container);

      // Gutter right border should NOT extend to canvas height
      const toCanvasHeight = drawCalls.filter((c) => c.method === 'lineTo' && c.args[1] === 600);
      expect(toCanvasHeight.length).toBe(0);
      engine.destroy();
    });
  });

  describe('transparent background', () => {
    it('uses fillRect with solid background color by default', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({ columns, data });
      engine.mount(container);

      // Default theme uses solid background
      const fillRects = drawCalls.filter(
        (c) =>
          c.method === 'fillRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(fillRects.length).toBeGreaterThan(0);
      engine.destroy();
    });

    it('uses clearRect when background is transparent', () => {
      const drawCalls = setupCanvasMocks();

      const transparentTheme = {
        ...lightTheme,
        colors: {
          ...lightTheme.colors,
          background: 'transparent',
        },
      };
      const engine = new SpreadsheetEngine({
        columns,
        data,
        theme: transparentTheme,
      });
      engine.mount(container);

      // Should use clearRect instead of fillRect for canvas-wide background
      const clearRects = drawCalls.filter(
        (c) =>
          c.method === 'clearRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(clearRects.length).toBeGreaterThan(0);

      // Should NOT have fillRect for canvas-wide background
      const fillRects = drawCalls.filter(
        (c) =>
          c.method === 'fillRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(fillRects.length).toBe(0);
      engine.destroy();
    });

    it('cells with bgColor still render their background when canvas is transparent', () => {
      const drawCalls = setupCanvasMocks();

      const transparentTheme = {
        ...lightTheme,
        colors: {
          ...lightTheme.colors,
          background: 'transparent',
        },
      };

      const engine = new SpreadsheetEngine({
        columns,
        data: [{ name: 'Alice', value: 100, city: 'NYC' }],
        theme: transparentTheme,
      });
      engine.mount(container);

      // Canvas-wide clearRect should exist (transparent background)
      const clearRects = drawCalls.filter(
        (c) =>
          c.method === 'clearRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(clearRects.length).toBeGreaterThan(0);

      // No opaque canvas-wide fillRect (background is transparent, not solid)
      const opaqueBackgrounds = drawCalls.filter(
        (c) =>
          c.method === 'fillRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(opaqueBackgrounds.length).toBe(0);

      // Per-cell fillRect calls still work (BackgroundLayer per-cell logic unchanged)
      // Cells with bgColor would get fillRect with cell dimensions, not canvas-wide
      // This is verified by existing BackgroundLayer tests; here we confirm
      // that transparent canvas doesn't suppress the fillRect mechanism
      const cellFills = drawCalls.filter(
        (c) =>
          c.method === 'fillRect' && (c.args[2] as number) < 800 && (c.args[3] as number) < 600,
      );
      // At minimum, row number gutter background fills exist
      expect(cellFills.length).toBeGreaterThan(0);

      engine.destroy();
    });

    it('canvas is transparent (no solid fill) with transparent background', () => {
      const drawCalls = setupCanvasMocks();

      const transparentTheme = {
        ...lightTheme,
        colors: {
          ...lightTheme.colors,
          background: 'transparent',
        },
      };
      const engine = new SpreadsheetEngine({
        columns,
        data,
        theme: transparentTheme,
      });
      engine.mount(container);

      // No canvas-wide fillRect (which would be opaque)
      const opaqueBackground = drawCalls.filter(
        (c) =>
          c.method === 'fillRect' &&
          c.args[0] === 0 &&
          c.args[1] === 0 &&
          c.args[2] === 800 &&
          c.args[3] === 600,
      );
      expect(opaqueBackground.length).toBe(0);
      engine.destroy();
    });
  });

  describe('combined features', () => {
    it('clipGridLinesToData works with transparent background', () => {
      // Get baseline without clipping
      const defaultCalls = setupCanvasMocks();
      const transparentTheme = {
        ...lightTheme,
        colors: {
          ...lightTheme.colors,
          background: 'transparent',
        },
      };
      const defaultEngine = new SpreadsheetEngine({
        columns,
        data,
        theme: transparentTheme,
      });
      defaultEngine.mount(container);
      const defaultToWidth = defaultCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;
      defaultEngine.destroy();

      // Now with clipping
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data,
        theme: transparentTheme,
        clipGridLinesToData: true,
      });
      engine.mount(container);

      // Fewer lines to canvas width (grid lines clipped, only header lines remain)
      const clippedToWidth = drawCalls.filter(
        (c) => c.method === 'lineTo' && c.args[0] === 800,
      ).length;
      expect(clippedToWidth).toBeLessThan(defaultToWidth);

      // clearRect used (transparent)
      const clearRects = drawCalls.filter(
        (c) => c.method === 'clearRect' && c.args[0] === 0 && c.args[1] === 0,
      );
      expect(clearRects.length).toBeGreaterThan(0);

      engine.destroy();
    });

    it('clipGridLinesToData works with showColumnHeaders=false', () => {
      const drawCalls = setupCanvasMocks();
      const engine = new SpreadsheetEngine({
        columns,
        data,
        clipGridLinesToData: true,
        showColumnHeaders: false,
      });
      engine.mount(container);

      // No lines to canvas edges
      const toCanvasWidth = drawCalls.filter((c) => c.method === 'lineTo' && c.args[0] === 800);
      expect(toCanvasWidth.length).toBe(0);

      engine.destroy();
    });
  });
});
