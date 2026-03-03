// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
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

/** Mock CanvasRenderingContext2D for jsdom (which doesn't support Canvas 2D) */
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

describe('SpreadsheetEngine', () => {
  let container: HTMLDivElement;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    // Mock ResizeObserver (not available in jsdom)
    global.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      _callback: callback,
    })) as unknown as typeof ResizeObserver;

    // Mock Canvas getContext since jsdom doesn't implement Canvas 2D
    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    container = document.createElement('div');
    // jsdom doesn't implement getBoundingClientRect by default
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  it('creates instance with config', () => {
    const engine = new SpreadsheetEngine({ columns: [] });
    expect(engine).toBeDefined();
  });

  it('creates a canvas element on mount', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('removes canvas element on destroy', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);
    expect(container.querySelector('canvas')).not.toBeNull();

    engine.destroy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('getCanvasElement returns canvas after mount', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    expect(engine.getCanvasElement()).toBeNull();

    engine.mount(container);
    const canvas = engine.getCanvasElement();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);

    engine.destroy();
    expect(engine.getCanvasElement()).toBeNull();
  });

  it('handles double mount by destroying first', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);
    const firstCanvas = container.querySelector('canvas');
    expect(firstCanvas).not.toBeNull();

    // Second mount on same container — destroys old canvas, creates new one
    engine.mount(container);
    const canvases = container.querySelectorAll('canvas');
    // CanvasManager creates a single canvas
    expect(canvases).toHaveLength(1);
  });

  it('render does nothing when not mounted', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    // Should not throw
    engine.render();
  });

  it('getConfig returns the config', () => {
    const columns = makeColumns();
    const engine = new SpreadsheetEngine({ columns });
    expect(engine.getConfig().columns).toBe(columns);
  });

  it('sets up ResizeObserver on mount', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    // ResizeObserver should have been created and observe called
    expect(global.ResizeObserver).toHaveBeenCalledTimes(1);
    const observerInstance = (global.ResizeObserver as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(observerInstance.observe).toHaveBeenCalledWith(container);

    engine.destroy();

    // Should disconnect on destroy
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });

  it('getCell returns cell data after mount with data', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    const cell = engine.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Alice');

    const numCell = engine.getCell(1, 1);
    expect(numCell).toBeDefined();
    expect(numCell!.value).toBe(25);

    // Out of bounds returns undefined
    expect(engine.getCell(99, 99)).toBeUndefined();

    engine.destroy();
  });

  it('setCell writes value and triggers render', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    engine.setCell(0, 0, 'Charlie');
    const cell = engine.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Charlie');

    // Set on a new row beyond initial data
    engine.setCell(5, 0, 'New');
    expect(engine.getCell(5, 0)!.value).toBe('New');

    engine.destroy();
  });

  it('getCellStore returns CellStore instance', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    const store = engine.getCellStore();
    expect(store).toBeDefined();
    expect(store.size).toBe(0); // not mounted yet, store is empty

    engine.mount(container);

    // After mount with 2 rows × 2 columns = 4 cells
    expect(store.size).toBe(4);
    expect(store.get(0, 0)!.value).toBe('Alice');

    engine.destroy();
  });

  it('getSelection returns initial selection state', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    const sel = engine.getSelection();
    expect(sel.type).toBe('cell');
    expect(sel.activeCell).toEqual({ row: 0, col: 0 });
    expect(sel.ranges).toEqual([]);
  });

  it('selectCell updates selection and triggers selectionChange event', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    const handler = vi.fn();
    engine.on('selectionChange', handler);

    engine.selectCell(1, 1);

    const sel = engine.getSelection();
    expect(sel.type).toBe('cell');
    expect(sel.activeCell).toEqual({ row: 1, col: 1 });
    expect(sel.ranges).toEqual([{ startRow: 1, startCol: 1, endRow: 1, endCol: 1 }]);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].selection.activeCell).toEqual({ row: 1, col: 1 });

    engine.destroy();
  });

  it('getSelectionManager returns SelectionManager instance', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    const sm = engine.getSelectionManager();
    expect(sm).toBeDefined();
    expect(sm.rowCount).toBe(2); // 2 data rows
    expect(sm.colCount).toBe(2); // 2 columns

    sm.selectCell(0, 1);
    expect(engine.getSelection().activeCell).toEqual({ row: 0, col: 1 });
  });

  it('mounts with default theme and options', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    // Canvas should exist and have DPI-scaled dimensions
    const canvas = engine.getCanvasElement();
    expect(canvas).not.toBeNull();
    // jsdom devicePixelRatio defaults to 1
    expect(canvas!.width).toBe(800);
    expect(canvas!.height).toBe(600);

    engine.destroy();
  });

  it('getCellTypeRegistry returns CellTypeRegistry instance with register method', () => {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: makeData(),
    });

    engine.mount(container);

    const registry = engine.getCellTypeRegistry();
    expect(registry).toBeInstanceOf(CellTypeRegistry);
    expect(typeof registry.register).toBe('function');

    // Register a custom type and verify it works
    registry.register('custom' as any, {
      format: (v) => `[${v}]`,
      align: 'center',
    });
    const renderer = registry.get('custom' as any);
    expect(renderer).toBeDefined();
    expect(renderer!.format(42)).toBe('[42]');
    expect(renderer!.align).toBe('center');

    engine.destroy();
  });

  describe('mount() validation extraction', () => {
    it('extracts validation rules from ColumnDef and applies them', () => {
      const columns: ColumnDef[] = [
        {
          key: 'name',
          title: 'Name',
          width: 120,
          validation: [{ type: 'required', message: 'Name required' }],
        },
        { key: 'age', title: 'Age', width: 80, type: 'number' },
      ];
      const data = [
        { name: 'Alice', age: 30 },
        { name: '', age: 25 },
      ];

      const engine = new SpreadsheetEngine({ columns, data });
      engine.mount(container);

      // Row 1 has empty name — should have error status from validation
      const cell = engine.getCell(1, 0);
      expect(cell?.metadata?.status).toBe('error');
      expect(cell?.metadata?.errorMessage).toBe('Name required');

      // Row 0 has valid name — no error
      const validCell = engine.getCell(0, 0);
      expect(validCell?.metadata?.status).toBeUndefined();

      engine.destroy();
    });

    it('skips validation when columns have no validation rules', () => {
      const columns: ColumnDef[] = [
        { key: 'name', title: 'Name', width: 120 },
        { key: 'age', title: 'Age', width: 80, type: 'number' },
      ];
      const data = [{ name: '', age: 0 }];

      const engine = new SpreadsheetEngine({ columns, data });
      engine.mount(container);

      // No validation rules → no error metadata
      expect(engine.getCell(0, 0)?.metadata?.status).toBeUndefined();

      engine.destroy();
    });
  });
});
