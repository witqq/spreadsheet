// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { LayoutEngine } from '../renderer/layout-engine';
import type { Command } from './command';

/**
 * Command for resizing a row height.
 * Supports undo by restoring the previous height.
 */
export class ResizeRowCommand implements Command {
  readonly description: string;

  constructor(
    private readonly layoutEngine: LayoutEngine,
    private readonly rowIndex: number,
    private readonly oldHeight: number,
    private readonly newHeight: number,
  ) {
    this.description = `Resize row ${rowIndex}: ${oldHeight}→${newHeight}`;
  }

  execute(): void {
    this.layoutEngine.setRowHeight(this.rowIndex, this.newHeight);
  }

  undo(): void {
    this.layoutEngine.setRowHeight(this.rowIndex, this.oldHeight);
  }
}
