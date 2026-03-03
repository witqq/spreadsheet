// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { CellStore } from '../../model/cell-store';
import type { DataView } from '../../dataview/data-view';

const TRIANGLE_SIZE = 6;
const DOT_RADIUS = 3;
const MARGIN = 2;
const ERROR_RED = '#e53935';

/**
 * CellStatusLayer — renders visual indicators for cell metadata status.
 *
 * - 'error': red triangle in top-right corner
 * - 'changed': blue dot in top-right corner
 * - 'saved': green dot in top-right corner
 * - 'saving': same as changed (blue dot)
 */
export class CellStatusLayer implements RenderLayer {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;

  constructor(cellStore: CellStore, dataView: DataView) {
    this.cellStore = cellStore;
    this.dataView = dataView;
  }

  render(rc: RenderContext): void {
    const { ctx, geometry, theme, viewport, scrollX, scrollY, canvasWidth, canvasHeight } = rc;
    const colRects = geometry.computeColumnRects();
    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const y = headerHeight + rowY - scrollY;
      const physRow = this.dataView.getPhysicalRow(r);

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        const cellData = this.cellStore.get(physRow, c);
        if (!cellData?.metadata?.status) continue;

        const cr = colRects[c];
        const cellX = cr.x - scrollX;
        const status = cellData.metadata.status;

        if (status === 'error') {
          this.drawErrorTriangle(ctx, cellX, y, cr.width);
        } else if (status === 'changed' || status === 'saving') {
          this.drawStatusDot(ctx, cellX, y, cr.width, rowH, theme.colors.changedIndicator);
        } else if (status === 'saved') {
          this.drawStatusDot(ctx, cellX, y, cr.width, rowH, theme.colors.savedIndicator);
        }
      }
    }

    ctx.restore();
  }

  /** Red triangle in the top-right corner of the cell. */
  private drawErrorTriangle(
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    cellWidth: number,
  ): void {
    const right = cellX + cellWidth;
    const top = cellY;

    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(right - TRIANGLE_SIZE, top);
    ctx.lineTo(right, top + TRIANGLE_SIZE);
    ctx.closePath();
    ctx.fillStyle = ERROR_RED;
    ctx.fill();
  }

  /** Small colored dot near the top-right corner of the cell. */
  private drawStatusDot(
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    cellWidth: number,
    _cellHeight: number,
    color: string,
  ): void {
    const cx = cellX + cellWidth - DOT_RADIUS - MARGIN;
    const cy = cellY + DOT_RADIUS + MARGIN;

    ctx.beginPath();
    ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
