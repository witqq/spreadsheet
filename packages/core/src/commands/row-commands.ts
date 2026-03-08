// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Row manipulation commands for the undo/redo system.
 *
 * InsertRowCommand: inserts a new empty row, shifting subsequent rows down.
 * DeleteRowCommand: removes a row and its data, shifting subsequent rows up.
 *
 * Both operate on physical row indices in the CellStore and update
 * row count and merge regions via RowCommandDeps.
 */

import type { CellStore } from '../model/cell-store';
import type { CellData, MergedRegion } from '../types/interfaces';
import type { Command } from './command';
import type { MergeManager } from '../merge/merge-manager';

export interface RowCommandDeps {
  cellStore: CellStore;
  mergeManager: MergeManager | null;
  setRowCount: (count: number) => void;
  getRowCount: () => number;
}

function collectCellsFromRow(
  cellStore: CellStore,
  startRow: number,
): Array<{ row: number; col: number; data: CellData }> {
  const result: Array<{ row: number; col: number; data: CellData }> = [];
  for (const entry of cellStore.entries()) {
    if (entry.row >= startRow) {
      result.push({ row: entry.row, col: entry.col, data: { ...entry.data } });
    }
  }
  result.sort((a, b) => a.row - b.row || a.col - b.col);
  return result;
}

function collectRowCells(
  cellStore: CellStore,
  row: number,
): Array<{ col: number; data: CellData }> {
  const result: Array<{ col: number; data: CellData }> = [];
  for (const entry of cellStore.entries()) {
    if (entry.row === row) {
      result.push({ col: entry.col, data: { ...entry.data } });
    }
  }
  return result;
}

function shiftMergesForInsert(mgr: MergeManager, targetRow: number): MergedRegion[] {
  const saved: MergedRegion[] = [];
  const regions = [...mgr.getAllRegions()];
  const newRegions: MergedRegion[] = [];

  // Phase 1: Save originals and compute new positions
  for (const r of regions) {
    saved.push({ ...r });
    if (r.startRow >= targetRow) {
      newRegions.push({
        startRow: r.startRow + 1,
        startCol: r.startCol,
        endRow: r.endRow + 1,
        endCol: r.endCol,
      });
    } else if (r.endRow >= targetRow) {
      newRegions.push({
        startRow: r.startRow,
        startCol: r.startCol,
        endRow: r.endRow + 1,
        endCol: r.endCol,
      });
    } else {
      newRegions.push({ ...r });
    }
  }

  // Phase 2: Remove all existing
  for (const r of regions) {
    mgr.unmerge(r.startRow, r.startCol);
  }

  // Phase 3: Add all new
  for (const r of newRegions) {
    mgr.merge(r);
  }

  return saved;
}

function shiftMergesForDelete(mgr: MergeManager, targetRow: number): MergedRegion[] {
  const saved: MergedRegion[] = [];
  const regions = [...mgr.getAllRegions()];
  const newRegions: MergedRegion[] = [];

  // Phase 1: Save originals and compute new positions
  for (const r of regions) {
    saved.push({ ...r });
    if (r.startRow > targetRow) {
      newRegions.push({
        startRow: r.startRow - 1,
        startCol: r.startCol,
        endRow: r.endRow - 1,
        endCol: r.endCol,
      });
    } else if (r.startRow === targetRow && r.endRow === targetRow) {
      // Single-row merge at target — removed entirely
    } else if (r.endRow >= targetRow && r.startRow < targetRow) {
      if (r.endRow - 1 > r.startRow || r.endCol > r.startCol) {
        newRegions.push({
          startRow: r.startRow,
          startCol: r.startCol,
          endRow: r.endRow - 1,
          endCol: r.endCol,
        });
      }
    } else if (r.startRow === targetRow && r.endRow > targetRow) {
      if (r.endRow - 1 >= r.startRow) {
        newRegions.push({
          startRow: r.startRow,
          startCol: r.startCol,
          endRow: r.endRow - 1,
          endCol: r.endCol,
        });
      }
    } else {
      newRegions.push({ ...r });
    }
  }

  // Phase 2: Remove all existing
  for (const r of regions) {
    mgr.unmerge(r.startRow, r.startCol);
  }

  // Phase 3: Add all new
  for (const r of newRegions) {
    mgr.merge(r);
  }

  return saved;
}

function restoreMerges(mgr: MergeManager, saved: MergedRegion[]): void {
  const current = [...mgr.getAllRegions()];
  for (const r of current) {
    mgr.unmerge(r.startRow, r.startCol);
  }
  for (const r of saved) {
    mgr.merge(r);
  }
}

export class InsertRowCommand implements Command {
  readonly description: string;
  private savedMerges: MergedRegion[] = [];
  private originalRowCount = 0;

  constructor(
    private readonly deps: RowCommandDeps,
    private readonly targetRow: number,
  ) {
    this.description = `Insert row at ${targetRow}`;
  }

  get affectedCells(): ReadonlyArray<{ row: number; col: number }> {
    return [];
  }

  execute(): void {
    this.originalRowCount = this.deps.getRowCount();

    const cells = collectCellsFromRow(this.deps.cellStore, this.targetRow);
    for (let i = cells.length - 1; i >= 0; i--) {
      this.deps.cellStore.delete(cells[i].row, cells[i].col);
    }
    for (const { row, col, data } of cells) {
      this.deps.cellStore.set(row + 1, col, data);
    }

    if (this.deps.mergeManager) {
      this.savedMerges = shiftMergesForInsert(this.deps.mergeManager, this.targetRow);
    }

    this.deps.setRowCount(this.originalRowCount + 1);
  }

  undo(): void {
    const cells = collectCellsFromRow(this.deps.cellStore, this.targetRow + 1);
    for (const { row, col } of cells) {
      this.deps.cellStore.delete(row, col);
    }
    for (const { row, col, data } of cells) {
      this.deps.cellStore.set(row - 1, col, data);
    }

    if (this.deps.mergeManager && this.savedMerges.length > 0) {
      restoreMerges(this.deps.mergeManager, this.savedMerges);
    }

    this.deps.setRowCount(this.originalRowCount);
  }
}

export class DeleteRowCommand implements Command {
  readonly description: string;
  private savedRowData: Array<{ col: number; data: CellData }> = [];
  private savedMerges: MergedRegion[] = [];
  private originalRowCount = 0;

  constructor(
    private readonly deps: RowCommandDeps,
    private readonly targetRow: number,
  ) {
    this.description = `Delete row ${targetRow}`;
  }

  get affectedCells(): ReadonlyArray<{ row: number; col: number }> {
    return [];
  }

  execute(): void {
    this.originalRowCount = this.deps.getRowCount();
    this.savedRowData = collectRowCells(this.deps.cellStore, this.targetRow);

    for (const { col } of this.savedRowData) {
      this.deps.cellStore.delete(this.targetRow, col);
    }

    const cellsBelow = collectCellsFromRow(this.deps.cellStore, this.targetRow + 1);
    for (const { row, col } of cellsBelow) {
      this.deps.cellStore.delete(row, col);
    }
    for (const { row, col, data } of cellsBelow) {
      this.deps.cellStore.set(row - 1, col, data);
    }

    if (this.deps.mergeManager) {
      this.savedMerges = shiftMergesForDelete(this.deps.mergeManager, this.targetRow);
    }

    this.deps.setRowCount(this.originalRowCount - 1);
  }

  undo(): void {
    const cells = collectCellsFromRow(this.deps.cellStore, this.targetRow);
    for (let i = cells.length - 1; i >= 0; i--) {
      this.deps.cellStore.delete(cells[i].row, cells[i].col);
    }
    for (const { row, col, data } of cells) {
      this.deps.cellStore.set(row + 1, col, data);
    }

    for (const { col, data } of this.savedRowData) {
      this.deps.cellStore.set(this.targetRow, col, data);
    }

    if (this.deps.mergeManager && this.savedMerges.length > 0) {
      restoreMerges(this.deps.mergeManager, this.savedMerges);
    }

    this.deps.setRowCount(this.originalRowCount);
  }
}
