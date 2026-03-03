// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellStore } from '../model/cell-store';
import type { CellValue } from '../types/interfaces';
import type { Command } from './command';

export interface CellEdit {
  readonly row: number;
  readonly col: number;
  readonly oldValue: CellValue;
  readonly newValue: CellValue;
}

/**
 * Command for editing multiple cells in a single undoable operation.
 * Used by clipboard paste, autofill, and other bulk operations.
 */
export class BatchCellEditCommand implements Command {
  readonly description: string;

  constructor(
    private readonly cellStore: CellStore,
    private readonly edits: readonly CellEdit[],
  ) {
    this.description = `Batch edit (${edits.length} cells)`;
  }

  get affectedCells(): ReadonlyArray<{ row: number; col: number; oldValue: CellValue; newValue: CellValue }> {
    return this.edits;
  }

  execute(): void {
    for (const edit of this.edits) {
      this.cellStore.setValue(edit.row, edit.col, edit.newValue);
    }
  }

  undo(): void {
    // Undo in reverse order to correctly handle overlapping edits
    for (let i = this.edits.length - 1; i >= 0; i--) {
      const edit = this.edits[i];
      this.cellStore.setValue(edit.row, edit.col, edit.oldValue);
    }
  }
}
