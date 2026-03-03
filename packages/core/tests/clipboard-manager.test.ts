// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardManager } from '../src/clipboard/clipboard-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { SelectionManager } from '../src/selection/selection-manager';
import { CommandManager } from '../src/commands/command-manager';
import { EventBus } from '../src/events/event-bus';

function createTestSetup() {
  const cellStore = new CellStore();
  cellStore.setValue(0, 0, 'Alice');
  cellStore.setValue(0, 1, 30);
  cellStore.setValue(1, 0, 'Bob');
  cellStore.setValue(1, 1, 25);
  cellStore.setValue(2, 0, 'Charlie');
  cellStore.setValue(2, 1, 35);

  const selectionManager = new SelectionManager({
    rowCount: 10,
    colCount: 5,
  });

  const commandManager = new CommandManager({ historyLimit: 100 });
  const eventBus = new EventBus();
  const onDataChange = vi.fn();
  const isEditing = vi.fn(() => false);

  const container = document.createElement('div');
  document.body.appendChild(container);

  const clipboardManager = new ClipboardManager({
    cellStore,
    dataView: new DataView({ totalRowCount: 10 }),
    selectionManager,
    commandManager,
    eventBus,
    isEditing,
    onDataChange,
  });
  clipboardManager.attach(container);

  return {
    cellStore,
    selectionManager,
    commandManager,
    eventBus,
    onDataChange,
    isEditing,
    container,
    clipboardManager,
    cleanup() {
      clipboardManager.detach();
      document.body.removeChild(container);
    },
  };
}

function createClipboardEvent(
  type: 'copy' | 'cut' | 'paste',
  data?: Record<string, string>,
): ClipboardEvent {
  const clipboardData: DataTransfer = {
    data: {} as Record<string, string>,
    setData(format: string, value: string) {
      this.data[format] = value;
    },
    getData(format: string) {
      return this.data[format] ?? '';
    },
  } as unknown as DataTransfer;

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      clipboardData.setData(key, value);
    }
  }

  const event = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return event;
}

describe('ClipboardManager', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  afterEach(() => {
    setup.cleanup();
  });

  describe('copy', () => {
    it('copies single cell as TSV and HTML', () => {
      setup.selectionManager.selectCell(0, 0);
      const event = createClipboardEvent('copy');
      setup.container.dispatchEvent(event);

      const cd = (event as ClipboardEvent).clipboardData!;
      expect(cd.getData('text/plain')).toBe('Alice');
      expect(cd.getData('text/html')).toBe('<table><tr><td>Alice</td></tr></table>');
      expect(event.defaultPrevented).toBe(true);
    });

    it('copies multi-cell range', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.selectionManager.extendSelection(1, 1);
      const event = createClipboardEvent('copy');
      setup.container.dispatchEvent(event);

      const cd = (event as ClipboardEvent).clipboardData!;
      expect(cd.getData('text/plain')).toBe('Alice\t30\nBob\t25');
    });

    it('does not modify cell store', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(createClipboardEvent('copy'));

      expect(setup.cellStore.get(0, 0)?.value).toBe('Alice');
      expect(setup.commandManager.canUndo()).toBe(false);
    });

    it('does not intercept when editing', () => {
      setup.isEditing.mockReturnValue(true);
      setup.selectionManager.selectCell(0, 0);
      const event = createClipboardEvent('copy');
      setup.container.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it('emits clipboardCopy event', () => {
      const handler = vi.fn();
      setup.eventBus.on('clipboardCopy', handler);
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(createClipboardEvent('copy'));

      expect(handler).toHaveBeenCalledWith({ rowCount: 1, colCount: 1 });
    });

    it('copies empty cells as empty strings in TSV', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.selectionManager.extendSelection(0, 2); // col 2 has no data
      const event = createClipboardEvent('copy');
      setup.container.dispatchEvent(event);

      expect((event as ClipboardEvent).clipboardData!.getData('text/plain')).toBe('Alice\t30\t');
    });
  });

  describe('cut', () => {
    it('copies data and clears source cells', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.selectionManager.extendSelection(0, 1);
      const event = createClipboardEvent('cut');
      setup.container.dispatchEvent(event);

      const cd = (event as ClipboardEvent).clipboardData!;
      expect(cd.getData('text/plain')).toBe('Alice\t30');
      expect(setup.cellStore.get(0, 0)?.value).toBeNull();
      expect(setup.cellStore.get(0, 1)?.value).toBeNull();
    });

    it('creates undoable command', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(createClipboardEvent('cut'));

      expect(setup.commandManager.canUndo()).toBe(true);
      setup.commandManager.undo();
      expect(setup.cellStore.get(0, 0)?.value).toBe('Alice');
    });

    it('calls onDataChange after cut', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(createClipboardEvent('cut'));

      expect(setup.onDataChange).toHaveBeenCalled();
    });

    it('emits clipboardCut event', () => {
      const handler = vi.fn();
      setup.eventBus.on('clipboardCut', handler);
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(createClipboardEvent('cut'));

      expect(handler).toHaveBeenCalledWith({ rowCount: 1, colCount: 1 });
    });

    it('does not create command when all cells are already null', () => {
      setup.selectionManager.selectCell(5, 3); // empty cell
      setup.container.dispatchEvent(createClipboardEvent('cut'));

      expect(setup.commandManager.canUndo()).toBe(false);
    });
  });

  describe('paste', () => {
    it('pastes TSV data at active cell', () => {
      setup.selectionManager.selectCell(3, 0);
      const event = createClipboardEvent('paste', {
        'text/plain': 'X\tY\nZ\tW',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(3, 0)?.value).toBe('X');
      expect(setup.cellStore.get(3, 1)?.value).toBe('Y');
      expect(setup.cellStore.get(4, 0)?.value).toBe('Z');
      expect(setup.cellStore.get(4, 1)?.value).toBe('W');
    });

    it('pastes HTML table data (Excel format)', () => {
      setup.selectionManager.selectCell(3, 0);
      const event = createClipboardEvent('paste', {
        'text/html': '<table><tr><td>Revenue</td><td>1000</td></tr></table>',
        'text/plain': 'Revenue\t1000',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(3, 0)?.value).toBe('Revenue');
      expect(setup.cellStore.get(3, 1)?.value).toBe(1000);
    });

    it('prefers HTML over TSV when both present', () => {
      setup.selectionManager.selectCell(3, 0);
      const event = createClipboardEvent('paste', {
        'text/html': '<table><tr><td>fromHTML</td></tr></table>',
        'text/plain': 'fromTSV',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(3, 0)?.value).toBe('fromHTML');
    });

    it('falls back to TSV when HTML has no table', () => {
      setup.selectionManager.selectCell(3, 0);
      const event = createClipboardEvent('paste', {
        'text/html': '<div>no table here</div>',
        'text/plain': 'fallback',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(3, 0)?.value).toBe('fallback');
    });

    it('creates undoable command that restores original values', () => {
      // Original: (0,0)='Alice', (0,1)=30
      setup.selectionManager.selectCell(0, 0);
      const event = createClipboardEvent('paste', {
        'text/plain': 'New\t99',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(0, 0)?.value).toBe('New');
      expect(setup.cellStore.get(0, 1)?.value).toBe(99);

      // Undo restores originals
      setup.commandManager.undo();
      expect(setup.cellStore.get(0, 0)?.value).toBe('Alice');
      expect(setup.cellStore.get(0, 1)?.value).toBe(30);
    });

    it('clips paste at grid boundaries (row)', () => {
      // Grid has 10 rows (0-9), paste 3 rows starting at row 8
      setup.selectionManager.selectCell(8, 0);
      const event = createClipboardEvent('paste', {
        'text/plain': 'A\nB\nC',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(8, 0)?.value).toBe('A');
      expect(setup.cellStore.get(9, 0)?.value).toBe('B');
      // Row 10 doesn't exist — 'C' is clipped
    });

    it('clips paste at grid boundaries (col)', () => {
      // Grid has 5 cols (0-4), paste 3 cols starting at col 3
      setup.selectionManager.selectCell(0, 3);
      const event = createClipboardEvent('paste', {
        'text/plain': 'A\tB\tC',
      });
      setup.container.dispatchEvent(event);

      expect(setup.cellStore.get(0, 3)?.value).toBe('A');
      expect(setup.cellStore.get(0, 4)?.value).toBe('B');
      // Col 5 doesn't exist — 'C' is clipped
    });

    it('calls onDataChange after paste', () => {
      setup.selectionManager.selectCell(3, 0);
      setup.container.dispatchEvent(
        createClipboardEvent('paste', { 'text/plain': 'x' }),
      );
      expect(setup.onDataChange).toHaveBeenCalled();
    });

    it('emits clipboardPaste event', () => {
      const handler = vi.fn();
      setup.eventBus.on('clipboardPaste', handler);
      setup.selectionManager.selectCell(3, 0);
      setup.container.dispatchEvent(
        createClipboardEvent('paste', { 'text/plain': 'A\tB\nC\tD' }),
      );
      expect(handler).toHaveBeenCalledWith({ rowCount: 2, colCount: 2 });
    });

    it('does not intercept when editing', () => {
      setup.isEditing.mockReturnValue(true);
      setup.selectionManager.selectCell(3, 0);
      const event = createClipboardEvent('paste', { 'text/plain': 'x' });
      setup.container.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(setup.cellStore.get(3, 0)).toBeUndefined();
    });

    it('ignores paste with no data', () => {
      setup.selectionManager.selectCell(3, 0);
      setup.container.dispatchEvent(createClipboardEvent('paste'));

      expect(setup.commandManager.canUndo()).toBe(false);
      expect(setup.onDataChange).not.toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('cut then undo restores cells and redo clears again', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.selectionManager.extendSelection(0, 1);
      setup.container.dispatchEvent(createClipboardEvent('cut'));

      expect(setup.cellStore.get(0, 0)?.value).toBeNull();
      expect(setup.cellStore.get(0, 1)?.value).toBeNull();

      setup.commandManager.undo();
      expect(setup.cellStore.get(0, 0)?.value).toBe('Alice');
      expect(setup.cellStore.get(0, 1)?.value).toBe(30);

      setup.commandManager.redo();
      expect(setup.cellStore.get(0, 0)?.value).toBeNull();
      expect(setup.cellStore.get(0, 1)?.value).toBeNull();
    });

    it('paste then undo restores overwritten cells', () => {
      setup.selectionManager.selectCell(0, 0);
      setup.container.dispatchEvent(
        createClipboardEvent('paste', { 'text/plain': 'X\t99' }),
      );

      expect(setup.cellStore.get(0, 0)?.value).toBe('X');
      expect(setup.cellStore.get(0, 1)?.value).toBe(99);

      setup.commandManager.undo();
      expect(setup.cellStore.get(0, 0)?.value).toBe('Alice');
      expect(setup.cellStore.get(0, 1)?.value).toBe(30);
    });

    it('detach removes listeners', () => {
      setup.clipboardManager.detach();
      setup.selectionManager.selectCell(0, 0);
      const event = createClipboardEvent('copy');
      setup.container.dispatchEvent(event);

      // Should not be intercepted (not prevented)
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
