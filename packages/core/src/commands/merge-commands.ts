// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { MergeManager } from '../merge/merge-manager';
import type { CellStore } from '../model/cell-store';
import type { CellData, CellValue, MergedRegion } from '../types/interfaces';
import type { Command } from './command';

/**
 * Stores a snapshot of cell data displaced by a merge operation.
 */
interface DisplacedCell {
  row: number;
  col: number;
  data: CellData;
}

/**
 * Command for merging a cell region. Undoable — restores displaced values on undo.
 */
export class MergeCellsCommand implements Command {
  readonly description: string;
  private readonly displaced: DisplacedCell[] = [];
  private readonly originalAnchorData: CellData | undefined;

  constructor(
    private readonly mergeManager: MergeManager,
    private readonly cellStore: CellStore,
    private readonly region: MergedRegion,
    private readonly value?: CellValue,
  ) {
    this.description = `Merge cells (${region.startRow},${region.startCol})-(${region.endRow},${region.endCol})`;

    // Snapshot anchor cell value if we'll overwrite it
    if (value !== undefined) {
      const anchorData = cellStore.get(region.startRow, region.startCol);
      this.originalAnchorData = anchorData ? { ...anchorData } : undefined;
    }

    // Snapshot displaced cell values before merge
    for (let r = region.startRow; r <= region.endRow; r++) {
      for (let c = region.startCol; c <= region.endCol; c++) {
        // Skip anchor cell — handled separately above
        if (r === region.startRow && c === region.startCol) continue;
        const data = cellStore.get(r, c);
        if (data) {
          this.displaced.push({ row: r, col: c, data: { ...data } });
        }
      }
    }
  }

  execute(): void {
    this.mergeManager.merge(this.region);
    if (this.value !== undefined) {
      this.cellStore.setValue(this.region.startRow, this.region.startCol, this.value);
    }
  }

  undo(): void {
    this.mergeManager.unmerge(this.region.startRow, this.region.startCol);
    // Restore anchor cell value if it was overwritten
    if (this.value !== undefined) {
      if (this.originalAnchorData) {
        this.cellStore.set(this.region.startRow, this.region.startCol, this.originalAnchorData);
      } else {
        this.cellStore.delete(this.region.startRow, this.region.startCol);
      }
    }
    // Restore displaced cell values
    for (const { row, col, data } of this.displaced) {
      this.cellStore.set(row, col, data);
    }
  }
}

/**
 * Command for unmerging a cell region. Undoable — re-merges on undo.
 */
export class UnmergeCellsCommand implements Command {
  readonly description: string;

  constructor(
    private readonly mergeManager: MergeManager,
    private readonly cellStore: CellStore,
    private readonly region: MergedRegion,
  ) {
    this.description = `Unmerge cells (${region.startRow},${region.startCol})-(${region.endRow},${region.endCol})`;
  }

  execute(): void {
    this.mergeManager.unmerge(this.region.startRow, this.region.startCol);
  }

  undo(): void {
    this.mergeManager.merge(this.region);
  }
}
