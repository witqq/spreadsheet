// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import type { ColumnDef, CellData } from '../src/types/interfaces';

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

function makeColumns(overrides?: Partial<ColumnDef>[]): ColumnDef[] {
  const base: ColumnDef[] = [
    { key: 'a', title: 'A', width: 100 },
    { key: 'b', title: 'B', width: 100 },
    { key: 'c', title: 'C', width: 100 },
  ];
  if (overrides) {
    return base.map((col, i) => ({ ...col, ...overrides[i] }));
  }
  return base;
}

function makeData(): Record<string, unknown>[] {
  return [
    { a: 'A0', b: 'B0', c: 'C0' },
    { a: 'A1', b: 'B1', c: 'C1' },
    { a: 'A2', b: 'B2', c: 'C2' },
  ];
}

describe('Editing Access Control', () => {
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

  describe('isCellEditable priority chain', () => {
    it('returns false when global editable is false (default)', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
      });
      engine.mount(container);

      // Default editable is false
      expect(engine.isCellEditable(0, 0)).toBe(false);
      expect(engine.isCellEditable(1, 1)).toBe(false);
      engine.destroy();
    });

    it('returns true when global editable is true', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      expect(engine.isCellEditable(0, 0)).toBe(true);
      expect(engine.isCellEditable(1, 2)).toBe(true);
      engine.destroy();
    });

    it('column editable=false overrides global editable=true', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns([{}, { editable: false }, {}]),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      expect(engine.isCellEditable(0, 0)).toBe(true); // column A: inherits global
      expect(engine.isCellEditable(0, 1)).toBe(false); // column B: editable=false
      expect(engine.isCellEditable(0, 2)).toBe(true); // column C: inherits global
      engine.destroy();
    });

    it('column editable=true overrides global editable=false', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns([{}, { editable: true }, {}]),
        data: makeData(),
        editable: false,
      });
      engine.mount(container);

      expect(engine.isCellEditable(0, 0)).toBe(false); // column A: inherits global
      expect(engine.isCellEditable(0, 1)).toBe(true); // column B: editable=true
      expect(engine.isCellEditable(0, 2)).toBe(false); // column C: inherits global
      engine.destroy();
    });

    it('cell readOnly=true overrides column editable=true', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // Set cell (0,0) as readOnly using CellStore.set
      const physRow = 0; // no sorting, physical = visual
      engine.getCellStore().set(physRow, 0, { value: 'A0', readOnly: true });

      expect(engine.isCellEditable(0, 0)).toBe(false); // cell readOnly overrides
      expect(engine.isCellEditable(0, 1)).toBe(true); // other cells unaffected
      engine.destroy();
    });

    it('cell readOnly=false overrides column editable=false', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns([{ editable: false }, {}, {}]),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // Set cell (0,0) as explicitly not readOnly
      engine.getCellStore().set(0, 0, { value: 'A0', readOnly: false });

      expect(engine.isCellEditable(0, 0)).toBe(true); // cell readOnly=false overrides column
      expect(engine.isCellEditable(1, 0)).toBe(false); // other cells in column still blocked
      engine.destroy();
    });

    it('full priority chain: cell > column > global', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns([{ editable: false }, { editable: true }, {}]),
        data: makeData(),
        editable: false,
      });
      engine.mount(container);

      // Row 0, Col 0: column=false, global=false → false
      expect(engine.isCellEditable(0, 0)).toBe(false);

      // Row 0, Col 1: column=true → true
      expect(engine.isCellEditable(0, 1)).toBe(true);

      // Row 0, Col 2: column=undefined, global=false → false
      expect(engine.isCellEditable(0, 2)).toBe(false);

      // Override at cell level
      engine.getCellStore().set(0, 0, { value: 'A0', readOnly: false });
      expect(engine.isCellEditable(0, 0)).toBe(true); // cell overrides column

      engine.getCellStore().set(0, 1, { value: 'B0', readOnly: true });
      expect(engine.isCellEditable(0, 1)).toBe(false); // cell overrides column

      engine.destroy();
    });
  });

  describe('CellData.readOnly field', () => {
    it('readOnly is preserved through CellStore.set', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
      });
      engine.mount(container);

      engine.getCellStore().set(0, 0, { value: 'test', readOnly: true });
      const cell = engine.getCell(0, 0);
      expect(cell?.readOnly).toBe(true);
      expect(cell?.value).toBe('test');

      engine.destroy();
    });

    it('readOnly=false is distinct from undefined', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
      });
      engine.mount(container);

      engine.getCellStore().set(0, 0, { value: 'test', readOnly: false });
      const cell = engine.getCell(0, 0);
      expect(cell?.readOnly).toBe(false);

      // Cell without readOnly has undefined
      const otherCell = engine.getCell(0, 1);
      expect(otherCell?.readOnly).toBeUndefined();

      engine.destroy();
    });

    it('readOnly is preserved through bulkLoadCellData', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
      });
      engine.mount(container);

      const cellData: (CellData | null)[][] = [
        [{ value: 'X', readOnly: true }, { value: 'Y' }, null],
      ];
      engine.bulkLoadCellData(cellData, 0);

      expect(engine.getCell(0, 0)?.readOnly).toBe(true);
      expect(engine.getCell(0, 1)?.readOnly).toBeUndefined();

      engine.destroy();
    });
  });

  describe('clipboard respects editability', () => {
    it('read-only cells are protected from modification', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // Make cell (0,0) read-only
      engine.getCellStore().set(0, 0, { value: 'A0', readOnly: true });

      // Verify editability
      expect(engine.isCellEditable(0, 0)).toBe(false);
      expect(engine.isCellEditable(0, 1)).toBe(true);

      // Verify cell value is preserved
      expect(engine.getCell(0, 0)?.value).toBe('A0');
      expect(engine.getCell(0, 1)?.value).toBe('B0');

      engine.destroy();
    });

    it('paste respects read-only cells via isCellEditable', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // Make cell (0,1) read-only
      engine.getCellStore().set(0, 1, { value: 'B0', readOnly: true });

      // Verify read-only cell is protected
      expect(engine.isCellEditable(0, 0)).toBe(true);
      expect(engine.isCellEditable(0, 1)).toBe(false);

      engine.destroy();
    });

    it('column-level editable=false blocks editing', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns([{}, { editable: false }, {}]),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // Column B is not editable
      expect(engine.isCellEditable(0, 0)).toBe(true);
      expect(engine.isCellEditable(0, 1)).toBe(false);
      expect(engine.isCellEditable(0, 2)).toBe(true);

      engine.destroy();
    });
  });

  describe('existing editing tests continue to pass', () => {
    it('editing works when global editable=true', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
        editable: true,
      });
      engine.mount(container);

      // All cells should be editable
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          expect(engine.isCellEditable(row, col)).toBe(true);
        }
      }
      engine.destroy();
    });

    it('no editing when global editable=false (default)', () => {
      const engine = new SpreadsheetEngine({
        columns: makeColumns(),
        data: makeData(),
      });
      engine.mount(container);

      // All cells should be non-editable
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          expect(engine.isCellEditable(row, col)).toBe(false);
        }
      }
      engine.destroy();
    });
  });
});
