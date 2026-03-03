// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef, ContextMenuItem } from '@witqq/spreadsheet';
import {
  createContextMenuPlugin,
  CONTEXT_MENU_PLUGIN_NAME,
} from '../context-menu/src/index';

function makeColumns(): ColumnDef[] {
  return [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'age', title: 'Age', width: 80, type: 'number' },
  ];
}

function makeData(): Record<string, unknown>[] {
  return [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
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

function makeItem(id: string): ContextMenuItem {
  return {
    id,
    label: `Item ${id}`,
    contexts: ['cell'],
    action: vi.fn(),
  };
}

describe('Context Menu Plugin', () => {
  let container: HTMLDivElement;
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
      value: () => ({
        width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  function createMountedEngine(): SpreadsheetEngine {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });
    engine.mount(container);
    return engine;
  }

  it('has correct plugin name and version', () => {
    const plugin = createContextMenuPlugin();
    expect(plugin.name).toBe(CONTEXT_MENU_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers initial items on install', () => {
    const engine = createMountedEngine();
    const item = makeItem('custom-1');
    const plugin = createContextMenuPlugin([item]);

    engine.installPlugin(plugin);

    const mgr = engine.getContextMenuManager()!;
    expect(mgr.getItems().has('custom-1')).toBe(true);

    engine.destroy();
  });

  it('unregisters all items on destroy', () => {
    const engine = createMountedEngine();
    const item = makeItem('custom-2');
    const plugin = createContextMenuPlugin([item]);

    engine.installPlugin(plugin);

    const mgr = engine.getContextMenuManager()!;
    expect(mgr.getItems().has('custom-2')).toBe(true);

    engine.removePlugin(CONTEXT_MENU_PLUGIN_NAME);
    expect(mgr.getItems().has('custom-2')).toBe(false);

    engine.destroy();
  });

  it('dynamically added items via engine API', () => {
    const engine = createMountedEngine();
    engine.installPlugin(createContextMenuPlugin());

    const mgr = engine.getContextMenuManager()!;
    const beforeCount = mgr.getItems().size;

    engine.registerContextMenuItem(makeItem('dynamic-1'));
    expect(mgr.getItems().size).toBe(beforeCount + 1);

    engine.destroy();
  });

  it('works with plugin dependency chain', () => {
    const engine = createMountedEngine();
    engine.installPlugin(createContextMenuPlugin());

    const dependent = {
      name: 'my-extension',
      version: '1.0.0',
      dependencies: [CONTEXT_MENU_PLUGIN_NAME],
      install: vi.fn(),
    };
    engine.installPlugin(dependent);

    expect(dependent.install).toHaveBeenCalledTimes(1);
    expect(engine.getPluginNames()).toEqual([CONTEXT_MENU_PLUGIN_NAME, 'my-extension']);

    engine.destroy();
  });

  it('survives full lifecycle: install → use → destroy', () => {
    const engine = createMountedEngine();
    const items = [makeItem('lc-1'), makeItem('lc-2')];
    const plugin = createContextMenuPlugin(items);

    engine.installPlugin(plugin);

    const mgr = engine.getContextMenuManager()!;
    expect(mgr.getItems().has('lc-1')).toBe(true);
    expect(mgr.getItems().has('lc-2')).toBe(true);

    engine.destroy();
    expect(engine.getPlugin(CONTEXT_MENU_PLUGIN_NAME)).toBeUndefined();
  });
});
