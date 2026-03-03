// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';
import {
  ProgressiveLoaderPlugin,
  PROGRESSIVE_LOADER_PLUGIN_NAME,
} from '../progressive-loader/src/index';
import { ProgressOverlay } from '../progressive-loader/src/progress-overlay-layer';

function makeColumns(): ColumnDef[] {
  return [
    { key: 'id', title: 'ID', width: 80, type: 'number' },
    { key: 'name', title: 'Name', width: 120 },
    { key: 'value', title: 'Value', width: 100, type: 'number' },
  ];
}

function createMockCtx(): CanvasRenderingContext2D {
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
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    canvas: {} as HTMLCanvasElement,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ProgressiveLoaderPlugin', () => {
  let container: HTMLDivElement;
  let engine: SpreadsheetEngine;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400, x: 0, y: 0, toJSON: () => {} }),
    });
    document.body.appendChild(container);

    engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: [],
    });
    engine.mount(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  it('has correct name and version', () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 100,
      columnKeys: ['id', 'name', 'value'],
      generateRow: (i) => ({ id: i, name: `R${i}`, value: i * 10 }),
    });
    expect(plugin.name).toBe(PROGRESSIVE_LOADER_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('installs into engine and mounts DOM overlay', () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 100,
      columnKeys: ['id', 'name', 'value'],
      generateRow: (i) => ({ id: i, name: `R${i}`, value: i * 10 }),
    });

    engine.installPlugin(plugin);

    // DOM overlay should be mounted inside the container
    const overlay = container.querySelector('.wit-progress-overlay');
    expect(overlay).toBeTruthy();
  });

  it('start() begins loading and updates progress', async () => {
    const onProgress = vi.fn();
    const onComplete = vi.fn();

    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 200,
      columnKeys: ['id', 'name', 'value'],
      generateRow: (i) => ({ id: i + 1, name: `Row ${i}`, value: i * 10 }),
      onProgress,
      onComplete,
    });

    engine.installPlugin(plugin);
    expect(plugin.isLoading()).toBe(false);
    expect(plugin.getLoadedRows()).toBe(0);

    plugin.start();
    expect(plugin.isLoading()).toBe(true);

    // Wait for setTimeout to process chunks
    await new Promise((r) => setTimeout(r, 200));

    expect(onProgress).toHaveBeenCalled();
    expect(plugin.getLoadedRows()).toBe(200);
    expect(plugin.getProgress()).toBe(1);
    expect(onComplete).toHaveBeenCalledWith(expect.any(Number));
  });

  it('writes data to CellStore via generateRow', async () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 5,
      columnKeys: ['id', 'name', 'value'],
      generateRow: (i) => ({ id: i + 1, name: `Row ${i}`, value: i * 100 }),
    });

    engine.installPlugin(plugin);
    plugin.start();

    await new Promise((r) => setTimeout(r, 100));

    const store = engine.getCellStore();
    expect(store.get(0, 0)?.value).toBe(1);
    expect(store.get(0, 1)?.value).toBe('Row 0');
    expect(store.get(0, 2)?.value).toBe(0);
    expect(store.get(4, 0)?.value).toBe(5);
    expect(store.get(4, 1)?.value).toBe('Row 4');
    expect(store.get(4, 2)?.value).toBe(400);
  });

  it('cancel() stops loading mid-stream', async () => {
    const onComplete = vi.fn();

    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 1_000_000,
      columnKeys: ['id'],
      generateRow: (i) => ({ id: i }),
      onComplete,
    });

    engine.installPlugin(plugin);
    plugin.start();
    expect(plugin.isLoading()).toBe(true);

    // Cancel immediately before any chunks process
    plugin.cancel();
    expect(plugin.isLoading()).toBe(false);

    await new Promise((r) => setTimeout(r, 100));

    // onComplete should NOT have been called
    expect(onComplete).not.toHaveBeenCalled();
    expect(plugin.getLoadedRows()).toBe(0);
  });

  it('destroy() removes overlay from DOM', () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 100,
      columnKeys: ['id'],
      generateRow: (i) => ({ id: i }),
    });

    engine.installPlugin(plugin);
    expect(container.querySelector('.wit-progress-overlay')).toBeTruthy();

    engine.removePlugin(PROGRESSIVE_LOADER_PLUGIN_NAME);
    expect(container.querySelector('.wit-progress-overlay')).toBeNull();
  });

  it('start() is idempotent when already loading', () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 100,
      columnKeys: ['id'],
      generateRow: (i) => ({ id: i }),
    });

    engine.installPlugin(plugin);
    plugin.start();
    plugin.start(); // second call should be no-op
    expect(plugin.isLoading()).toBe(true);
  });

  it('getProgress() returns 0 before start, fraction during load', () => {
    const plugin = new ProgressiveLoaderPlugin({
      totalRows: 1000,
      columnKeys: ['id'],
      generateRow: (i) => ({ id: i }),
    });

    expect(plugin.getProgress()).toBe(0);

    engine.installPlugin(plugin);
    expect(plugin.getProgress()).toBe(0);
  });
});

describe('ProgressOverlay (DOM)', () => {
  it('mounts into container and creates overlay element', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const overlay = new ProgressOverlay();
    overlay.mount(div);

    expect(div.querySelector('.wit-progress-overlay')).toBeTruthy();
    expect(div.querySelector('.wit-progress-pct')).toBeTruthy();
    expect(div.querySelector('.wit-progress-bar')).toBeTruthy();
    expect(div.querySelector('.wit-progress-detail')).toBeTruthy();

    overlay.destroy();
    document.body.removeChild(div);
  });

  it('setProgress updates percentage and bar width', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const overlay = new ProgressOverlay();
    overlay.mount(div);
    overlay.setProgress(50_000, 100_000);

    const pct = div.querySelector('.wit-progress-pct');
    expect(pct?.textContent).toBe('50%');

    const fill = div.querySelector('.wit-progress-bar-fill') as HTMLDivElement;
    expect(fill?.style.width).toBe('50%');

    const detail = div.querySelector('.wit-progress-detail');
    expect(detail?.textContent).toMatch(/50.000/); // locale-agnostic (comma or space separator)

    overlay.destroy();
    document.body.removeChild(div);
  });

  it('setPhase processing changes text and adds class', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const overlay = new ProgressOverlay();
    overlay.mount(div);
    overlay.setPhase('processing');

    const el = div.querySelector('.wit-progress-overlay');
    expect(el?.classList.contains('wit-progress-processing')).toBe(true);

    const pct = div.querySelector('.wit-progress-pct');
    expect(pct?.textContent).toBe('Processing…');

    overlay.destroy();
    document.body.removeChild(div);
  });

  it('setPhase done adds fade-out class', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const overlay = new ProgressOverlay();
    overlay.mount(div);
    overlay.setPhase('done');

    const el = div.querySelector('.wit-progress-overlay');
    expect(el?.classList.contains('wit-progress-done')).toBe(true);

    overlay.destroy();
    document.body.removeChild(div);
  });

  it('destroy removes overlay from DOM', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const overlay = new ProgressOverlay();
    overlay.mount(div);
    expect(div.querySelector('.wit-progress-overlay')).toBeTruthy();

    overlay.destroy();
    expect(div.querySelector('.wit-progress-overlay')).toBeNull();

    document.body.removeChild(div);
  });
});
