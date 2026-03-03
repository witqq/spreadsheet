import { describe, it, expect } from 'vitest';
import { MergeCellsCommand, UnmergeCellsCommand } from '../src/commands/merge-commands';
import { MergeManager } from '../src/merge/merge-manager';
import { CellStore } from '../src/model/cell-store';
import { CommandManager } from '../src/commands/command-manager';

describe('MergeCellsCommand', () => {
  it('executes merge and sets value on anchor', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region, 'Hello');

    cmd.execute();

    expect(mm.getAllRegions()).toHaveLength(1);
    expect(mm.getMergedRegion(0, 0)).toEqual(region);
    expect(cs.get(0, 0)?.value).toBe('Hello');
  });

  it('undo restores displaced cell values', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    cs.set(0, 1, { value: 'A' });
    cs.set(1, 0, { value: 'B' });
    cs.set(1, 1, { value: 'C' });

    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region, 'Merged');

    cmd.execute();
    expect(mm.getAllRegions()).toHaveLength(1);

    cmd.undo();
    expect(mm.getAllRegions()).toHaveLength(0);
    expect(cs.get(0, 1)?.value).toBe('A');
    expect(cs.get(1, 0)?.value).toBe('B');
    expect(cs.get(1, 1)?.value).toBe('C');
  });

  it('undo does not affect anchor cell value if no explicit value set', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    cs.set(0, 0, { value: 'Original' });
    cs.set(0, 1, { value: 'X' });

    const region = { startRow: 0, startCol: 0, endRow: 0, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region);

    cmd.execute();
    cmd.undo();

    // Anchor cell should retain its original value
    expect(cs.get(0, 0)?.value).toBe('Original');
    expect(cs.get(0, 1)?.value).toBe('X');
  });

  it('works with CommandManager redo', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    cs.set(1, 0, { value: 'Displaced' });

    const cmdMgr = new CommandManager();
    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region, 'Merged');

    cmdMgr.execute(cmd);
    expect(mm.getAllRegions()).toHaveLength(1);

    cmdMgr.undo();
    expect(mm.getAllRegions()).toHaveLength(0);
    expect(cs.get(1, 0)?.value).toBe('Displaced');

    cmdMgr.redo();
    expect(mm.getAllRegions()).toHaveLength(1);
    expect(cs.get(0, 0)?.value).toBe('Merged');
  });

  it('undo restores anchor cell original value when explicit value was set', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    cs.set(0, 0, { value: 'Original' });

    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region, 'Overwritten');

    cmd.execute();
    expect(cs.get(0, 0)?.value).toBe('Overwritten');

    cmd.undo();
    expect(cs.get(0, 0)?.value).toBe('Original');
  });

  it('undo clears anchor cell when it was empty before explicit value', () => {
    const mm = new MergeManager();
    const cs = new CellStore();

    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    const cmd = new MergeCellsCommand(mm, cs, region, 'New');

    cmd.execute();
    expect(cs.get(0, 0)?.value).toBe('New');

    cmd.undo();
    expect(cs.get(0, 0)).toBeUndefined();
  });

  it('has descriptive description', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const region = { startRow: 2, startCol: 3, endRow: 4, endCol: 5 };
    const cmd = new MergeCellsCommand(mm, cs, region);
    expect(cmd.description).toContain('Merge');
  });
});

describe('UnmergeCellsCommand', () => {
  it('executes unmerge', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    mm.merge(region);

    const cmd = new UnmergeCellsCommand(mm, cs, region);
    cmd.execute();

    expect(mm.getAllRegions()).toHaveLength(0);
    expect(mm.getMergedRegion(0, 0)).toBeNull();
  });

  it('undo re-merges the region', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    mm.merge(region);

    const cmd = new UnmergeCellsCommand(mm, cs, region);
    cmd.execute();
    expect(mm.getAllRegions()).toHaveLength(0);

    cmd.undo();
    expect(mm.getAllRegions()).toHaveLength(1);
    expect(mm.getMergedRegion(0, 0)).toEqual(region);
    expect(mm.getMergedRegion(1, 1)).toEqual(region);
  });

  it('works with CommandManager redo', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const cmdMgr = new CommandManager();
    const region = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
    mm.merge(region);

    const cmd = new UnmergeCellsCommand(mm, cs, region);
    cmdMgr.execute(cmd);
    expect(mm.getAllRegions()).toHaveLength(0);

    cmdMgr.undo();
    expect(mm.getAllRegions()).toHaveLength(1);

    cmdMgr.redo();
    expect(mm.getAllRegions()).toHaveLength(0);
  });

  it('has descriptive description', () => {
    const mm = new MergeManager();
    const cs = new CellStore();
    const region = { startRow: 2, startCol: 3, endRow: 4, endCol: 5 };
    const cmd = new UnmergeCellsCommand(mm, cs, region);
    expect(cmd.description).toContain('Unmerge');
  });
});
