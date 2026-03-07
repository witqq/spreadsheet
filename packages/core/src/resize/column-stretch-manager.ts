// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ColumnStretchManager — distributes available container width across columns.
 *
 * Two stretch modes:
 *   'all'  — distribute extra space evenly among all stretchable columns
 *   'last' — give all remaining space to the last visible column
 *
 * Stretch is recalculated:
 *   - On container resize (ResizeObserver callback from engine)
 *   - On manual column resize (adjusts remaining stretch distribution)
 *   - On column visibility changes
 *
 * Frozen columns and manually resized columns are accounted for:
 *   their widths are subtracted from available space before distribution.
 */

import type { ColumnDef } from '../types/interfaces';

export type StretchMode = 'all' | 'last';

export interface ColumnStretchConfig {
  /** Stretch mode: 'all' distributes evenly, 'last' gives remaining to last column. */
  mode: StretchMode;
}

export interface StretchApplyCallback {
  (updates: Map<number, number>): void;
}

export class ColumnStretchManager {
  private readonly mode: StretchMode;
  private readonly applyWidths: StretchApplyCallback;

  /** Track columns that were manually resized (by visible index). */
  private readonly manuallyResized = new Set<number>();

  private destroyed = false;

  constructor(config: ColumnStretchConfig, applyWidths: StretchApplyCallback) {
    this.mode = config.mode;
    this.applyWidths = applyWidths;
  }

  /**
   * Mark a column as manually resized. Its current width is preserved
   * and excluded from stretch calculations.
   */
  markManualResize(visibleColIndex: number): void {
    this.manuallyResized.add(visibleColIndex);
  }

  /** Clear all manual resize marks (e.g. on column reorder). */
  clearManualResizes(): void {
    this.manuallyResized.clear();
  }

  /**
   * Calculate and apply stretched column widths.
   *
   * @param columns Full column definitions array
   * @param containerWidth Available container width in pixels (content area, excludes row number column)
   * @param frozenColumns Number of frozen columns (their widths are fixed, not stretched)
   * @param currentWidths Current visible column widths (from LayoutEngine)
   * @returns Map of visible column index → new width, or null if no changes needed
   */
  calculate(
    columns: ColumnDef[],
    containerWidth: number,
    frozenColumns: number,
    currentWidths: (colIndex: number) => number,
  ): Map<number, number> | null {
    if (this.destroyed || containerWidth <= 0) return null;

    const visibleCols = columns.reduce<number[]>((acc, col, i) => {
      if (!col.hidden) acc.push(i);
      return acc;
    }, []);

    if (visibleCols.length === 0) return null;

    // Compute total of current column widths
    let totalCurrentWidth = 0;
    for (let vi = 0; vi < visibleCols.length; vi++) {
      totalCurrentWidth += currentWidths(vi);
    }

    // If columns already fill or exceed container, no stretch needed
    if (totalCurrentWidth >= containerWidth) return null;

    const extraSpace = containerWidth - totalCurrentWidth;

    if (this.mode === 'last') {
      return this.calculateLastMode(visibleCols, currentWidths, extraSpace);
    }
    return this.calculateAllMode(visibleCols, columns, frozenColumns, currentWidths, extraSpace);
  }

  private calculateLastMode(
    visibleCols: number[],
    currentWidths: (colIndex: number) => number,
    extraSpace: number,
  ): Map<number, number> | null {
    const lastVisibleIndex = visibleCols.length - 1;
    const currentWidth = currentWidths(lastVisibleIndex);
    const newWidth = currentWidth + extraSpace;

    const updates = new Map<number, number>();
    updates.set(lastVisibleIndex, newWidth);
    return updates;
  }

  private calculateAllMode(
    visibleCols: number[],
    columns: ColumnDef[],
    frozenColumns: number,
    currentWidths: (colIndex: number) => number,
    extraSpace: number,
  ): Map<number, number> | null {
    // Determine which columns are stretchable:
    // - Not frozen
    // - Not manually resized
    const stretchable: number[] = [];
    for (let vi = 0; vi < visibleCols.length; vi++) {
      const colDefIndex = visibleCols[vi];
      const col = columns[colDefIndex];
      if (col.frozen || vi < frozenColumns || this.manuallyResized.has(vi)) {
        continue;
      }
      stretchable.push(vi);
    }

    if (stretchable.length === 0) {
      // All columns are frozen or manually resized — give remaining to last
      return this.calculateLastMode(visibleCols, currentWidths, extraSpace);
    }

    const perColumn = extraSpace / stretchable.length;
    const updates = new Map<number, number>();

    for (const vi of stretchable) {
      const currentWidth = currentWidths(vi);
      const colDefIndex = visibleCols[vi];
      const col = columns[colDefIndex];
      const minW = col.minWidth ?? 30;
      const newWidth = Math.max(currentWidth + perColumn, minW);
      updates.set(vi, newWidth);
    }

    return updates;
  }

  /**
   * Recalculate stretch and apply via callback.
   * Convenience method that combines calculate() + applyWidths().
   */
  recalculate(
    columns: ColumnDef[],
    containerWidth: number,
    frozenColumns: number,
    currentWidths: (colIndex: number) => number,
  ): void {
    const updates = this.calculate(columns, containerWidth, frozenColumns, currentWidths);
    if (updates && updates.size > 0) {
      this.applyWidths(updates);
    }
  }

  /** Whether the manager has been destroyed. */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Clean up. */
  destroy(): void {
    this.manuallyResized.clear();
    this.destroyed = true;
  }
}
