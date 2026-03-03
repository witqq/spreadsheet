import { describe, it, expect } from 'vitest';
import { CommandManager } from '../src/commands/command-manager';
import { CellEditCommand } from '../src/commands/cell-edit-command';
import { BatchCellEditCommand } from '../src/commands/batch-cell-edit-command';
import { CellStore } from '../src/model/cell-store';
import type { Command } from '../src/commands/command';

// Simple test command that tracks execute/undo calls
class TestCommand implements Command {
  executeCalls = 0;
  undoCalls = 0;
  readonly description: string;

  constructor(desc = 'test') {
    this.description = desc;
  }

  execute(): void {
    this.executeCalls++;
  }

  undo(): void {
    this.undoCalls++;
  }
}

describe('CommandManager', () => {
  describe('execute', () => {
    it('calls execute on the command', () => {
      const mgr = new CommandManager();
      const cmd = new TestCommand();
      mgr.execute(cmd);
      expect(cmd.executeCalls).toBe(1);
    });

    it('pushes command to undo stack', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      expect(mgr.undoCount).toBe(1);
      expect(mgr.canUndo()).toBe(true);
    });

    it('clears redo stack on new execute', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      mgr.undo();
      expect(mgr.canRedo()).toBe(true);

      mgr.execute(new TestCommand());
      expect(mgr.canRedo()).toBe(false);
      expect(mgr.redoCount).toBe(0);
    });
  });

  describe('undo', () => {
    it('calls undo on the command and returns it', () => {
      const mgr = new CommandManager();
      const cmd = new TestCommand();
      mgr.execute(cmd);

      const result = mgr.undo();
      expect(result).toBe(cmd);
      expect(cmd.undoCalls).toBe(1);
    });

    it('moves command from undo to redo stack', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      expect(mgr.undoCount).toBe(1);
      expect(mgr.redoCount).toBe(0);

      mgr.undo();
      expect(mgr.undoCount).toBe(0);
      expect(mgr.redoCount).toBe(1);
    });

    it('returns undefined when undo stack is empty', () => {
      const mgr = new CommandManager();
      expect(mgr.undo()).toBeUndefined();
    });

    it('undoes commands in LIFO order', () => {
      const mgr = new CommandManager();
      const cmd1 = new TestCommand('first');
      const cmd2 = new TestCommand('second');
      mgr.execute(cmd1);
      mgr.execute(cmd2);

      expect(mgr.undo()).toBe(cmd2);
      expect(mgr.undo()).toBe(cmd1);
    });
  });

  describe('redo', () => {
    it('calls execute on the command again and returns it', () => {
      const mgr = new CommandManager();
      const cmd = new TestCommand();
      mgr.execute(cmd);
      mgr.undo();

      const result = mgr.redo();
      expect(result).toBe(cmd);
      expect(cmd.executeCalls).toBe(2); // initial + redo
    });

    it('moves command from redo back to undo stack', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      mgr.undo();
      expect(mgr.undoCount).toBe(0);
      expect(mgr.redoCount).toBe(1);

      mgr.redo();
      expect(mgr.undoCount).toBe(1);
      expect(mgr.redoCount).toBe(0);
    });

    it('returns undefined when redo stack is empty', () => {
      const mgr = new CommandManager();
      expect(mgr.redo()).toBeUndefined();
    });

    it('redoes commands in LIFO order', () => {
      const mgr = new CommandManager();
      const cmd1 = new TestCommand('first');
      const cmd2 = new TestCommand('second');
      mgr.execute(cmd1);
      mgr.execute(cmd2);
      mgr.undo();
      mgr.undo();

      expect(mgr.redo()).toBe(cmd1);
      expect(mgr.redo()).toBe(cmd2);
    });
  });

  describe('history limit', () => {
    it('defaults to 100', () => {
      const mgr = new CommandManager();
      for (let i = 0; i < 105; i++) {
        mgr.execute(new TestCommand());
      }
      expect(mgr.undoCount).toBe(100);
    });

    it('respects custom limit', () => {
      const mgr = new CommandManager({ historyLimit: 5 });
      for (let i = 0; i < 10; i++) {
        mgr.execute(new TestCommand());
      }
      expect(mgr.undoCount).toBe(5);
    });

    it('discards oldest command when limit exceeded', () => {
      const mgr = new CommandManager({ historyLimit: 3 });
      const cmd1 = new TestCommand('first');
      const cmd2 = new TestCommand('second');
      const cmd3 = new TestCommand('third');
      const cmd4 = new TestCommand('fourth');

      mgr.execute(cmd1);
      mgr.execute(cmd2);
      mgr.execute(cmd3);
      mgr.execute(cmd4);

      expect(mgr.undoCount).toBe(3);
      // Oldest (cmd1) should be gone
      expect(mgr.undo()).toBe(cmd4);
      expect(mgr.undo()).toBe(cmd3);
      expect(mgr.undo()).toBe(cmd2);
      expect(mgr.undo()).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('empties both stacks', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      mgr.execute(new TestCommand());
      mgr.undo();

      mgr.clear();
      expect(mgr.undoCount).toBe(0);
      expect(mgr.redoCount).toBe(0);
      expect(mgr.canUndo()).toBe(false);
      expect(mgr.canRedo()).toBe(false);
    });
  });

  describe('canUndo / canRedo', () => {
    it('starts with both false', () => {
      const mgr = new CommandManager();
      expect(mgr.canUndo()).toBe(false);
      expect(mgr.canRedo()).toBe(false);
    });

    it('canUndo is true after execute', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      expect(mgr.canUndo()).toBe(true);
    });

    it('canRedo is true after undo', () => {
      const mgr = new CommandManager();
      mgr.execute(new TestCommand());
      mgr.undo();
      expect(mgr.canRedo()).toBe(true);
    });
  });
});

describe('CellEditCommand', () => {
  it('sets cell value on execute', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'old');
    const cmd = new CellEditCommand(store, 0, 0, 'old', 'new');

    cmd.execute();
    expect(store.get(0, 0)?.value).toBe('new');
  });

  it('restores cell value on undo', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'old');
    const cmd = new CellEditCommand(store, 0, 0, 'old', 'new');

    cmd.execute();
    cmd.undo();
    expect(store.get(0, 0)?.value).toBe('old');
  });

  it('preserves existing cell metadata', () => {
    const store = new CellStore();
    store.set(0, 0, { value: 'old', type: 'string', metadata: { status: 'saved' } });
    const cmd = new CellEditCommand(store, 0, 0, 'old', 'new');

    cmd.execute();
    const cell = store.get(0, 0);
    expect(cell?.value).toBe('new');
    expect(cell?.type).toBe('string');
    expect(cell?.metadata?.status).toBe('saved');
  });

  it('works with numeric values', () => {
    const store = new CellStore();
    store.setValue(0, 0, 42);
    const cmd = new CellEditCommand(store, 0, 0, 42, 100);

    cmd.execute();
    expect(store.get(0, 0)?.value).toBe(100);
    cmd.undo();
    expect(store.get(0, 0)?.value).toBe(42);
  });

  it('works with null values (empty cells)', () => {
    const store = new CellStore();
    const cmd = new CellEditCommand(store, 0, 0, null, 'hello');

    cmd.execute();
    expect(store.get(0, 0)?.value).toBe('hello');
    cmd.undo();
    expect(store.get(0, 0)?.value).toBe(null);
  });

  it('has descriptive description', () => {
    const store = new CellStore();
    const cmd = new CellEditCommand(store, 3, 7, null, 'x');
    expect(cmd.description).toBe('Edit cell (3, 7)');
  });
});

describe('BatchCellEditCommand', () => {
  it('sets all cell values on execute', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'A');
    store.setValue(0, 1, 'B');
    store.setValue(1, 0, 'C');

    const cmd = new BatchCellEditCommand(store, [
      { row: 0, col: 0, oldValue: 'A', newValue: 'X' },
      { row: 0, col: 1, oldValue: 'B', newValue: 'Y' },
      { row: 1, col: 0, oldValue: 'C', newValue: 'Z' },
    ]);

    cmd.execute();
    expect(store.get(0, 0)?.value).toBe('X');
    expect(store.get(0, 1)?.value).toBe('Y');
    expect(store.get(1, 0)?.value).toBe('Z');
  });

  it('restores all cell values on undo', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'A');
    store.setValue(0, 1, 'B');

    const cmd = new BatchCellEditCommand(store, [
      { row: 0, col: 0, oldValue: 'A', newValue: 'X' },
      { row: 0, col: 1, oldValue: 'B', newValue: 'Y' },
    ]);

    cmd.execute();
    cmd.undo();
    expect(store.get(0, 0)?.value).toBe('A');
    expect(store.get(0, 1)?.value).toBe('B');
  });

  it('undoes in reverse order', () => {
    const store = new CellStore();
    const undoOrder: string[] = [];
    const origSetValue = store.setValue.bind(store);
    let recording = false;

    // Monkey-patch to track undo order
    store.setValue = (row: number, col: number, value: unknown) => {
      if (recording) undoOrder.push(`${row}:${col}=${String(value)}`);
      origSetValue(row, col, value as import('../src/types/interfaces').CellValue);
    };

    const cmd = new BatchCellEditCommand(store, [
      { row: 0, col: 0, oldValue: null, newValue: 'A' },
      { row: 0, col: 1, oldValue: null, newValue: 'B' },
      { row: 1, col: 0, oldValue: null, newValue: 'C' },
    ]);

    cmd.execute();
    recording = true;
    cmd.undo();

    // Should undo in reverse order: C, B, A
    expect(undoOrder).toEqual(['1:0=null', '0:1=null', '0:0=null']);
  });

  it('has descriptive description', () => {
    const store = new CellStore();
    const cmd = new BatchCellEditCommand(store, [
      { row: 0, col: 0, oldValue: null, newValue: 'A' },
      { row: 0, col: 1, oldValue: null, newValue: 'B' },
    ]);
    expect(cmd.description).toBe('Batch edit (2 cells)');
  });

  it('handles empty edits array', () => {
    const store = new CellStore();
    const cmd = new BatchCellEditCommand(store, []);
    cmd.execute();
    cmd.undo();
    expect(store.size).toBe(0);
  });
});

describe('CommandManager with CellEditCommand integration', () => {
  it('full cycle: execute → undo → redo', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'original');
    const mgr = new CommandManager();

    const cmd = new CellEditCommand(store, 0, 0, 'original', 'edited');
    mgr.execute(cmd);
    expect(store.get(0, 0)?.value).toBe('edited');

    mgr.undo();
    expect(store.get(0, 0)?.value).toBe('original');

    mgr.redo();
    expect(store.get(0, 0)?.value).toBe('edited');
  });

  it('multiple edits with undo chain', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'v1');
    const mgr = new CommandManager();

    mgr.execute(new CellEditCommand(store, 0, 0, 'v1', 'v2'));
    mgr.execute(new CellEditCommand(store, 0, 0, 'v2', 'v3'));
    mgr.execute(new CellEditCommand(store, 0, 0, 'v3', 'v4'));

    expect(store.get(0, 0)?.value).toBe('v4');

    mgr.undo();
    expect(store.get(0, 0)?.value).toBe('v3');

    mgr.undo();
    expect(store.get(0, 0)?.value).toBe('v2');

    mgr.undo();
    expect(store.get(0, 0)?.value).toBe('v1');

    // Redo all back
    mgr.redo();
    mgr.redo();
    mgr.redo();
    expect(store.get(0, 0)?.value).toBe('v4');
  });

  it('new command after undo clears redo and diverges', () => {
    const store = new CellStore();
    store.setValue(0, 0, 'v1');
    const mgr = new CommandManager();

    mgr.execute(new CellEditCommand(store, 0, 0, 'v1', 'v2'));
    mgr.execute(new CellEditCommand(store, 0, 0, 'v2', 'v3'));

    mgr.undo(); // back to v2
    expect(store.get(0, 0)?.value).toBe('v2');

    // New command diverges from v3
    mgr.execute(new CellEditCommand(store, 0, 0, 'v2', 'v4'));
    expect(store.get(0, 0)?.value).toBe('v4');
    expect(mgr.canRedo()).toBe(false);

    // Undo goes to v2, not v3
    mgr.undo();
    expect(store.get(0, 0)?.value).toBe('v2');
  });
});
