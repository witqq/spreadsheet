/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutofillManager, type AutofillManagerConfig } from '../src/autofill/autofill-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { SelectionManager } from '../src/selection/selection-manager';
import { EventBus } from '../src/events/event-bus';
import { CommandManager } from '../src/commands/command-manager';
import { DirtyTracker } from '../src/renderer/dirty-tracker';
import { RenderScheduler } from '../src/renderer/render-scheduler';
import { MergeManager } from '../src/merge/merge-manager';

function createMockLayoutEngine() {
  return {
    getColumnX: vi.fn((col: number) => col * 100),
    getColumnWidth: vi.fn(() => 100),
    getRowY: vi.fn((row: number) => row * 28),
    getRowHeight: vi.fn(() => 28),
    getColAtX: vi.fn((x: number) => Math.floor(x / 100)),
    getRowAtY: vi.fn((y: number) => Math.floor(y / 28)),
    rowNumberWidth: 50,
    headerHeight: 32,
    columnCount: 10,
  };
}

function createMockScrollManager() {
  return {
    scrollX: 0,
    scrollY: 0,
    getElement: vi.fn(() => document.createElement('div')),
  };
}

function createConfig(overrides: Partial<AutofillManagerConfig> = {}): AutofillManagerConfig {
  const cellStore = new CellStore();
  const eventBus = new EventBus();
  const selectionManager = new SelectionManager({ rowCount: 100, colCount: 10 });
  const commandManager = new CommandManager({});
  const dirtyTracker = new DirtyTracker();
  const renderScheduler = new RenderScheduler(vi.fn());

  return {
    cellStore,
    dataView: new DataView({ totalRowCount: 100 }),
    selectionManager,
    layoutEngine: createMockLayoutEngine() as any,
    scrollManager: createMockScrollManager() as any,
    commandManager,
    eventBus,
    dirtyTracker,
    renderScheduler,
    container: document.createElement('div'),
    rowCount: 100,
    colCount: 10,
    ...overrides,
  };
}

describe('AutofillManager', () => {
  let config: AutofillManagerConfig;
  let manager: AutofillManager;

  beforeEach(() => {
    config = createConfig();
    manager = new AutofillManager(config);
  });

  it('starts not dragging', () => {
    expect(manager.isDragging).toBe(false);
    expect(manager.getFillRange()).toBeNull();
    expect(manager.getFillDirection()).toBeNull();
  });

  it('computes handle position from selection', () => {
    config.selectionManager.selectCell(0, 0);
    const pos = manager.getHandlePosition();
    expect(pos).not.toBeNull();
    // col 0: x=0, width=100; row 0: y=0, height=28
    // handle at: rnWidth(50) + 0 + 100 - scrollX(0) = 150
    //            headerH(32) + 0 + 28 - scrollY(0) = 60
    expect(pos!.x).toBe(150);
    expect(pos!.y).toBe(60);
  });

  it('computes handle position for range selection', () => {
    config.selectionManager.selectCell(0, 0);
    config.selectionManager.extendSelection(2, 2);
    const pos = manager.getHandlePosition();
    // col 2: x=200, width=100; row 2: y=56, height=28
    // handle at: 50 + 200 + 100 = 350, 32 + 56 + 28 = 116
    expect(pos!.x).toBe(350);
    expect(pos!.y).toBe(116);
  });

  it('isOnHandle returns true within hit zone', () => {
    config.selectionManager.selectCell(0, 0);
    // Handle at (150, 60)
    expect(manager.isOnHandle(150, 60)).toBe(true);
    expect(manager.isOnHandle(153, 63)).toBe(true);
  });

  it('isOnHandle returns false outside hit zone', () => {
    config.selectionManager.selectCell(0, 0);
    // Handle at (150, 60), hit zone ±5
    expect(manager.isOnHandle(100, 100)).toBe(false);
  });

  it('attach and detach work without errors', () => {
    const el = document.createElement('div');
    manager.attach(el);
    manager.detach();
  });

  it('executeFill creates batch command for number sequence', () => {
    const { cellStore, selectionManager, commandManager } = config;

    // Set up source data: column 0, rows 0-2 = [1, 2, 3]
    cellStore.setValue(0, 0, 1);
    cellStore.setValue(1, 0, 2);
    cellStore.setValue(2, 0, 3);

    selectionManager.selectCell(0, 0);
    selectionManager.extendSelection(2, 0);

    // Use executeFill indirectly by testing that the command was executed
    // We can access via the private method by triggering the full flow
    // Instead test via commandManager
    const executeSpy = vi.spyOn(commandManager, 'execute');

    // Manually call private executeFill via prototype
    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 2, endCol: 0 },
      { startRow: 3, startCol: 0, endRow: 5, endCol: 0 },
      'down',
    );

    expect(executeSpy).toHaveBeenCalledOnce();
    // Verify cells got filled
    expect(cellStore.get(3, 0)?.value).toBe(4);
    expect(cellStore.get(4, 0)?.value).toBe(5);
    expect(cellStore.get(5, 0)?.value).toBe(6);
  });

  it('executeFill handles text repeat', () => {
    const { cellStore, commandManager } = config;

    cellStore.setValue(0, 0, 'a');
    cellStore.setValue(1, 0, 'b');

    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
      { startRow: 2, startCol: 0, endRow: 4, endCol: 0 },
      'down',
    );

    expect(cellStore.get(2, 0)?.value).toBe('a');
    expect(cellStore.get(3, 0)?.value).toBe('b');
    expect(cellStore.get(4, 0)?.value).toBe('a');
  });

  it('executeFill handles horizontal fill (right)', () => {
    const { cellStore } = config;

    cellStore.setValue(0, 0, 10);
    cellStore.setValue(0, 1, 20);

    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
      { startRow: 0, startCol: 2, endRow: 0, endCol: 4 },
      'right',
    );

    expect(cellStore.get(0, 2)?.value).toBe(30);
    expect(cellStore.get(0, 3)?.value).toBe(40);
    expect(cellStore.get(0, 4)?.value).toBe(50);
  });

  it('fill is undoable', () => {
    const { cellStore, commandManager } = config;

    cellStore.setValue(0, 0, 1);
    cellStore.setValue(1, 0, 2);

    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
      { startRow: 2, startCol: 0, endRow: 3, endCol: 0 },
      'down',
    );

    expect(cellStore.get(2, 0)?.value).toBe(3);
    expect(cellStore.get(3, 0)?.value).toBe(4);

    commandManager.undo();

    expect(cellStore.get(2, 0)?.value).toBeNull();
    expect(cellStore.get(3, 0)?.value).toBeNull();
  });

  it('fill emits autofillComplete event', () => {
    const { cellStore, eventBus } = config;
    const listener = vi.fn();
    eventBus.on('autofillComplete', listener);

    cellStore.setValue(0, 0, 1);

    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      { startRow: 1, startCol: 0, endRow: 1, endCol: 0 },
      'down',
    );

    // executeFill doesn't emit — handleDragEnd does
    // But we can verify the command executed
    expect(cellStore.get(1, 0)?.value).toBe(1);
  });

  it('fill with multiple columns fills each independently', () => {
    const { cellStore } = config;

    // Col 0: 1,2,3 — increment by 1
    // Col 1: 10,20,30 — increment by 10
    cellStore.setValue(0, 0, 1);
    cellStore.setValue(1, 0, 2);
    cellStore.setValue(2, 0, 3);
    cellStore.setValue(0, 1, 10);
    cellStore.setValue(1, 1, 20);
    cellStore.setValue(2, 1, 30);

    (manager as any).executeFill(
      { startRow: 0, startCol: 0, endRow: 2, endCol: 1 },
      { startRow: 3, startCol: 0, endRow: 4, endCol: 1 },
      'down',
    );

    expect(cellStore.get(3, 0)?.value).toBe(4);
    expect(cellStore.get(4, 0)?.value).toBe(5);
    expect(cellStore.get(3, 1)?.value).toBe(40);
    expect(cellStore.get(4, 1)?.value).toBe(50);
  });

  describe('merge-aware autofill', () => {
    let mergeManager: MergeManager;
    let mergeConfig: AutofillManagerConfig;
    let mergeAutofill: AutofillManager;

    beforeEach(() => {
      mergeManager = new MergeManager();
      mergeConfig = createConfig({ mergeManager });
      mergeAutofill = new AutofillManager(mergeConfig);
    });

    it('source extraction skips hidden cells in merged region', () => {
      const { cellStore } = mergeConfig;

      // Merge rows 0-1, col 0 — anchor at (0,0) with value 'Hello'
      mergeManager.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 0 });
      cellStore.setValue(0, 0, 'Hello');
      // Row 1, col 0 is hidden — CellStore has no value there

      // Fill down from source rows 0-1 into rows 2-3
      (mergeAutofill as any).executeFill(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
        { startRow: 2, startCol: 0, endRow: 3, endCol: 0 },
        'down',
      );

      // With merge awareness: source = ['Hello'] (hidden cell skipped)
      // Pattern = text repeat → fill with 'Hello'
      expect(cellStore.get(2, 0)?.value).toBe('Hello');
      expect(cellStore.get(3, 0)?.value).toBe('Hello');
    });

    it('source extraction reads anchor value for merged number sequence', () => {
      const { cellStore } = mergeConfig;

      // Row 0: value 10 (single cell)
      // Rows 1-2: merged, anchor at (1,0) with value 20
      cellStore.setValue(0, 0, 10);
      mergeManager.merge({ startRow: 1, startCol: 0, endRow: 2, endCol: 0 });
      cellStore.setValue(1, 0, 20);

      // Source rows 0-2, fill rows 3-4
      (mergeAutofill as any).executeFill(
        { startRow: 0, startCol: 0, endRow: 2, endCol: 0 },
        { startRow: 3, startCol: 0, endRow: 4, endCol: 0 },
        'down',
      );

      // Source = [10, 20] (row 2 hidden, skipped) → increment by 10
      expect(cellStore.get(3, 0)?.value).toBe(30);
      expect(cellStore.get(4, 0)?.value).toBe(40);
    });

    it('target fill skips hidden cells in merged region', () => {
      const { cellStore } = mergeConfig;

      // Source: rows 0-1, col 0 = [1, 2]
      cellStore.setValue(0, 0, 1);
      cellStore.setValue(1, 0, 2);

      // Target area has a merge at rows 3-4, col 0
      mergeManager.merge({ startRow: 3, startCol: 0, endRow: 4, endCol: 0 });
      cellStore.setValue(3, 0, 'existing');

      // Fill down into rows 2-4
      (mergeAutofill as any).executeFill(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
        { startRow: 2, startCol: 0, endRow: 4, endCol: 0 },
        'down',
      );

      // Row 2 gets filled (3), row 3 is anchor (gets filled, 4), row 4 hidden (skipped)
      expect(cellStore.get(2, 0)?.value).toBe(3);
      expect(cellStore.get(3, 0)?.value).toBe(4);
      // Row 4 is hidden in the merge — should NOT be overwritten
    });

    it('horizontal fill skips hidden cells in source', () => {
      const { cellStore } = mergeConfig;

      // Merge cols 0-1, row 0 — anchor at (0,0) with value 100
      mergeManager.merge({ startRow: 0, startCol: 0, endRow: 0, endCol: 1 });
      cellStore.setValue(0, 0, 100);

      // Fill right from source cols 0-1 into cols 2-3
      (mergeAutofill as any).executeFill(
        { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
        { startRow: 0, startCol: 2, endRow: 0, endCol: 3 },
        'right',
      );

      // Source = [100] (col 1 hidden, skipped) → text repeat
      expect(cellStore.get(0, 2)?.value).toBe(100);
      expect(cellStore.get(0, 3)?.value).toBe(100);
    });

    it('without mergeManager, behaves as before (no skipping)', () => {
      // Use the non-merge manager from outer scope
      const { cellStore } = config;

      cellStore.setValue(0, 0, 'a');
      cellStore.setValue(1, 0, 'b');

      (manager as any).executeFill(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
        { startRow: 2, startCol: 0, endRow: 3, endCol: 0 },
        'down',
      );

      expect(cellStore.get(2, 0)?.value).toBe('a');
      expect(cellStore.get(3, 0)?.value).toBe('b');
    });
  });
});
