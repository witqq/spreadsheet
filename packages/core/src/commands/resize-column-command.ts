// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { LayoutEngine } from '../renderer/layout-engine';
import type { GridGeometry } from '../renderer/grid-geometry';
import type { Command } from './command';

/**
 * Command for resizing a column width.
 * Supports undo by restoring the previous width.
 * Updates both LayoutEngine (hit-testing) and GridGeometry (rendering).
 */
export class ResizeColumnCommand implements Command {
  readonly description: string;

  constructor(
    private readonly layoutEngine: LayoutEngine,
    private readonly gridGeometry: GridGeometry,
    private readonly colIndex: number,
    private readonly oldWidth: number,
    private readonly newWidth: number,
  ) {
    this.description = `Resize column ${colIndex}: ${oldWidth}→${newWidth}`;
  }

  execute(): void {
    this.applyWidth(this.newWidth);
  }

  undo(): void {
    this.applyWidth(this.oldWidth);
  }

  private applyWidth(width: number): void {
    this.layoutEngine.setColumnWidth(this.colIndex, width);
    this.gridGeometry.setColumnWidth(this.colIndex, width);
  }
}
