// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellStore } from '../model/cell-store';
import type { CellValue } from '../types/interfaces';
import type { Command } from './command';

/**
 * Command for editing a single cell value.
 * Supports undo by restoring the previous value.
 */
export class CellEditCommand implements Command {
  readonly description: string;

  constructor(
    private readonly cellStore: CellStore,
    private readonly row: number,
    private readonly col: number,
    private readonly oldValue: CellValue,
    private readonly newValue: CellValue,
  ) {
    this.description = `Edit cell (${row}, ${col})`;
  }

  get affectedCells(): ReadonlyArray<{
    row: number;
    col: number;
    oldValue: CellValue;
    newValue: CellValue;
  }> {
    return [{ row: this.row, col: this.col, oldValue: this.oldValue, newValue: this.newValue }];
  }

  execute(): void {
    this.cellStore.setValue(this.row, this.col, this.newValue);
  }

  undo(): void {
    this.cellStore.setValue(this.row, this.col, this.oldValue);
  }
}
