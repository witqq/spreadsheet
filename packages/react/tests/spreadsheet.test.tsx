// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef, useState, useCallback } from 'react';
import { Spreadsheet } from '../src/components/Spreadsheet';
import type { SpreadsheetRef, SpreadsheetProps } from '../src/components/Spreadsheet';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';

/** Mock CanvasRenderingContext2D for jsdom */
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

describe('Spreadsheet', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    // Mock ResizeObserver (not available in jsdom)
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    // Mock getBoundingClientRect for container divs
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
    cleanup();
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
    const { container } = render(<Spreadsheet columns={columns} data={data} />);
    const div = container.firstElementChild;
    expect(div).toBeInstanceOf(HTMLDivElement);
  });

  it('creates a canvas element inside the container', () => {
    const { container } = render(<Spreadsheet columns={columns} data={data} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('removes canvas on unmount', () => {
    const { container, unmount } = render(<Spreadsheet columns={columns} data={data} />);
    expect(container.querySelector('canvas')).not.toBeNull();

    unmount();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('exposes engine instance via ref', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);

    expect(ref.current).not.toBeNull();
    const engine = ref.current!.getInstance();
    expect(engine).toBeDefined();
    expect(engine.getConfig().columns).toEqual(columns);
  });

  it('applies className and style props', () => {
    const { container } = render(
      <Spreadsheet
        columns={columns}
        data={data}
        className="my-table"
        style={{ border: '1px solid red' }}
      />,
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe('my-table');
    expect(div.style.border).toBe('1px solid red');
  });

  // ─── Ref API ──────────────────────────────────────────────

  it('ref.getSelection returns current selection', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);
    const sel = ref.current!.getSelection();
    expect(sel).toBeDefined();
    expect(sel.activeCell).toBeDefined();
  });

  it('ref.selectCell updates selection', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);
    ref.current!.selectCell(1, 1);
    const sel = ref.current!.getSelection();
    expect(sel.activeCell.row).toBe(1);
    expect(sel.activeCell.col).toBe(1);
  });

  it('ref.getCell returns cell data', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);
    const cell = ref.current!.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.value).toBe('Alice');
  });

  it('ref.setCell updates cell value', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);
    ref.current!.setCell(0, 0, 'Eve');
    const cell = ref.current!.getCell(0, 0);
    expect(cell!.value).toBe('Eve');
  });

  it('ref.undo/redo do not throw', () => {
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} />);
    expect(() => ref.current!.undo()).not.toThrow();
    expect(() => ref.current!.redo()).not.toThrow();
  });

  // ─── Callback props ──────────────────────────────────────

  it('onCellChange fires when cell is edited', () => {
    const onCellChange = vi.fn();
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} onCellChange={onCellChange} />);

    // Trigger a cell change via engine
    const engine = ref.current!.getInstance();
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

    expect(onCellChange).toHaveBeenCalledTimes(1);
    expect(onCellChange).toHaveBeenCalledWith(
      expect.objectContaining({ row: 0, col: 0, newValue: 'Eve' }),
    );
  });

  it('onSelectionChange fires on selection update', () => {
    const onSelectionChange = vi.fn();
    const ref = createRef<SpreadsheetRef>();
    render(<Spreadsheet ref={ref} columns={columns} data={data} onSelectionChange={onSelectionChange} />);

    ref.current!.selectCell(1, 0);
    expect(onSelectionChange).toHaveBeenCalled();
  });

  // ─── Theme prop update ────────────────────────────────────

  it('theme prop update switches theme without remount', () => {
    const ref = createRef<SpreadsheetRef>();

    function TestApp() {
      const [dark, setDark] = useState(false);
      const toggle = useCallback(() => setDark((d) => !d), []);
      return (
        <>
          <button data-testid="toggle" onClick={toggle}>T</button>
          <Spreadsheet
            ref={ref}
            columns={columns}
            data={data}
            theme={dark ? darkTheme : lightTheme}
          />
        </>
      );
    }

    const { getByTestId } = render(<TestApp />);
    const engine1 = ref.current!.getInstance();
    expect(engine1.getTheme()).toBe(lightTheme);

    act(() => {
      getByTestId('toggle').click();
    });

    // Same engine instance — no remount
    const engine2 = ref.current!.getInstance();
    expect(engine1).toBe(engine2);
    expect(engine2.getTheme()).toBe(darkTheme);
  });

  // ─── Generic type support ─────────────────────────────────

  it('accepts generic row type for data', () => {
    interface Employee {
      name: string;
      age: number;
    }
    const typedData: Employee[] = [{ name: 'Alice', age: 30 }];

    // This is a compile-time check — if Spreadsheet<Employee> doesn't accept Employee[], TS fails
    const { container } = render(
      <Spreadsheet<Employee> columns={columns} data={typedData} />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
