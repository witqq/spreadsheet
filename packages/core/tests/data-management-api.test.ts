// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import type { CellData, ColumnDef } from '../src/types/interfaces';

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

describe('Data Management API', () => {
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

  function createEngine(data?: Record<string, unknown>[]): SpreadsheetEngine {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: data ?? makeData(),
      editable: true,
    });
    engine.mount(container);
    return engine;
  }

  describe('setData', () => {
    it('replaces all data atomically', () => {
      const engine = createEngine();
      expect(engine.getCell(0, 0)!.value).toBe('Alice');

      engine.setData([
        { name: 'Charlie', age: 35 },
        { name: 'Diana', age: 28 },
        { name: 'Eve', age: 22 },
      ]);

      expect(engine.getCell(0, 0)!.value).toBe('Charlie');
      expect(engine.getCell(1, 0)!.value).toBe('Diana');
      expect(engine.getCell(2, 0)!.value).toBe('Eve');
      expect(engine.getRowCount()).toBe(3);
      engine.destroy();
    });

    it('clears old data when replacing', () => {
      const engine = createEngine();
      expect(engine.getCellStore().size).toBe(4); // 2 rows × 2 cols

      engine.setData([{ name: 'Only', age: 1 }]);

      expect(engine.getCellStore().size).toBe(2); // 1 row × 2 cols
      expect(engine.getCell(1, 0)).toBeUndefined(); // old row 1 gone
      expect(engine.getRowCount()).toBe(1);
      engine.destroy();
    });

    it('derives column keys from config when not provided', () => {
      const engine = createEngine();
      engine.setData([{ name: 'Test', age: 99, extra: 'ignored' }]);

      expect(engine.getCell(0, 0)!.value).toBe('Test');
      expect(engine.getCell(0, 1)!.value).toBe(99);
      expect(engine.getCellStore().size).toBe(2); // 'extra' not loaded
      engine.destroy();
    });

    it('accepts explicit column keys', () => {
      const engine = createEngine();
      engine.setData([{ name: 'Test', age: 99 }], ['age']);

      // Only 'age' column loaded (at col index 0 since keys=[age])
      expect(engine.getCell(0, 0)!.value).toBe(99);
      expect(engine.getCellStore().size).toBe(1);
      engine.destroy();
    });

    it('handles empty data', () => {
      const engine = createEngine();
      expect(engine.getCellStore().size).toBe(4);

      engine.setData([]);

      expect(engine.getCellStore().size).toBe(0);
      expect(engine.getRowCount()).toBe(0);
      engine.destroy();
    });

    it('updates row count correctly', () => {
      const engine = createEngine();
      expect(engine.getRowCount()).toBe(2);

      engine.setData([
        { name: 'A', age: 1 },
        { name: 'B', age: 2 },
        { name: 'C', age: 3 },
        { name: 'D', age: 4 },
        { name: 'E', age: 5 },
      ]);

      expect(engine.getRowCount()).toBe(5);
      engine.destroy();
    });
  });

  describe('setDataCellData', () => {
    it('replaces all data with CellData arrays', () => {
      const engine = createEngine();

      engine.setDataCellData([
        [{ value: 'X' }, { value: 100 }],
        [{ value: 'Y' }, { value: 200 }],
      ]);

      expect(engine.getCell(0, 0)!.value).toBe('X');
      expect(engine.getCell(0, 1)!.value).toBe(100);
      expect(engine.getCell(1, 0)!.value).toBe('Y');
      expect(engine.getRowCount()).toBe(2);
      engine.destroy();
    });

    it('preserves styles and metadata', () => {
      const engine = createEngine();

      const cellData: CellData = {
        value: 'Styled',
        style: { backgroundColor: '#ff0000' },
        metadata: { validated: true },
        custom: { source: 'import' },
        readOnly: true,
      };
      engine.setDataCellData([[cellData]]);

      const cell = engine.getCell(0, 0)!;
      expect(cell.value).toBe('Styled');
      expect(cell.style?.backgroundColor).toBe('#ff0000');
      expect(cell.metadata?.validated).toBe(true);
      expect(cell.custom?.source).toBe('import');
      expect(cell.readOnly).toBe(true);
      engine.destroy();
    });

    it('clears old data when replacing', () => {
      const engine = createEngine();
      expect(engine.getCellStore().size).toBe(4);

      engine.setDataCellData([[{ value: 'only' }]]);

      expect(engine.getCellStore().size).toBe(1);
      expect(engine.getCell(1, 0)).toBeUndefined();
      engine.destroy();
    });

    it('supports startRow offset', () => {
      const engine = createEngine();

      engine.setDataCellData([[{ value: 'Offset' }]], 5);

      expect(engine.getCell(5, 0)!.value).toBe('Offset');
      expect(engine.getRowCount()).toBe(6); // startRow(5) + data.length(1)
      engine.destroy();
    });

    it('handles empty data', () => {
      const engine = createEngine();
      engine.setDataCellData([]);

      expect(engine.getCellStore().size).toBe(0);
      expect(engine.getRowCount()).toBe(0);
      engine.destroy();
    });
  });

  describe('appendRows', () => {
    it('adds rows after existing data', () => {
      const engine = createEngine();
      expect(engine.getRowCount()).toBe(2);

      engine.appendRows([
        { name: 'Charlie', age: 35 },
        { name: 'Diana', age: 28 },
      ]);

      expect(engine.getRowCount()).toBe(4);
      expect(engine.getCell(0, 0)!.value).toBe('Alice'); // original preserved
      expect(engine.getCell(2, 0)!.value).toBe('Charlie'); // appended
      expect(engine.getCell(3, 0)!.value).toBe('Diana');
      engine.destroy();
    });

    it('preserves existing data', () => {
      const engine = createEngine();
      const originalSize = engine.getCellStore().size;

      engine.appendRows([{ name: 'New', age: 1 }]);

      // Original 4 cells + 2 new cells = 6
      expect(engine.getCellStore().size).toBe(originalSize + 2);
      expect(engine.getCell(0, 0)!.value).toBe('Alice');
      expect(engine.getCell(1, 0)!.value).toBe('Bob');
      engine.destroy();
    });

    it('handles empty append gracefully', () => {
      const engine = createEngine();
      const countBefore = engine.getRowCount();
      const sizeBefore = engine.getCellStore().size;

      engine.appendRows([]);

      expect(engine.getRowCount()).toBe(countBefore);
      expect(engine.getCellStore().size).toBe(sizeBefore);
      engine.destroy();
    });

    it('derives column keys from config', () => {
      const engine = createEngine();
      engine.appendRows([{ name: 'Test', age: 42, extra: 'skip' }]);

      expect(engine.getCell(2, 0)!.value).toBe('Test');
      expect(engine.getCell(2, 1)!.value).toBe(42);
      // 'extra' not loaded — only 2 cols per row
      expect(engine.getCellStore().size).toBe(6); // 4 original + 2 new
      engine.destroy();
    });
  });

  describe('replaceRows', () => {
    it('replaces rows at a specific offset', () => {
      const engine = createEngine();

      engine.replaceRows(1, [{ name: 'Replaced', age: 99 }]);

      expect(engine.getCell(0, 0)!.value).toBe('Alice'); // row 0 untouched
      expect(engine.getCell(1, 0)!.value).toBe('Replaced'); // row 1 replaced
      expect(engine.getCell(1, 1)!.value).toBe(99);
      expect(engine.getRowCount()).toBe(2);
      engine.destroy();
    });

    it('extends row count if replacement exceeds current bounds', () => {
      const engine = createEngine();
      expect(engine.getRowCount()).toBe(2);

      engine.replaceRows(3, [{ name: 'Extended', age: 50 }]);

      expect(engine.getRowCount()).toBe(4); // 3 + 1
      expect(engine.getCell(3, 0)!.value).toBe('Extended');
      engine.destroy();
    });

    it('does not shrink row count', () => {
      const engine = createEngine();
      expect(engine.getRowCount()).toBe(2);

      engine.replaceRows(0, [{ name: 'Single', age: 1 }]);

      expect(engine.getRowCount()).toBe(2); // still 2, not shrunk to 1
      engine.destroy();
    });

    it('handles empty replacement gracefully', () => {
      const engine = createEngine();
      const countBefore = engine.getRowCount();

      engine.replaceRows(0, []);

      expect(engine.getRowCount()).toBe(countBefore);
      engine.destroy();
    });

    it('preserves data in non-replaced rows', () => {
      const engine = createEngine();

      engine.replaceRows(0, [{ name: 'NewFirst', age: 100 }]);

      expect(engine.getCell(0, 0)!.value).toBe('NewFirst');
      expect(engine.getCell(1, 0)!.value).toBe('Bob'); // untouched
      engine.destroy();
    });

    it('clears stale cells when replacement rows omit columns', () => {
      const engine = createEngine();
      expect(engine.getCell(0, 1)!.value).toBe(30); // Alice's age

      engine.replaceRows(0, [{ name: 'Charlie' }]); // no age

      expect(engine.getCell(0, 0)!.value).toBe('Charlie');
      expect(engine.getCell(0, 1)).toBeUndefined(); // stale age cleared
      engine.destroy();
    });
  });
});
