// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { CellStore } from '../src/model/cell-store';
import { InsertRowCommand, DeleteRowCommand } from '../src/commands/row-commands';
import type { RowCommandDeps } from '../src/commands/row-commands';
import { MergeManager } from '../src/merge/merge-manager';

function makeDeps(cellStore: CellStore, rowCount = 3): RowCommandDeps & { currentRowCount: number } {
  const deps = {
    cellStore,
    mergeManager: null,
    currentRowCount: rowCount,
    setRowCount(count: number) { deps.currentRowCount = count; },
    getRowCount() { return deps.currentRowCount; },
  };
  return deps;
}

describe('InsertRowCommand', () => {
  it('should shift cells at target row and below down by 1', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A0');
    cellStore.setValue(1, 0, 'B0');
    cellStore.setValue(2, 0, 'C0');
    cellStore.setValue(2, 1, 'C1');

    const deps = makeDeps(cellStore, 3);
    const cmd = new InsertRowCommand(deps, 1);
    cmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A0');
    expect(cellStore.get(1, 0)).toBeUndefined();
    expect(cellStore.get(2, 0)?.value).toBe('B0');
    expect(cellStore.get(3, 0)?.value).toBe('C0');
    expect(cellStore.get(3, 1)?.value).toBe('C1');
    expect(deps.currentRowCount).toBe(4);
  });

  it('should insert at row 0', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A');
    cellStore.setValue(1, 0, 'B');

    const deps = makeDeps(cellStore, 2);
    const cmd = new InsertRowCommand(deps, 0);
    cmd.execute();

    expect(cellStore.get(0, 0)).toBeUndefined();
    expect(cellStore.get(1, 0)?.value).toBe('A');
    expect(cellStore.get(2, 0)?.value).toBe('B');
    expect(deps.currentRowCount).toBe(3);
  });

  it('should undo by shifting cells back up', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A0');
    cellStore.setValue(1, 0, 'B0');
    cellStore.setValue(2, 0, 'C0');

    const deps = makeDeps(cellStore, 3);
    const cmd = new InsertRowCommand(deps, 1);
    cmd.execute();
    cmd.undo();

    expect(cellStore.get(0, 0)?.value).toBe('A0');
    expect(cellStore.get(1, 0)?.value).toBe('B0');
    expect(cellStore.get(2, 0)?.value).toBe('C0');
    expect(deps.currentRowCount).toBe(3);
  });

  it('should handle insert at end (no cells to shift)', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A');
    cellStore.setValue(1, 0, 'B');

    const deps = makeDeps(cellStore, 2);
    const cmd = new InsertRowCommand(deps, 5);
    cmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A');
    expect(cellStore.get(1, 0)?.value).toBe('B');
    expect(deps.currentRowCount).toBe(3);
  });
});

describe('DeleteRowCommand', () => {
  it('should remove target row and shift cells below up by 1', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A0');
    cellStore.setValue(1, 0, 'B0');
    cellStore.setValue(1, 1, 'B1');
    cellStore.setValue(2, 0, 'C0');

    const deps = makeDeps(cellStore, 3);
    const cmd = new DeleteRowCommand(deps, 1);
    cmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A0');
    expect(cellStore.get(1, 0)?.value).toBe('C0');
    expect(cellStore.get(1, 1)).toBeUndefined();
    expect(cellStore.get(2, 0)).toBeUndefined();
    expect(deps.currentRowCount).toBe(2);
  });

  it('should delete first row', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A');
    cellStore.setValue(1, 0, 'B');
    cellStore.setValue(2, 0, 'C');

    const deps = makeDeps(cellStore, 3);
    const cmd = new DeleteRowCommand(deps, 0);
    cmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('B');
    expect(cellStore.get(1, 0)?.value).toBe('C');
    expect(cellStore.get(2, 0)).toBeUndefined();
    expect(deps.currentRowCount).toBe(2);
  });

  it('should undo by restoring row and shifting cells back down', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A0');
    cellStore.setValue(1, 0, 'B0');
    cellStore.setValue(1, 1, 'B1');
    cellStore.setValue(2, 0, 'C0');

    const deps = makeDeps(cellStore, 3);
    const cmd = new DeleteRowCommand(deps, 1);
    cmd.execute();
    cmd.undo();

    expect(cellStore.get(0, 0)?.value).toBe('A0');
    expect(cellStore.get(1, 0)?.value).toBe('B0');
    expect(cellStore.get(1, 1)?.value).toBe('B1');
    expect(cellStore.get(2, 0)?.value).toBe('C0');
    expect(deps.currentRowCount).toBe(3);
  });

  it('should handle deleting last row (no cells below)', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A');
    cellStore.setValue(1, 0, 'B');

    const deps = makeDeps(cellStore, 2);
    const cmd = new DeleteRowCommand(deps, 1);
    cmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A');
    expect(cellStore.get(1, 0)).toBeUndefined();
    expect(deps.currentRowCount).toBe(1);
  });

  it('should handle insert then delete as round-trip', () => {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'A');
    cellStore.setValue(1, 0, 'B');
    cellStore.setValue(2, 0, 'C');

    const deps = makeDeps(cellStore, 3);
    const insertCmd = new InsertRowCommand(deps, 1);
    insertCmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A');
    expect(cellStore.get(1, 0)).toBeUndefined();
    expect(cellStore.get(2, 0)?.value).toBe('B');
    expect(cellStore.get(3, 0)?.value).toBe('C');
    expect(deps.currentRowCount).toBe(4);

    const deleteCmd = new DeleteRowCommand(deps, 1);
    deleteCmd.execute();

    expect(cellStore.get(0, 0)?.value).toBe('A');
    expect(cellStore.get(1, 0)?.value).toBe('B');
    expect(cellStore.get(2, 0)?.value).toBe('C');
    expect(deps.currentRowCount).toBe(3);
  });
});

describe('InsertRowCommand with merge regions', () => {
  function makeMergeDeps(cellStore: CellStore, mergeManager: MergeManager, rowCount: number): RowCommandDeps & { currentRowCount: number } {
    const deps = {
      cellStore,
      mergeManager,
      currentRowCount: rowCount,
      setRowCount(count: number) { deps.currentRowCount = count; },
      getRowCount() { return deps.currentRowCount; },
    };
    return deps;
  }

  it('should preserve both adjacent merge regions when inserting inside first merge', () => {
    const cellStore = new CellStore();
    const mgr = new MergeManager(cellStore);

    // Region A: rows 0-2, col 0 (3-row merge)
    mgr.merge({ startRow: 0, startCol: 0, endRow: 2, endCol: 0 });
    // Region B: rows 3-5, col 0 (adjacent 3-row merge)
    mgr.merge({ startRow: 3, startCol: 0, endRow: 5, endCol: 0 });

    const deps = makeMergeDeps(cellStore, mgr, 6);
    const cmd = new InsertRowCommand(deps, 2); // insert inside region A
    cmd.execute();

    const regions = [...mgr.getAllRegions()];
    expect(regions).toHaveLength(2);

    // Region A expanded: rows 0-3
    const regionA = regions.find(r => r.startRow === 0);
    expect(regionA).toBeDefined();
    expect(regionA!.endRow).toBe(3);

    // Region B shifted: rows 4-6
    const regionB = regions.find(r => r.startRow === 4);
    expect(regionB).toBeDefined();
    expect(regionB!.endRow).toBe(6);
  });

  it('should restore original merges on undo after adjacent merge insert', () => {
    const cellStore = new CellStore();
    const mgr = new MergeManager(cellStore);

    mgr.merge({ startRow: 0, startCol: 0, endRow: 2, endCol: 0 });
    mgr.merge({ startRow: 3, startCol: 0, endRow: 5, endCol: 0 });

    const deps = makeMergeDeps(cellStore, mgr, 6);
    const cmd = new InsertRowCommand(deps, 2);
    cmd.execute();
    cmd.undo();

    const regions = [...mgr.getAllRegions()];
    expect(regions).toHaveLength(2);

    const regionA = regions.find(r => r.startRow === 0);
    expect(regionA).toBeDefined();
    expect(regionA!.endRow).toBe(2);

    const regionB = regions.find(r => r.startRow === 3);
    expect(regionB).toBeDefined();
    expect(regionB!.endRow).toBe(5);
  });
});
