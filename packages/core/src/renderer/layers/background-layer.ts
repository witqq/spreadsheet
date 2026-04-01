// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { CellStore } from '../../model/cell-store';
import type { DataView } from '../../dataview/data-view';

export class BackgroundLayer implements RenderLayer {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;

  constructor(cellStore: CellStore, dataView: DataView) {
    this.cellStore = cellStore;
    this.dataView = dataView;
  }

  render(rc: RenderContext): void {
    const {
      ctx,
      canvasWidth,
      canvasHeight,
      theme,
      geometry,
      viewport,
      scrollX,
      scrollY,
      mergeManager,
    } = rc;

    // Canvas-wide theme fill (use clearRect for transparent backgrounds)
    if (theme.colors.background === 'transparent') {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = theme.colors.background;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Per-cell bgColor fills
    const colRects = geometry.computeColumnRects();
    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;

    let hasCellBg = false;

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        if (mergeManager?.isHiddenCell(physRow, c)) continue;

        const cellData = this.cellStore.get(physRow, c);
        const bgColor = cellData?.style?.style.bgColor;
        if (!bgColor) continue;

        // Lazy clip: only set up clip region when we find the first styled cell
        if (!hasCellBg) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
          ctx.clip();
          hasCellBg = true;
        }

        const cr = colRects[c];
        if (!cr) continue;

        const rowY = geometry.getRowY(r);
        const rowH = geometry.getRowHeight(r);
        const x = cr.x - scrollX;
        const y = headerHeight + rowY - scrollY;

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

        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }

    if (hasCellBg) {
      ctx.restore();
    }
  }
}
