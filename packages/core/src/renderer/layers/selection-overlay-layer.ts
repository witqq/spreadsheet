// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * SelectionOverlayLayer — renders selection highlight on the canvas.
 *
 * Draws translucent fill over selected ranges and a distinct border
 * around the active cell. Renders above cell text so text remains visible
 * through the semi-transparent overlay.
 *
 * Merge-aware: active cell border wraps the full merged region,
 * and range fill skips hidden cells within merges.
 */

import type { RenderLayer, RenderContext } from '../render-layer';
import type { SelectionManager } from '../../selection/selection-manager';
import type { DataView } from '../../dataview/data-view';

export class SelectionOverlayLayer implements RenderLayer {
  private readonly selectionManager: SelectionManager;
  private readonly dataView: DataView;

  constructor(selectionManager: SelectionManager, dataView: DataView) {
    this.selectionManager = selectionManager;
    this.dataView = dataView;
  }

  render(rc: RenderContext): void {
    const { ctx, geometry, theme, viewport, scrollX, scrollY, canvasWidth, canvasHeight, mergeManager } = rc;
    const selection = this.selectionManager.getSelection();

    if (selection.ranges.length === 0) return;

    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;
    const colRects = geometry.computeColumnRects();

    ctx.save();

    // Clip to the cell area (exclude header and row number gutter)
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    // Draw fill and border for each selected range
    for (const range of selection.ranges) {
      // Clamp to visible viewport for fill rendering
      const startRow = Math.max(range.startRow, viewport.startRow);
      const endRow = Math.min(range.endRow, viewport.endRow);
      const startCol = Math.max(range.startCol, viewport.startCol);
      const endCol = Math.min(range.endCol, viewport.endCol);

      if (startRow > endRow || startCol > endCol) continue;
      if (startCol >= colRects.length || endCol >= colRects.length) continue;

      // Compute the pixel rectangle for the visible portion of the range
      const x1 = colRects[startCol].x - scrollX;
      const x2 = colRects[endCol].x + colRects[endCol].width - scrollX;
      const y1 = headerHeight + geometry.getRowY(startRow) - scrollY;
      const y2 = headerHeight + geometry.getRowY(endRow) + geometry.getRowHeight(endRow) - scrollY;

      // Translucent fill
      ctx.fillStyle = theme.colors.selectionFill;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      // Range border (use full range coordinates for continuous border)
      const fullStartCol = Math.max(range.startCol, 0);
      const fullEndCol = Math.min(range.endCol, colRects.length - 1);
      if (fullStartCol >= colRects.length) continue;

      const bx1 = colRects[fullStartCol].x - scrollX;
      const bx2 = colRects[fullEndCol].x + colRects[fullEndCol].width - scrollX;
      const by1 = headerHeight + geometry.getRowY(range.startRow) - scrollY;
      const by2 = headerHeight + geometry.getRowY(range.endRow) + geometry.getRowHeight(range.endRow) - scrollY;

      ctx.strokeStyle = theme.colors.selectionBorder;
      ctx.lineWidth = theme.borders.selectionWidth;
      ctx.strokeRect(
        bx1 + 0.5,
        by1 + 0.5,
        bx2 - bx1 - 1,
        by2 - by1 - 1,
      );
    }

    // Draw active cell border — wraps full merged region if merged
    const ac = selection.activeCell;
    let acStartRow = ac.row;
    let acEndRow = ac.row;
    let acStartCol = ac.col;
    let acEndCol = ac.col;

    if (mergeManager) {
      const physRow = this.dataView.getPhysicalRow(ac.row);
      const region = mergeManager.getMergedRegion(physRow, ac.col);
      if (region) {
        const logStart = this.dataView.getLogicalRow(region.startRow);
        const logEnd = this.dataView.getLogicalRow(region.endRow);
        if (logStart !== undefined && logEnd !== undefined) {
          acStartRow = logStart;
          acEndRow = logEnd;
          acStartCol = region.startCol;
          acEndCol = region.endCol;
        }
      }
    }

    if (
      acEndRow >= viewport.startRow && acStartRow <= viewport.endRow &&
      acEndCol >= viewport.startCol && acStartCol <= viewport.endCol &&
      acStartCol < colRects.length && acEndCol < colRects.length
    ) {
      const acX = colRects[acStartCol].x - scrollX;
      const acY = headerHeight + geometry.getRowY(acStartRow) - scrollY;

      let acW = 0;
      for (let c = acStartCol; c <= acEndCol; c++) {
        acW += colRects[c].width;
      }
      let acH = 0;
      for (let r = acStartRow; r <= acEndRow; r++) {
        acH += geometry.getRowHeight(r);
      }

      ctx.strokeStyle = theme.colors.activeCellBorder;
      ctx.lineWidth = theme.borders.activeCellWidth;
      ctx.strokeRect(
        acX + 0.5,
        acY + 0.5,
        acW - 1,
        acH - 1,
      );
    }

    ctx.restore();
  }
}
