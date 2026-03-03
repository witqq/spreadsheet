import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingAdapter } from '../src/streaming/streaming-adapter';
import type { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import type { CellStore } from '../src/model/cell-store';
import type { DataView } from '../src/dataview/data-view';
import type { DirtyTracker } from '../src/renderer/dirty-tracker';
import type { EventBus } from '../src/events/event-bus';

import type { RowStore } from '../src/model/row-store';

function createMockCellStore(): CellStore {
  const cells = new Map<string, { value: unknown }>();
  return {
    get: vi.fn((row: number, col: number) => cells.get(`${row}:${col}`)),
    set: vi.fn((row: number, col: number, data: { value: unknown }) => {
      cells.set(`${row}:${col}`, data);
    }),
    setValue: vi.fn((row: number, col: number, value: unknown) => {
      cells.set(`${row}:${col}`, { value });
    }),
    delete: vi.fn((row: number, col: number) => {
      cells.delete(`${row}:${col}`);
      return true;
    }),
    has: vi.fn((row: number, col: number) => cells.has(`${row}:${col}`)),
    _cells: cells,
  } as unknown as CellStore;
}

function createMockDataView(): DataView {
  return {
    getPhysicalRow: vi.fn((logical: number) => logical),
    getLogicalRow: vi.fn((physical: number) => physical),
    totalRowCount: 0,
  } as unknown as DataView;
}

function createMockEngine(initialRowCount: number = 0) {
  let rowCount = initialRowCount;
  const cellStore = createMockCellStore();
  const dataView = createMockDataView();
  const dirtyTracker = { markDirty: vi.fn() } as unknown as DirtyTracker;
  const rowStore = { shiftRowsUp: vi.fn() } as unknown as RowStore;
  const eventBus = { emit: vi.fn() } as unknown as EventBus;

  const engine = {
    getCellStore: vi.fn(() => cellStore),
    getDataView: vi.fn(() => dataView),
    getDirtyTracker: vi.fn(() => dirtyTracker),
    getEventBus: vi.fn(() => eventBus),
    getRowCount: vi.fn(() => rowCount),
    getRowStore: vi.fn(() => rowStore),
    setRowCount: vi.fn((count: number) => { rowCount = count; }),
    requestRender: vi.fn(),
    _cellStore: cellStore,
    _dirtyTracker: dirtyTracker,
    _eventBus: eventBus,
    _rowStore: rowStore,
    _getRowCount: () => rowCount,
  } as unknown as SpreadsheetEngine & {
    _cellStore: CellStore;
    _dirtyTracker: DirtyTracker;
    _eventBus: EventBus;
    _rowStore: RowStore;
    _getRowCount: () => number;
  };

  return engine;
}

describe('StreamingAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('pushRows', () => {
    test('appends rows to CellStore after throttle', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['name', 'value'],
        throttleMs: 50,
      });

      adapter.pushRows([
        { name: 'Alice', value: 100 },
        { name: 'Bob', value: 200 },
      ]);

      // Not yet flushed
      expect(engine.setRowCount).not.toHaveBeenCalled();

      // Advance timer
      vi.advanceTimersByTime(50);

      expect(engine.setRowCount).toHaveBeenCalledWith(12);
      const store = engine._cellStore as unknown as { _cells: Map<string, { value: unknown }> };
      expect(store._cells.get('10:0')?.value).toBe('Alice');
      expect(store._cells.get('10:1')?.value).toBe(100);
      expect(store._cells.get('11:0')?.value).toBe('Bob');
      expect(store._cells.get('11:1')?.value).toBe(200);
    });

    test('multiple pushRows within throttle window are batched', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['id'],
        throttleMs: 100,
      });

      adapter.pushRows([{ id: 1 }]);
      adapter.pushRows([{ id: 2 }]);
      adapter.pushRows([{ id: 3 }]);

      vi.advanceTimersByTime(100);

      // Should be called once with final count
      expect(engine.setRowCount).toHaveBeenCalledTimes(1);
      expect(engine.setRowCount).toHaveBeenCalledWith(3);
    });

    test('skips null/undefined values', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['a', 'b'],
        throttleMs: 10,
      });

      adapter.pushRows([{ a: 'yes', b: null }]);
      vi.advanceTimersByTime(10);

      const store = engine._cellStore;
      expect(store.setValue).toHaveBeenCalledWith(0, 0, 'yes');
      expect(store.setValue).not.toHaveBeenCalledWith(0, 1, null);
    });

    test('ignores empty rows array', () => {
      const engine = createMockEngine(5);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 10,
      });

      adapter.pushRows([]);
      vi.advanceTimersByTime(10);

      expect(engine.setRowCount).not.toHaveBeenCalled();
    });
  });

  describe('updateRow', () => {
    test('updates cells at given row index', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['name', 'value'],
        throttleMs: 10,
      });

      adapter.updateRow(3, { name: 'Updated', value: 999 });
      vi.advanceTimersByTime(10);

      const store = engine._cellStore;
      expect(store.setValue).toHaveBeenCalledWith(3, 0, 'Updated');
      expect(store.setValue).toHaveBeenCalledWith(3, 1, 999);
      // Row count should not change
      expect(engine.setRowCount).not.toHaveBeenCalled();
    });

    test('deletes cell when value is null', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['name', 'value'],
        throttleMs: 10,
      });

      adapter.updateRow(5, { name: null });
      vi.advanceTimersByTime(10);

      const store = engine._cellStore;
      expect(store.delete).toHaveBeenCalledWith(5, 0);
    });

    test('only updates fields present in data', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['a', 'b', 'c'],
        throttleMs: 10,
      });

      adapter.updateRow(0, { b: 'only-b' });
      vi.advanceTimersByTime(10);

      const store = engine._cellStore;
      // Only column 1 (b) should be updated
      expect(store.setValue).toHaveBeenCalledWith(0, 1, 'only-b');
      expect(store.setValue).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteRow', () => {
    test('removes row and shifts subsequent rows up', () => {
      const engine = createMockEngine(5);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['id'],
        throttleMs: 10,
      });

      adapter.deleteRow(2);
      vi.advanceTimersByTime(10);

      expect(engine.setRowCount).toHaveBeenCalledWith(4);
      // Row 2 cells cleared, then rows shifted up
      const store = engine._cellStore;
      expect(store.delete).toHaveBeenCalled();
    });

    test('decrements row count', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 10,
      });

      adapter.deleteRow(0);
      vi.advanceTimersByTime(10);

      expect(engine.setRowCount).toHaveBeenCalledWith(9);
    });
  });

  describe('batching', () => {
    test('coalesces push + update + delete in single flush', () => {
      const engine = createMockEngine(5);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['name'],
        throttleMs: 50,
      });

      adapter.pushRows([{ name: 'New' }]); // row 5
      adapter.updateRow(0, { name: 'Modified' });
      adapter.deleteRow(1); // one row removed

      vi.advanceTimersByTime(50);

      // push +1, delete -1 → net 5
      expect(engine.setRowCount).toHaveBeenCalledWith(5);
      // requestRender should be called once
      expect((engine as any).requestRender).toHaveBeenCalledTimes(1);
    });

    test('emits cellChange event after flush', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 10,
      });

      adapter.pushRows([{ x: 1 }]);
      vi.advanceTimersByTime(10);

      expect(engine._eventBus.emit).toHaveBeenCalledWith(
        'cellChange',
        expect.objectContaining({ source: 'streaming-adapter' }),
      );
    });

    test('does not emit if no updates pending', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 10,
      });

      vi.advanceTimersByTime(100);
      expect(engine._eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    test('immediately applies pending updates', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['val'],
        throttleMs: 5000,
      });

      adapter.pushRows([{ val: 42 }]);
      adapter.flush();

      expect(engine.setRowCount).toHaveBeenCalledWith(1);
    });

    test('cancels pending timer', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['val'],
        throttleMs: 100,
      });

      adapter.pushRows([{ val: 1 }]);
      adapter.flush();

      // Advancing timer should not cause double flush
      vi.advanceTimersByTime(100);
      expect(engine.setRowCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    test('flushes pending and prevents further updates', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 5000,
      });

      adapter.pushRows([{ x: 1 }]);
      adapter.dispose();

      expect(engine.setRowCount).toHaveBeenCalledWith(1);

      // Further calls should be ignored
      adapter.pushRows([{ x: 2 }]);
      adapter.flush();
      expect(engine.setRowCount).toHaveBeenCalledTimes(1);
    });

    test('marks adapter as disposed', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
        throttleMs: 10,
      });

      expect(adapter.disposed).toBe(false);
      adapter.dispose();
      expect(adapter.disposed).toBe(true);
    });
  });

  describe('high-frequency updates', () => {
    test('handles 100+ updates within single throttle window', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['id', 'value'],
        throttleMs: 100,
      });

      // Simulate 150 rapid pushes
      for (let i = 0; i < 150; i++) {
        adapter.pushRows([{ id: i, value: i * 10 }]);
      }

      vi.advanceTimersByTime(100);

      // All 150 rows should be added in single batch
      expect(engine.setRowCount).toHaveBeenCalledTimes(1);
      expect(engine.setRowCount).toHaveBeenCalledWith(150);
      expect((engine as any).requestRender).toHaveBeenCalledTimes(1);
    });

    test('interleaved push and update operations', () => {
      const engine = createMockEngine(10);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['name', 'score'],
        throttleMs: 50,
      });

      // Push new rows
      adapter.pushRows([{ name: 'X', score: 1 }]);
      // Update existing
      adapter.updateRow(0, { score: 999 });
      // Push more
      adapter.pushRows([{ name: 'Y', score: 2 }]);
      // Update another
      adapter.updateRow(5, { name: 'Modified' });

      vi.advanceTimersByTime(50);

      expect(engine.setRowCount).toHaveBeenCalledWith(12);
      expect((engine as any).requestRender).toHaveBeenCalledTimes(1);
    });
  });

  describe('default throttle', () => {
    test('uses 100ms default when not specified', () => {
      const engine = createMockEngine(0);
      const adapter = new StreamingAdapter(engine, {
        columnKeys: ['x'],
      });

      adapter.pushRows([{ x: 1 }]);

      vi.advanceTimersByTime(50);
      expect(engine.setRowCount).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(engine.setRowCount).toHaveBeenCalledWith(1);
    });
  });
});
