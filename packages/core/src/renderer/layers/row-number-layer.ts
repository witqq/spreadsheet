// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';

export class RowNumberLayer implements RenderLayer {
  render(rc: RenderContext): void {
    // scrollX NOT used — gutter is fixed at left (x=0)
    const { ctx, geometry, theme, canvasHeight, viewport, scrollY } = rc;
    const rnWidth = geometry.rowNumberWidth;
    if (rnWidth === 0) return;

    const headerHeight = geometry.headerHeight;

    // Clip to content area below header (prevents row numbers rendering in header area)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerHeight, rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    // Gutter background — fixed at left, below header
    ctx.fillStyle = theme.colors.headerBackground;
    ctx.fillRect(0, headerHeight, rnWidth, canvasHeight - headerHeight);

    // Row numbers — x fixed at center, y scrolls vertically
    ctx.fillStyle = theme.colors.headerText;
    ctx.font = `${theme.fonts.cellSize}px ${theme.fonts.cell}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const y = headerHeight + rowY - scrollY;
      ctx.fillText(String(r + 1), rnWidth / 2, y + rowH / 2);
    }

    // Horizontal separators between row number cells
    ctx.strokeStyle = theme.colors.gridLine;
    ctx.lineWidth = theme.borders.gridLineWidth;
    ctx.beginPath();
    for (let r = viewport.startRow; r <= viewport.endRow + 1; r++) {
      const y = headerHeight + geometry.getRowY(r) - scrollY;
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(rnWidth, y + 0.5);
    }
    ctx.stroke();

    ctx.restore();
  }
}
