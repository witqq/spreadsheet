// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { AutofillManager } from '../../autofill/autofill-manager';
import { HANDLE_SIZE } from '../../autofill/autofill-manager';

const HALF = Math.floor(HANDLE_SIZE / 2);

/**
 * FillHandleLayer — renders the fill handle and autofill preview overlay.
 *
 * Draws a small filled square at the bottom-right of the current selection
 * (the drag handle). During an active fill drag, renders a dashed border
 * preview of the target fill range.
 */
export class FillHandleLayer implements RenderLayer {
  private readonly autofillManager: AutofillManager;

  constructor(autofillManager: AutofillManager) {
    this.autofillManager = autofillManager;
  }

  render(rc: RenderContext): void {
    const { ctx, geometry, theme, scrollX, scrollY, canvasWidth, canvasHeight } = rc;

    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    // Draw fill handle at bottom-right of selection
    const handlePos = this.autofillManager.getHandlePosition();
    if (handlePos) {
      ctx.fillStyle = theme.colors.activeCellBorder;
      ctx.fillRect(
        handlePos.x - HALF,
        handlePos.y - HALF,
        HANDLE_SIZE,
        HANDLE_SIZE,
      );
      // White border for contrast
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        handlePos.x - HALF + 0.5,
        handlePos.y - HALF + 0.5,
        HANDLE_SIZE - 1,
        HANDLE_SIZE - 1,
      );
    }

    // Draw fill preview range during drag
    const fillRange = this.autofillManager.getFillRange();
    if (fillRange && this.autofillManager.isDragging) {
      const colRects = geometry.computeColumnRects();
      const startCol = Math.max(fillRange.startCol, 0);
      const endCol = Math.min(fillRange.endCol, colRects.length - 1);

      if (startCol <= endCol && startCol < colRects.length) {
        const x1 = colRects[startCol].x - scrollX;
        const x2 = colRects[endCol].x + colRects[endCol].width - scrollX;
        const y1 = headerHeight + geometry.getRowY(fillRange.startRow) - scrollY;
        const y2 =
          headerHeight +
          geometry.getRowY(fillRange.endRow) +
          geometry.getRowHeight(fillRange.endRow) -
          scrollY;

        // Dashed border for preview
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = theme.colors.activeCellBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
        ctx.setLineDash([]);

        // Light fill for preview area
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }

    ctx.restore();
  }
}
