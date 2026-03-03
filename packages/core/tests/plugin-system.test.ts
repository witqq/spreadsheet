// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import type { SpreadsheetPlugin } from '../src/plugins/plugin-types';
import type { ColumnDef } from '../src/types/interfaces';

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

describe('Plugin System', () => {
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

  function createEngine(): SpreadsheetEngine {
    return new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });
  }

  function createPlugin(overrides?: Partial<SpreadsheetPlugin>): SpreadsheetPlugin {
    return {
      name: 'test-plugin',
      version: '1.0.0',
      install: vi.fn(),
      destroy: vi.fn(),
      ...overrides,
    };
  }

  describe('installPlugin', () => {
    it('installs a plugin before mount (deferred install)', () => {
      const engine = createEngine();
      const plugin = createPlugin();

      engine.installPlugin(plugin);

      expect(engine.getPlugin('test-plugin')).toBe(plugin);
      // install() is NOT called yet — engine not mounted
      expect(plugin.install).not.toHaveBeenCalled();
    });

    it('calls install() when engine mounts', () => {
      const engine = createEngine();
      const plugin = createPlugin();

      engine.installPlugin(plugin);
      engine.mount(container);

      expect(plugin.install).toHaveBeenCalledTimes(1);
      const api = (plugin.install as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(api.engine).toBe(engine);

      engine.destroy();
    });

    it('calls install() immediately if engine already mounted', () => {
      const engine = createEngine();
      engine.mount(container);

      const plugin = createPlugin();
      engine.installPlugin(plugin);

      expect(plugin.install).toHaveBeenCalledTimes(1);

      engine.destroy();
    });

    it('throws on double install', () => {
      const engine = createEngine();
      const plugin = createPlugin();

      engine.installPlugin(plugin);

      expect(() => engine.installPlugin(plugin)).toThrow(
        'Plugin "test-plugin" is already installed',
      );
    });

    it('throws if dependency is missing', () => {
      const engine = createEngine();
      const plugin = createPlugin({
        name: 'child',
        dependencies: ['parent'],
      });

      expect(() => engine.installPlugin(plugin)).toThrow(
        'Plugin "child" requires "parent" which is not installed',
      );
    });

    it('installs plugin with satisfied dependencies', () => {
      const engine = createEngine();
      engine.mount(container);

      const parent = createPlugin({ name: 'parent' });
      const child = createPlugin({ name: 'child', dependencies: ['parent'] });

      engine.installPlugin(parent);
      engine.installPlugin(child);

      expect(engine.getPlugin('parent')).toBe(parent);
      expect(engine.getPlugin('child')).toBe(child);

      engine.destroy();
    });
  });

  describe('removePlugin', () => {
    it('calls destroy and removes plugin', () => {
      const engine = createEngine();
      engine.mount(container);

      const plugin = createPlugin();
      engine.installPlugin(plugin);

      engine.removePlugin('test-plugin');

      expect(plugin.destroy).toHaveBeenCalledTimes(1);
      expect(engine.getPlugin('test-plugin')).toBeUndefined();

      engine.destroy();
    });

    it('no-op for non-existent plugin', () => {
      const engine = createEngine();
      expect(() => engine.removePlugin('nonexistent')).not.toThrow();
    });

    it('throws if another plugin depends on it', () => {
      const engine = createEngine();
      engine.mount(container);

      const parent = createPlugin({ name: 'parent' });
      const child = createPlugin({ name: 'child', dependencies: ['parent'] });

      engine.installPlugin(parent);
      engine.installPlugin(child);

      expect(() => engine.removePlugin('parent')).toThrow(
        'Cannot remove plugin "parent": "child" depends on it',
      );

      engine.destroy();
    });
  });

  describe('getPlugin / getPluginNames', () => {
    it('returns undefined for non-existent plugin', () => {
      const engine = createEngine();
      expect(engine.getPlugin('nope')).toBeUndefined();
    });

    it('returns all installed plugin names', () => {
      const engine = createEngine();
      engine.installPlugin(createPlugin({ name: 'a' }));
      engine.installPlugin(createPlugin({ name: 'b' }));

      expect(engine.getPluginNames()).toEqual(['a', 'b']);
    });
  });

  describe('PluginAPI state isolation', () => {
    it('provides isolated state per plugin', () => {
      const engine = createEngine();
      engine.mount(container);

      let apiA: any;
      let apiB: any;

      engine.installPlugin(createPlugin({
        name: 'a',
        install: (api) => { apiA = api; api.setPluginState('val', 42); },
      }));
      engine.installPlugin(createPlugin({
        name: 'b',
        install: (api) => { apiB = api; api.setPluginState('val', 99); },
      }));

      expect(apiA.getPluginState('val')).toBe(42);
      expect(apiB.getPluginState('val')).toBe(99);

      engine.destroy();
    });

    it('clears state on plugin removal', () => {
      const engine = createEngine();
      engine.mount(container);

      let captured: any;
      engine.installPlugin(createPlugin({
        name: 'x',
        install: (api) => { captured = api; api.setPluginState('k', 'v'); },
      }));

      expect(captured.getPluginState('k')).toBe('v');
      engine.removePlugin('x');
      expect(captured.getPluginState('k')).toBeUndefined();

      engine.destroy();
    });
  });

  describe('lifecycle on destroy', () => {
    it('destroys all plugins in reverse order', () => {
      const engine = createEngine();
      const order: string[] = [];

      engine.installPlugin(createPlugin({
        name: 'first',
        destroy: () => { order.push('first'); },
      }));
      engine.installPlugin(createPlugin({
        name: 'second',
        destroy: () => { order.push('second'); },
      }));

      engine.mount(container);
      engine.destroy();

      expect(order).toEqual(['second', 'first']);
    });

    it('handles plugins without destroy gracefully', () => {
      const engine = createEngine();
      engine.installPlugin(createPlugin({ name: 'no-destroy', destroy: undefined }));
      engine.mount(container);

      expect(() => engine.destroy()).not.toThrow();
    });
  });
});
