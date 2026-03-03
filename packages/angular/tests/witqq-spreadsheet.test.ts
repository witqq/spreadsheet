// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetComponent } from '../src/witqq-spreadsheet.component';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ElementRef, SimpleChange, SimpleChanges } from '@angular/core';

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
    strokeRect: vi.fn(),
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

describe('SpreadsheetComponent (Angular)', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let component: SpreadsheetComponent;
  let container: HTMLDivElement;

  const columns: ColumnDef[] = [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'age', title: 'Age', width: 80, type: 'number' as const },
  ];

  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
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
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    container = document.createElement('div');
    container.tabIndex = 0;
    document.body.appendChild(container);

    component = new SpreadsheetComponent();
    component.columns = columns;
    component.data = data;
    component.containerRef = new ElementRef(container);
  });

  afterEach(() => {
    component.ngOnDestroy();
    container.remove();
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it('ngOnInit creates engine and mounts canvas', () => {
    component.ngOnInit();
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('ngOnDestroy cleans up engine', () => {
    component.ngOnInit();
    expect(container.querySelector('canvas')).not.toBeNull();
    component.ngOnDestroy();
    // Engine destroyed — no canvas after cleanup
  });

  it('getInstance returns SpreadsheetEngine', () => {
    component.ngOnInit();
    const engine = component.getInstance();
    expect(engine).toBeDefined();
    expect(engine.getConfig().columns).toEqual(columns);
  });

  it('getSelection returns current selection', () => {
    component.ngOnInit();
    const sel = component.getSelection();
    expect(sel).toBeDefined();
    expect(sel.activeCell).toBeDefined();
  });

  it('selectCell updates selection', () => {
    component.ngOnInit();
    component.selectCell(1, 1);
    const sel = component.getSelection();
    expect(sel.activeCell.row).toBe(1);
    expect(sel.activeCell.col).toBe(1);
  });

  it('getCell returns cell data', () => {
    component.ngOnInit();
    const cell = component.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Alice');
  });

  it('setCell updates cell value', () => {
    component.ngOnInit();
    component.setCell(0, 0, 'Eve');
    expect(component.getCell(0, 0)!.value).toBe('Eve');
  });

  it('undo/redo do not throw', () => {
    component.ngOnInit();
    expect(() => component.undo()).not.toThrow();
    expect(() => component.redo()).not.toThrow();
  });

  it('focus() focuses the container element', () => {
    component.ngOnInit();
    component.focus();
    // Container or a child within it should have focus
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it('requestRender() delegates without error', () => {
    component.ngOnInit();
    expect(() => component.requestRender()).not.toThrow();
  });

  it('scrollTo() delegates without error', () => {
    component.ngOnInit();
    expect(() => component.scrollTo(0, 100)).not.toThrow();
  });

  // ─── Output events ─────────────────────────────────────

  it('cellChange output emits on engine cellChange event', () => {
    component.ngOnInit();
    const spy = vi.fn();
    component.cellChange.subscribe(spy);

    const engine = component.getInstance();
    engine.getEventBus().emit('cellChange', {
      row: 0,
      col: 0,
      value: 'Eve',
      column: columns[0],
      oldValue: 'Alice',
      newValue: 'Eve',
      source: 'test',
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ row: 0, col: 0, newValue: 'Eve' }),
    );
  });

  it('selectionChange output emits on selectCell', () => {
    component.ngOnInit();
    const spy = vi.fn();
    component.selectionChange.subscribe(spy);
    component.selectCell(1, 0);
    expect(spy).toHaveBeenCalled();
  });

  // ─── ngOnChanges (Input updates) ──────────────────────

  it('theme change via ngOnChanges calls setTheme', () => {
    component.ngOnInit();
    const engine = component.getInstance();
    expect(engine.getTheme().name).toBe('light'); // default

    component.theme = darkTheme;
    component.ngOnChanges({
      theme: new SimpleChange(lightTheme, darkTheme, false),
    });

    expect(engine.getTheme().name).toBe('dark');
  });

  it('data change via ngOnChanges reloads cells', () => {
    component.ngOnInit();
    expect(component.getCell(0, 0)!.value).toBe('Alice');

    const newData = [
      { name: 'Charlie', age: 35 },
      { name: 'Dana', age: 28 },
    ];
    component.data = newData;
    component.ngOnChanges({
      data: new SimpleChange(data, newData, false),
    });

    expect(component.getCell(0, 0)!.value).toBe('Charlie');
  });

  it('first change in ngOnChanges is ignored (handled by ngOnInit)', () => {
    component.ngOnInit();
    const engine = component.getInstance();
    const spy = vi.spyOn(engine, 'setTheme');

    component.ngOnChanges({
      theme: new SimpleChange(undefined, lightTheme, true),
    });

    expect(spy).not.toHaveBeenCalled();
  });

  // ─── Additional coverage ──────────────────────────────

  it('installPlugin() delegates to engine without error', () => {
    component.ngOnInit();
    const mockPlugin = { name: 'test-plugin', install: vi.fn() };
    expect(() => component.installPlugin(mockPlugin as any)).not.toThrow();
  });

  it('removePlugin() delegates to engine without error', () => {
    component.ngOnInit();
    expect(() => component.removePlugin('nonexistent')).not.toThrow();
  });

  it('print() delegates to engine without error', () => {
    component.ngOnInit();
    expect(() => component.print()).not.toThrow();
  });

  it('getInstance() throws when engine not initialized', () => {
    // Do NOT call ngOnInit
    expect(() => component.getInstance()).toThrow('Spreadsheet not initialized');
  });
});
