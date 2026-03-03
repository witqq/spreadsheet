// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { TextMeasureCache } from '../text-measure-cache';
import type { CellStore } from '../../model/cell-store';
import type { DataView } from '../../dataview/data-view';
import { CellTypeRegistry } from '../../types/cell-type-registry';

export class CellTextLayer implements RenderLayer {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly measureCache: TextMeasureCache;
  private readonly typeRegistry: CellTypeRegistry;

  constructor(cellStore: CellStore, dataView: DataView, measureCache: TextMeasureCache, typeRegistry?: CellTypeRegistry) {
    this.cellStore = cellStore;
    this.dataView = dataView;
    this.measureCache = measureCache;
    this.typeRegistry = typeRegistry ?? new CellTypeRegistry();
  }

  render(rc: RenderContext): void {
    this.renderFull(rc);
  }

  /**
   * Full mode: text with truncation, formatting, and proper alignment.
   * Uses CellTypeRegistry for type-aware formatting and custom rendering.
   * Handles merged cells: skips hidden cells, spans anchor cells across merged area.
   */
  private renderFull(rc: RenderContext): void {
    const { ctx, geometry, theme, viewport, scrollX, scrollY, canvasWidth, canvasHeight, mergeManager } = rc;
    const colRects = geometry.computeColumnRects();
    const visibleCols = geometry.getVisibleColumns();
    const headerHeight = geometry.headerHeight;
    const padding = geometry.cellPadding;
    const rnWidth = geometry.rowNumberWidth;
    const font = `${theme.fonts.cellSize}px ${theme.fonts.cell}`;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    ctx.font = font;
    ctx.fillStyle = theme.colors.cellText;
    ctx.textBaseline = 'middle';

    // Collect anchors to render — includes off-screen anchors whose merge overlaps the viewport
    const anchorsToRender: Array<{ logicalRow: number; col: number }> = [];

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        if (mergeManager?.isHiddenCell(physRow, c)) {
          // This cell is hidden — check if its anchor is off-screen and needs rendering
          const region = mergeManager.getMergedRegion(physRow, c);
          if (region) {
            const anchorLogical = this.dataView.getLogicalRow(region.startRow);
            if (
              anchorLogical !== undefined &&
              (anchorLogical < viewport.startRow || region.startCol < viewport.startCol)
            ) {
              // Anchor is off-screen — add it if not already queued
              if (!anchorsToRender.some((a) => a.logicalRow === anchorLogical && a.col === region.startCol)) {
                anchorsToRender.push({ logicalRow: anchorLogical, col: region.startCol });
              }
            }
          }
          continue;
        }

        anchorsToRender.push({ logicalRow: r, col: c });
      }
    }

    for (const { logicalRow: r, col: c } of anchorsToRender) {
      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const y = headerHeight + rowY - scrollY;
      const physRow = this.dataView.getPhysicalRow(r);

      const cellData = this.cellStore.get(physRow, c);
      if (!cellData || cellData.value == null) continue;

      const cr = colRects[c];
      if (!cr) continue;
      const col = visibleCols[c];
      if (!col) continue;

      const rawValue = cellData.value;
      const cellX = cr.x - scrollX;

      // Compute merged cell dimensions if this is an anchor cell
      let cellWidth = cr.width;
      let cellHeight = rowH;
      if (mergeManager?.isAnchorCell(physRow, c)) {
        const region = mergeManager.getMergedRegion(physRow, c);
        if (region) {
          cellWidth = 0;
          for (let mc = region.startCol; mc <= region.endCol && mc < colRects.length; mc++) {
            cellWidth += colRects[mc].width;
          }
          cellHeight = 0;
          for (let mr = region.startRow; mr <= region.endRow; mr++) {
            const logicalMr = this.dataView.getLogicalRow(mr);
            if (logicalMr !== undefined) {
              cellHeight += geometry.getRowHeight(logicalMr);
            }
          }
        }
      }

      const cellType = col.type ?? cellData.type ?? this.typeRegistry.detectType(rawValue);
      const renderer = this.typeRegistry.get(cellType);

      if (renderer.render) {
        ctx.save();
        renderer.render(ctx, rawValue, cellX, y, cellWidth, cellHeight, theme);
        ctx.restore();
        // Restore state for subsequent default text rendering
        ctx.font = font;
        ctx.fillStyle = theme.colors.cellText;
        ctx.textBaseline = 'middle';
        continue;
      }

      const text = renderer.format(rawValue);
      if (text === '') continue;

      const availableWidth = cellWidth - padding * 2;
      const displayText = this.measureCache.truncateText(ctx, text, font, availableWidth);
      if (displayText === '') continue;

      const align = renderer.align;
      ctx.textAlign = align;

      if (align === 'right') {
        ctx.fillText(displayText, cellX + cellWidth - padding, y + cellHeight / 2);
      } else if (align === 'center') {
        ctx.fillText(displayText, cellX + cellWidth / 2, y + cellHeight / 2);
      } else {
        ctx.fillText(displayText, cellX + padding, y + cellHeight / 2);
      }
    }

    ctx.restore();
  }
}
