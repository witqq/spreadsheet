// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create, embed, SpreadsheetEngine, lightTheme, darkTheme } from '../src/index';
import type { WidgetConfig } from '../src/index';
import type { ColumnDef } from '@witqq/spreadsheet';

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

describe('@witqq/spreadsheet-widget', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;
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
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(createMockCtx()) as any;

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
    container.id = 'test-grid';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  // ─── create() ─────────────────────────────────────────

  it('create() with HTMLElement mounts canvas', () => {
    const engine = create(container, { columns, data });
    expect(container.querySelector('canvas')).not.toBeNull();
    engine.destroy();
  });

  it('create() with CSS selector mounts canvas', () => {
    const engine = create('#test-grid', { columns, data });
    expect(container.querySelector('canvas')).not.toBeNull();
    engine.destroy();
  });

  it('create() throws on invalid selector', () => {
    expect(() => create('#nonexistent', { columns, data })).toThrow(
      'container not found',
    );
  });

  it('create() throws on null element', () => {
    expect(() => create(null as any, { columns, data })).toThrow(
      'container not found',
    );
  });

  it('create() returns SpreadsheetEngine instance', () => {
    const engine = create(container, { columns, data });
    expect(engine).toBeInstanceOf(SpreadsheetEngine);
    engine.destroy();
  });

  it('create() with autoMount: false does not mount', () => {
    const engine = create(container, { columns, data, autoMount: false });
    expect(container.querySelector('canvas')).toBeNull();
    // Manual mount
    engine.mount(container);
    expect(container.querySelector('canvas')).not.toBeNull();
    engine.destroy();
  });

  it('create() passes config to engine', () => {
    const engine = create(container, {
      columns,
      data,
      editable: true,
      sortable: true,
      frozenRows: 1,
    });
    const cfg = engine.getConfig();
    expect(cfg.editable).toBe(true);
    expect(cfg.sortable).toBe(true);
    expect(cfg.frozenRows).toBe(1);
    engine.destroy();
  });

  // ─── embed() ──────────────────────────────────────────

  it('embed() returns engine and destroy handle', () => {
    const handle = embed(container, { columns, data });
    expect(handle.engine).toBeInstanceOf(SpreadsheetEngine);
    expect(typeof handle.destroy).toBe('function');
    handle.destroy();
  });

  it('embed() destroy() cleans up engine', () => {
    const handle = embed(container, { columns, data });
    expect(container.querySelector('canvas')).not.toBeNull();
    handle.destroy();
  });

  // ─── Data access ──────────────────────────────────────

  it('created widget has accessible cell data', () => {
    const engine = create(container, { columns, data });
    const cell = engine.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Alice');
    engine.destroy();
  });

  it('created widget supports editing', () => {
    const engine = create(container, { columns, data, editable: true });
    engine.setCell(0, 0, 'Eve');
    expect(engine.getCell(0, 0)!.value).toBe('Eve');
    engine.destroy();
  });

  it('created widget supports selection', () => {
    const engine = create(container, { columns, data });
    engine.selectCell(1, 1);
    const sel = engine.getSelection();
    expect(sel.activeCell.row).toBe(1);
    expect(sel.activeCell.col).toBe(1);
    engine.destroy();
  });

  // ─── Theme exports ────────────────────────────────────

  it('lightTheme is exported', () => {
    expect(lightTheme).toBeDefined();
    expect(lightTheme.name).toBe('light');
  });

  it('darkTheme is exported', () => {
    expect(darkTheme).toBeDefined();
    expect(darkTheme.name).toBe('dark');
  });

  it('create() with theme applies it', () => {
    const engine = create(container, { columns, data, theme: darkTheme });
    expect(engine.getTheme().name).toBe('dark');
    engine.destroy();
  });
});
