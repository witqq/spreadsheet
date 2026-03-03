// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RemoteCursorLayer — renders colored overlays for remote users' cursor positions.
 *
 * Each remote cursor is drawn as a colored rectangle over the active cell
 * with a name label above the cell.
 */

import type { RenderLayer, RenderContext } from '@witqq/spreadsheet';

export interface RemoteCursor {
  clientId: string;
  color: string;
  name: string;
  row: number;
  col: number;
}

export class RemoteCursorLayer implements RenderLayer {
  private cursors: Map<string, RemoteCursor> = new Map();

  setCursor(clientId: string, cursor: RemoteCursor | null): void {
    if (cursor) {
      this.cursors.set(clientId, cursor);
    } else {
      this.cursors.delete(clientId);
    }
  }

  removeCursor(clientId: string): void {
    this.cursors.delete(clientId);
  }

  getCursors(): RemoteCursor[] {
    return Array.from(this.cursors.values());
  }

  render(rc: RenderContext): void {
    if (this.cursors.size === 0) return;
    if (rc.renderMode === 'placeholder') return;

    const { ctx, geometry, viewport, scrollX, scrollY } = rc;

    ctx.save();

    for (const cursor of this.cursors.values()) {
      const { row, col, color, name } = cursor;

      // Skip if outside viewport
      if (
        row < viewport.startRow ||
        row > viewport.endRow ||
        col < viewport.startCol ||
        col > viewport.endCol
      ) {
        continue;
      }

      const cellRect = geometry.computeCellRect(row, col);
      if (!cellRect) continue;

      // computeCellRect already includes rowNumberWidth in x and headerHeight in y
      const x = cellRect.x - scrollX;
      const y = cellRect.y - scrollY;
      const w = cellRect.width;
      const h = cellRect.height;

      // Draw cell highlight (semi-transparent fill)
      ctx.fillStyle = color + '33'; // ~20% opacity
      ctx.fillRect(x, y, w, h);

      // Draw cell border (solid color, 2px)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Draw name label above the cell
      ctx.font = '11px sans-serif';
      const textWidth = ctx.measureText(name).width;
      const labelW = textWidth + 8;
      const labelH = 16;
      const labelX = x;
      const labelY = y - labelH;

      // Label background
      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, labelW, labelH);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, labelX + 4, labelY + labelH / 2);
    }

    ctx.restore();
  }
}
