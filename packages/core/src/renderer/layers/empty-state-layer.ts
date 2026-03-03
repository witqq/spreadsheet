// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';

/**
 * Renders "No data" text when there are no visible rows (e.g., all filtered out).
 */
export class EmptyStateLayer implements RenderLayer {
  render(rc: RenderContext): void {
    const { ctx, geometry, theme, canvasWidth, canvasHeight, viewport } = rc;

    // Only show when no visible rows
    if (viewport.endRow >= viewport.startRow) return;

    const text = 'No data';
    const centerX = canvasWidth / 2;
    const centerY = geometry.headerHeight + (canvasHeight - geometry.headerHeight) / 2;

    ctx.save();
    ctx.fillStyle = theme.colors.headerText;
    ctx.globalAlpha = 0.4;
    ctx.font = `${theme.fonts.headerSize + 2}px ${theme.fonts.header}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, centerX, centerY);
    ctx.restore();
  }
}
