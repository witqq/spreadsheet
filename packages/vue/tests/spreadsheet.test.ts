// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref as vueRef } from 'vue';
import { Spreadsheet } from '../src/Spreadsheet';
import type { SpreadsheetExposed } from '../src/Spreadsheet';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
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

describe('Spreadsheet (Vue)', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

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
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  const columns: ColumnDef[] = [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'age', title: 'Age', width: 80, type: 'number' as const },
  ];

  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ];

  it('renders a container div', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    expect(wrapper.element.tagName).toBe('DIV');
  });

  it('creates a canvas element inside the container', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    expect(wrapper.find('canvas').exists()).toBe(true);
  });

  it('removes canvas on unmount', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    expect(wrapper.find('canvas').exists()).toBe(true);
    wrapper.unmount();
    // After unmount the engine.destroy() cleans up the container
  });

  it('exposes engine instance via ref', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    const engine = exposed.getInstance();
    expect(engine).toBeDefined();
    expect(engine.getConfig().columns).toEqual(columns);
  });

  // ─── Exposed API ──────────────────────────────────────────

  it('getSelection returns current selection', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    const sel = exposed.getSelection();
    expect(sel).toBeDefined();
    expect(sel.activeCell).toBeDefined();
  });

  it('selectCell updates selection', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    exposed.selectCell(1, 1);
    const sel = exposed.getSelection();
    expect(sel.activeCell.row).toBe(1);
    expect(sel.activeCell.col).toBe(1);
  });

  it('getCell returns cell data', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    const cell = exposed.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Alice');
  });

  it('setCell updates cell value', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    exposed.setCell(0, 0, 'Eve');
    const cell = exposed.getCell(0, 0);
    expect(cell!.value).toBe('Eve');
  });

  it('undo/redo do not throw', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    expect(() => exposed.undo()).not.toThrow();
    expect(() => exposed.redo()).not.toThrow();
  });

  it('focus() focuses the container element', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data }, attachTo: document.body });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    exposed.focus();
    expect(document.activeElement).toBe(wrapper.element);
    wrapper.unmount();
  });

  it('requestRender() delegates without error', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    expect(() => exposed.requestRender()).not.toThrow();
  });

  it('scrollTo() delegates without error', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    expect(() => exposed.scrollTo(0, 100)).not.toThrow();
  });

  // ─── Events ───────────────────────────────────────────────

  it('emits cellChange when cell is edited via engine', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    const engine = exposed.getInstance();

    engine.setCell(0, 0, 'Eve');
    engine.getEventBus().emit('cellChange', {
      row: 0,
      col: 0,
      value: 'Eve',
      column: columns[0],
      oldValue: 'Alice',
      newValue: 'Eve',
      source: 'test',
    });

    expect(wrapper.emitted('cellChange')).toBeDefined();
    expect(wrapper.emitted('cellChange')!.length).toBe(1);
  });

  it('emits selectionChange on selectCell', () => {
    const wrapper = mount(Spreadsheet, { props: { columns, data } });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    exposed.selectCell(1, 0);
    expect(wrapper.emitted('selectionChange')).toBeDefined();
  });

  // ─── Theme update ─────────────────────────────────────────

  it('theme prop update switches theme without remount', async () => {
    const wrapper = mount(Spreadsheet, {
      props: { columns, data, theme: lightTheme },
    });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    const engine1 = exposed.getInstance();
    expect(engine1.getTheme().name).toBe('light');

    await wrapper.setProps({ theme: darkTheme });
    await nextTick();

    const engine2 = exposed.getInstance();
    expect(engine1).toBe(engine2); // same instance, no remount
    expect(engine2.getTheme().name).toBe('dark');
  });

  // ─── Data update ──────────────────────────────────────────

  it('data prop update reloads cells', async () => {
    const wrapper = mount(Spreadsheet, {
      props: { columns, data },
    });
    const exposed = wrapper.vm as unknown as SpreadsheetExposed;
    expect(exposed.getCell(0, 0)!.value).toBe('Alice');

    const newData = [
      { name: 'Charlie', age: 35 },
      { name: 'Dana', age: 28 },
      { name: 'Eve', age: 22 },
    ];
    await wrapper.setProps({ data: newData });
    await nextTick();

    expect(exposed.getCell(0, 0)!.value).toBe('Charlie');
    expect(exposed.getCell(2, 0)!.value).toBe('Eve');
  });
});
