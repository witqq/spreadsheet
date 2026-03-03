import { describe, it, expect, vi } from 'vitest';
import { ChangeTracker } from '../src/tracking/change-tracker';
import { CellStore } from '../src/model/cell-store';
import { EventBus } from '../src/events/event-bus';
import { CellEditCommand } from '../src/commands/cell-edit-command';
import { BatchCellEditCommand } from '../src/commands/batch-cell-edit-command';
import { CommandManager } from '../src/commands/command-manager';

function createTracker() {
  const cellStore = new CellStore();
  const eventBus = new EventBus();
  const tracker = new ChangeTracker({ cellStore, eventBus });
  return { cellStore, eventBus, tracker };
}

describe('ChangeTracker', () => {
  describe('command execute tracking', () => {
    it('marks cell as changed after CellEditCommand execute', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);

      expect(tracker.getCellStatus(0, 0)).toBe('changed');
      expect(tracker.getChangedCells()).toEqual([{ row: 0, col: 0 }]);
    });

    it('marks multiple cells as changed after BatchCellEditCommand', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'a');
      cellStore.setValue(1, 0, 'b');
      tracker.captureBaseline();

      const cmd = new BatchCellEditCommand(cellStore, [
        { row: 0, col: 0, oldValue: 'a', newValue: 'x' },
        { row: 1, col: 0, oldValue: 'b', newValue: 'y' },
      ]);
      cmd.execute();
      tracker.handleCommandExecute(cmd);

      expect(tracker.getCellStatus(0, 0)).toBe('changed');
      expect(tracker.getCellStatus(1, 0)).toBe('changed');
      expect(tracker.getChangedCells()).toHaveLength(2);
    });

    it('ignores non-cell-affecting commands', () => {
      const { tracker } = createTracker();
      tracker.captureBaseline();

      const cmd = { execute: vi.fn(), undo: vi.fn(), description: 'resize' };
      tracker.handleCommandExecute(cmd);

      expect(tracker.getChangedCells()).toHaveLength(0);
    });
  });

  describe('undo tracking', () => {
    it('clears changed status when value reverts to baseline', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);
      expect(tracker.getCellStatus(0, 0)).toBe('changed');

      cmd.undo();
      tracker.handleCommandUndo(cmd);
      expect(tracker.getCellStatus(0, 0)).toBeUndefined();
      expect(tracker.getChangedCells()).toHaveLength(0);
    });

    it('keeps changed status when undo reverts to non-baseline value', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      // First edit
      const cmd1 = new CellEditCommand(cellStore, 0, 0, 'original', 'first');
      cmd1.execute();
      tracker.handleCommandExecute(cmd1);

      // Second edit
      const cmd2 = new CellEditCommand(cellStore, 0, 0, 'first', 'second');
      cmd2.execute();
      tracker.handleCommandExecute(cmd2);

      // Undo second edit → value is 'first' (not baseline 'original')
      cmd2.undo();
      tracker.handleCommandUndo(cmd2);
      expect(tracker.getCellStatus(0, 0)).toBe('changed');
    });
  });

  describe('redo tracking', () => {
    it('re-marks cell as changed after redo', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);

      cmd.undo();
      tracker.handleCommandUndo(cmd);
      expect(tracker.getCellStatus(0, 0)).toBeUndefined();

      cmd.execute();
      tracker.handleCommandRedo(cmd);
      expect(tracker.getCellStatus(0, 0)).toBe('changed');
    });
  });

  describe('setCellStatus', () => {
    it('sets saving status on a cell', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'value');
      tracker.captureBaseline();

      tracker.setCellStatus(0, 0, 'saving');
      expect(tracker.getCellStatus(0, 0)).toBe('saving');
    });

    it('sets saved status and updates baseline', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      // Edit cell
      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);
      expect(tracker.getCellStatus(0, 0)).toBe('changed');

      // Mark as saved
      tracker.setCellStatus(0, 0, 'saved');
      expect(tracker.getCellStatus(0, 0)).toBe('saved');
      expect(tracker.getChangedCells()).toHaveLength(0);
    });

    it('sets error status with message', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'value');
      tracker.setCellStatus(0, 0, 'error', 'Something went wrong');

      const cell = cellStore.get(0, 0);
      expect(cell?.metadata?.status).toBe('error');
      expect(cell?.metadata?.errorMessage).toBe('Something went wrong');
    });

    it('does not emit event when status unchanged', () => {
      const { cellStore, eventBus, tracker } = createTracker();
      cellStore.setValue(0, 0, 'value');

      tracker.setCellStatus(0, 0, 'changed');
      const handler = vi.fn();
      eventBus.on('cellStatusChange', handler);

      tracker.setCellStatus(0, 0, 'changed'); // same status
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('emits cellStatusChange when cell becomes changed', () => {
      const { cellStore, eventBus, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      const handler = vi.fn();
      eventBus.on('cellStatusChange', handler);

      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);

      expect(handler).toHaveBeenCalledWith({
        row: 0,
        col: 0,
        oldStatus: undefined,
        newStatus: 'changed',
      });
    });

    it('emits cellStatusChange when cell reverts to baseline', () => {
      const { cellStore, eventBus, tracker } = createTracker();
      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      cmd.execute();
      tracker.handleCommandExecute(cmd);

      const handler = vi.fn();
      eventBus.on('cellStatusChange', handler);

      cmd.undo();
      tracker.handleCommandUndo(cmd);

      expect(handler).toHaveBeenCalledWith({
        row: 0,
        col: 0,
        oldStatus: 'changed',
        newStatus: undefined,
      });
    });

    it('emits cellStatusChange on setCellStatus', () => {
      const { cellStore, eventBus, tracker } = createTracker();
      cellStore.setValue(0, 0, 'value');

      const handler = vi.fn();
      eventBus.on('cellStatusChange', handler);

      tracker.setCellStatus(0, 0, 'saving');
      expect(handler).toHaveBeenCalledWith({
        row: 0,
        col: 0,
        oldStatus: undefined,
        newStatus: 'saving',
        errorMessage: undefined,
      });
    });
  });

  describe('clearChanges', () => {
    it('clears all changed cells and metadata', () => {
      const { cellStore, tracker } = createTracker();
      cellStore.setValue(0, 0, 'a');
      cellStore.setValue(1, 0, 'b');
      tracker.captureBaseline();

      const cmd = new BatchCellEditCommand(cellStore, [
        { row: 0, col: 0, oldValue: 'a', newValue: 'x' },
        { row: 1, col: 0, oldValue: 'b', newValue: 'y' },
      ]);
      cmd.execute();
      tracker.handleCommandExecute(cmd);
      expect(tracker.getChangedCells()).toHaveLength(2);

      tracker.clearChanges();
      expect(tracker.getChangedCells()).toHaveLength(0);
      expect(tracker.getCellStatus(0, 0)).toBeUndefined();
      expect(tracker.getCellStatus(1, 0)).toBeUndefined();
    });
  });

  describe('integration with CommandManager', () => {
    it('tracks changes through CommandManager callbacks', () => {
      const cellStore = new CellStore();
      const eventBus = new EventBus();
      const tracker = new ChangeTracker({ cellStore, eventBus });

      const commandManager = new CommandManager({
        historyLimit: 100,
        onAfterExecute: tracker.handleCommandExecute,
        onAfterUndo: tracker.handleCommandUndo,
        onAfterRedo: tracker.handleCommandRedo,
      });

      cellStore.setValue(0, 0, 'original');
      tracker.captureBaseline();

      // Execute
      const cmd = new CellEditCommand(cellStore, 0, 0, 'original', 'modified');
      commandManager.execute(cmd);
      expect(tracker.getCellStatus(0, 0)).toBe('changed');

      // Undo
      commandManager.undo();
      expect(tracker.getCellStatus(0, 0)).toBeUndefined();

      // Redo
      commandManager.redo();
      expect(tracker.getCellStatus(0, 0)).toBe('changed');
    });
  });

  describe('baseline tracking', () => {
    it('captures baseline on first modification for new cells', () => {
      const { cellStore, tracker } = createTracker();
      tracker.captureBaseline();

      // Edit a cell that didn't exist before
      const cmd = new CellEditCommand(cellStore, 5, 5, null, 'new value');
      cmd.execute();
      tracker.handleCommandExecute(cmd);
      expect(tracker.getCellStatus(5, 5)).toBe('changed');

      // Undo should revert to baseline (null)
      cmd.undo();
      tracker.handleCommandUndo(cmd);
      expect(tracker.getCellStatus(5, 5)).toBeUndefined();
    });
  });
});
