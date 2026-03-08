// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ViewportManager — computes visible cell range from scroll position.
 *
 * Takes scroll position and viewport dimensions, returns the range of
 * visible rows and columns including a configurable buffer zone for
 * pre-rendering cells just outside the visible area.
 *
 * Pure computation — no rendering, no DOM, no Canvas dependency.
 */

import type { LayoutEngine } from './layout-engine';

export interface ViewportRange {
  /** First visible row index (inclusive, with buffer). */
  readonly startRow: number;
  /** Last visible row index (inclusive, with buffer). */
  readonly endRow: number;
  /** First visible column index (inclusive, with buffer). */
  readonly startCol: number;
  /** Last visible column index (inclusive, with buffer). */
  readonly endCol: number;
  /** Number of visible rows (including buffer). */
  readonly visibleRowCount: number;
  /** Number of visible columns (including buffer). */
  readonly visibleColCount: number;
}

export interface FrozenViewportRanges {
  corner: ViewportRange;
  frozenRow: ViewportRange;
  frozenCol: ViewportRange;
  main: ViewportRange;
}

export interface ViewportConfig {
  /** Number of extra rows to pre-render above/below visible area. Default: 10. */
  rowBuffer?: number;
  /** Number of extra columns to pre-render left/right of visible area. Default: 5. */
  colBuffer?: number;
}

const DEFAULT_ROW_BUFFER = 10;
const DEFAULT_COL_BUFFER = 5;

export class ViewportManager {
  private readonly layout: LayoutEngine;
  private readonly rowBuffer: number;
  private readonly colBuffer: number;

  constructor(layout: LayoutEngine, config?: ViewportConfig) {
    this.layout = layout;
    this.rowBuffer = config?.rowBuffer ?? DEFAULT_ROW_BUFFER;
    this.colBuffer = config?.colBuffer ?? DEFAULT_COL_BUFFER;
  }

  /**
   * Compute the range of visible rows and columns for the given scroll position
   * and viewport dimensions.
   *
   * @param scrollX - horizontal scroll offset (pixels)
   * @param scrollY - vertical scroll offset (pixels)
   * @param viewportWidth - viewport width (pixels, the visible content area)
   * @param viewportHeight - viewport height (pixels, the visible content area)
   */
  computeVisibleRange(
    scrollX: number,
    scrollY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): ViewportRange {
    const rowCount = this.layout.rowCount;
    const colCount = this.layout.columnCount;

    if (rowCount === 0 || colCount === 0) {
      // Even with 0 rows, columns should still be visible for header rendering
      if (colCount > 0 && rowCount === 0) {
        const firstVisibleCol = this.layout.getColAtX(Math.max(0, scrollX));
        const lastVisibleCol = this.layout.getColAtX(
          Math.min(scrollX + viewportWidth - 1, this.layout.totalWidth - 1),
        );
        const startCol = Math.max(0, firstVisibleCol - this.colBuffer);
        const endCol = Math.min(
          colCount - 1,
          (lastVisibleCol >= 0 ? lastVisibleCol : 0) + this.colBuffer,
        );
        return {
          startRow: 0,
          endRow: -1,
          startCol,
          endCol,
          visibleRowCount: 0,
          visibleColCount: endCol - startCol + 1,
        };
      }
      return {
        startRow: 0,
        endRow: -1,
        startCol: 0,
        endCol: -1,
        visibleRowCount: 0,
        visibleColCount: 0,
      };
    }

    // --- Rows ---
    // scrollY is relative to the content area (after header)
    const firstVisibleRow = this.layout.getRowAtY(Math.max(0, scrollY));
    const lastVisibleRow = this.layout.getRowAtY(
      Math.min(scrollY + viewportHeight - 1, this.layout.contentHeight - 1),
    );

    const startRow = Math.max(0, (firstVisibleRow === -1 ? 0 : firstVisibleRow) - this.rowBuffer);
    const endRow = Math.min(
      rowCount - 1,
      (lastVisibleRow === -1 ? rowCount - 1 : lastVisibleRow) + this.rowBuffer,
    );

    // --- Columns ---
    const firstVisibleCol = this.layout.getColAtX(Math.max(0, scrollX));
    const lastVisibleCol = this.layout.getColAtX(
      Math.min(scrollX + viewportWidth - 1, this.layout.contentWidth - 1),
    );

    const startCol = Math.max(0, (firstVisibleCol === -1 ? 0 : firstVisibleCol) - this.colBuffer);
    const endCol = Math.min(
      colCount - 1,
      (lastVisibleCol === -1 ? colCount - 1 : lastVisibleCol) + this.colBuffer,
    );

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      visibleRowCount: endRow - startRow + 1,
      visibleColCount: endCol - startCol + 1,
    };
  }

  /**
   * Compute 4 separate viewport ranges for frozen pane rendering.
   *
   * @param scrollX - horizontal scroll offset
   * @param scrollY - vertical scroll offset
   * @param viewportWidth - visible area width
   * @param viewportHeight - visible area height
   * @param frozenRows - number of frozen rows (0 = none)
   * @param frozenCols - number of frozen columns (0 = none)
   */
  computeFrozenRanges(
    scrollX: number,
    scrollY: number,
    viewportWidth: number,
    viewportHeight: number,
    frozenRows: number,
    frozenCols: number,
  ): FrozenViewportRanges {
    const rowCount = this.layout.rowCount;
    const colCount = this.layout.columnCount;
    const fr = Math.min(frozenRows, rowCount);
    const fc = Math.min(frozenCols, colCount);

    // Corner: frozen rows × frozen cols — no scroll
    const corner: ViewportRange = {
      startRow: 0,
      endRow: fr > 0 ? fr - 1 : -1,
      startCol: 0,
      endCol: fc > 0 ? fc - 1 : -1,
      visibleRowCount: fr,
      visibleColCount: fc,
    };

    // Frozen-row strip: frozen rows × scrolling cols
    const frozenRowRange = this.computeVisibleRange(scrollX, 0, viewportWidth, viewportHeight);
    const frozenRow: ViewportRange = {
      startRow: 0,
      endRow: fr > 0 ? fr - 1 : -1,
      startCol: Math.max(fc, frozenRowRange.startCol),
      endCol: frozenRowRange.endCol,
      visibleRowCount: fr,
      visibleColCount: Math.max(
        0,
        frozenRowRange.endCol - Math.max(fc, frozenRowRange.startCol) + 1,
      ),
    };

    // Frozen-col strip: scrolling rows × frozen cols
    const frozenColRange = this.computeVisibleRange(0, scrollY, viewportWidth, viewportHeight);
    const frozenCol: ViewportRange = {
      startRow: Math.max(fr, frozenColRange.startRow),
      endRow: frozenColRange.endRow,
      startCol: 0,
      endCol: fc > 0 ? fc - 1 : -1,
      visibleRowCount: Math.max(
        0,
        frozenColRange.endRow - Math.max(fr, frozenColRange.startRow) + 1,
      ),
      visibleColCount: fc,
    };

    // Main content: scrolling rows × scrolling cols
    const mainRange = this.computeVisibleRange(scrollX, scrollY, viewportWidth, viewportHeight);
    const main: ViewportRange = {
      startRow: Math.max(fr, mainRange.startRow),
      endRow: mainRange.endRow,
      startCol: Math.max(fc, mainRange.startCol),
      endCol: mainRange.endCol,
      visibleRowCount: Math.max(0, mainRange.endRow - Math.max(fr, mainRange.startRow) + 1),
      visibleColCount: Math.max(0, mainRange.endCol - Math.max(fc, mainRange.startCol) + 1),
    };

    return { corner, frozenRow, frozenCol, main };
  }
}
