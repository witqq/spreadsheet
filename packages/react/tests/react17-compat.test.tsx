// @vitest-environment jsdom
/**
 * React 17 compatibility tests.
 *
 * Verifies that the React wrapper uses only APIs available in React 17.0.0+
 * and that the build output contains no React 18/19-specific imports.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef, useState, useCallback } from 'react';
import { Spreadsheet } from '../src/components/Spreadsheet';
import type { SpreadsheetRef } from '../src/components/Spreadsheet';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import type { ColumnDef, SpreadsheetPlugin } from '@witqq/spreadsheet';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

describe('React 17 compatibility', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  const columns: ColumnDef[] = [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'value', title: 'Value', width: 100, type: 'number' as const },
  ];

  const data = [
    { name: 'Row1', value: 10 },
    { name: 'Row2', value: 20 },
    { name: 'Row3', value: 30 },
  ];

  beforeEach(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  // ─── Build output analysis ────────────────────────────────

  describe('build output contains no React 18+ APIs', () => {
    const react18OnlyAPIs = [
      'useId',
      'useSyncExternalStore',
      'useTransition',
      'useDeferredValue',
      'useInsertionEffect',
      'createRoot',
      'hydrateRoot',
    ];

    it('source files do not import React 18+ hooks', () => {
      const srcDir = path.resolve(__dirname, '..', 'src');
      const files = getAllTsFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const api of react18OnlyAPIs) {
          expect(content).not.toContain(api);
        }
      }
    });

    it('dist output does not reference React 18+ APIs', () => {
      const distDir = path.resolve(__dirname, '..', 'dist');
      if (!fs.existsSync(distDir)) return; // skip if not built

      const files = getAllFiles(distDir).filter(
        (f) => f.endsWith('.js') || f.endsWith('.cjs') || f.endsWith('.mjs'),
      );

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const api of react18OnlyAPIs) {
          expect(content).not.toContain(api);
        }
      }
    });
  });

  // ─── Core functionality under React 17-compatible patterns ─

  describe('component mounting and lifecycle', () => {
    it('mounts and renders canvas element', () => {
      const { container } = render(<Spreadsheet columns={columns} data={data} />);
      expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('unmounts cleanly without errors', () => {
      const { container, unmount } = render(<Spreadsheet columns={columns} data={data} />);
      expect(container.querySelector('canvas')).not.toBeNull();
      unmount();
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('mounts multiple instances simultaneously', () => {
      const { container } = render(
        <div>
          <Spreadsheet columns={columns} data={data} />
          <Spreadsheet columns={columns} data={[{ name: 'Other', value: 99 }]} />
        </div>,
      );
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(2);
    });
  });

  describe('ref API works with createRef (React 17 pattern)', () => {
    it('getInstance returns engine', () => {
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} />);
      expect(ref.current).not.toBeNull();
      expect(ref.current!.getInstance()).toBeDefined();
    });

    it('setCell and getCell roundtrip', () => {
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} />);
      ref.current!.setCell(0, 0, 'Updated');
      expect(ref.current!.getCell(0, 0)!.value).toBe('Updated');
    });

    it('undo/redo do not throw', () => {
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} />);
      expect(() => ref.current!.undo()).not.toThrow();
      expect(() => ref.current!.redo()).not.toThrow();
    });

    it('selectCell updates selection', () => {
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} />);
      ref.current!.selectCell(2, 1);
      expect(ref.current!.getSelection().activeCell.row).toBe(2);
      expect(ref.current!.getSelection().activeCell.col).toBe(1);
    });

    it('installPlugin and removePlugin work', () => {
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} />);
      const plugin: SpreadsheetPlugin = {
        name: 'test-compat-plugin',
        install: vi.fn(),
        destroy: vi.fn(),
      };
      expect(() => ref.current!.installPlugin(plugin)).not.toThrow();
      expect(plugin.install).toHaveBeenCalled();
      expect(() => ref.current!.removePlugin('test-compat-plugin')).not.toThrow();
    });
  });

  describe('callback props via event bus', () => {
    it('onCellChange fires through ref pattern', () => {
      const onCellChange = vi.fn();
      const ref = createRef<SpreadsheetRef>();
      render(<Spreadsheet ref={ref} columns={columns} data={data} onCellChange={onCellChange} />);

      ref.current!.getInstance().getEventBus().emit('cellChange', {
        row: 0, col: 0, value: 'X', column: columns[0], oldValue: 'Row1', newValue: 'X', source: 'test',
      });
      expect(onCellChange).toHaveBeenCalledTimes(1);
    });

    it('callback ref updates without remount', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const ref = createRef<SpreadsheetRef>();

      function TestApp() {
        const [v, setV] = useState(0);
        return (
          <>
            <button data-testid="switch" onClick={() => setV(1)}>S</button>
            <Spreadsheet ref={ref} columns={columns} data={data} onCellClick={v === 0 ? handler1 : handler2} />
          </>
        );
      }

      const { getByTestId } = render(<TestApp />);
      ref.current!.getInstance().getEventBus().emit('cellClick', { row: 0, col: 0, value: 'Row1', column: columns[0] });
      expect(handler1).toHaveBeenCalledTimes(1);

      act(() => { getByTestId('switch').click(); });
      ref.current!.getInstance().getEventBus().emit('cellClick', { row: 0, col: 0, value: 'Row1', column: columns[0] });
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme and data prop updates', () => {
    it('theme prop switch without remount', () => {
      const ref = createRef<SpreadsheetRef>();

      function TestApp() {
        const [dark, setDark] = useState(false);
        return (
          <>
            <button data-testid="t" onClick={() => setDark(true)}>T</button>
            <Spreadsheet ref={ref} columns={columns} data={data} theme={dark ? darkTheme : lightTheme} />
          </>
        );
      }

      const { getByTestId } = render(<TestApp />);
      const engine1 = ref.current!.getInstance();
      expect(engine1.getTheme()).toBe(lightTheme);

      act(() => { getByTestId('t').click(); });
      expect(ref.current!.getInstance()).toBe(engine1); // same instance
      expect(engine1.getTheme()).toBe(darkTheme);
    });

    it('data prop update reloads cells', () => {
      const ref = createRef<SpreadsheetRef>();

      function TestApp() {
        const [d, setD] = useState(data);
        const swap = useCallback(() => setD([{ name: 'New', value: 999 }]), []);
        return (
          <>
            <button data-testid="swap" onClick={swap}>S</button>
            <Spreadsheet ref={ref} columns={columns} data={d} />
          </>
        );
      }

      const { getByTestId } = render(<TestApp />);
      expect(ref.current!.getCell(0, 0)!.value).toBe('Row1');

      act(() => { getByTestId('swap').click(); });
      expect(ref.current!.getCell(0, 0)!.value).toBe('New');
    });
  });

  // ─── peerDependency range check ────────────────────────────

  describe('package.json peerDependencies', () => {
    it('includes React 17 in peer dependency range', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
      );
      expect(pkg.peerDependencies.react).toContain('^17.0.0');
      expect(pkg.peerDependencies['react-dom']).toContain('^17.0.0');
    });

    it('includes React 18 in peer dependency range', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
      );
      expect(pkg.peerDependencies.react).toContain('^18.0.0');
      expect(pkg.peerDependencies['react-dom']).toContain('^18.0.0');
    });

    it('includes React 19 in peer dependency range', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
      );
      expect(pkg.peerDependencies.react).toContain('^19.0.0');
      expect(pkg.peerDependencies['react-dom']).toContain('^19.0.0');
    });
  });
});

// ─── Helpers ─────────────────────────────────────────────────

function getAllTsFiles(dir: string): string[] {
  return getAllFiles(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
}

function getAllFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}
