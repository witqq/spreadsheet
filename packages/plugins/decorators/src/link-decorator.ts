// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  HitZone,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

const ICON_SIZE = 14;
const LINK_COLOR = '#1976D2';

export const LINK_HIT_ZONE = 'link-open';

/**
 * Renders a link icon for cells with `metadata.link`. Clicking the hit zone
 * opens the URL. Cursor changes to pointer on hover.
 */
export class LinkDecorator implements CellDecorator {
  readonly id = 'link';
  readonly position = 'overlay' as const;

  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    width: number,
    _height: number,
    _theme: SpreadsheetTheme,
  ): void {
    const link = this.getLink(cellData);
    if (!link) return;

    // Draw a small link icon at top-right corner
    const iconX = x + width - ICON_SIZE - 2;
    const iconY = y + 2;
    const iconSize = ICON_SIZE - 2;

    ctx.strokeStyle = LINK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Simplified external link icon: box with arrow
    const bx = iconX + 1;
    const by = iconY + 3;
    const bs = iconSize - 4;

    // Box (bottom-left part)
    ctx.beginPath();
    ctx.moveTo(bx + bs * 0.4, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by + bs);
    ctx.lineTo(bx + bs, by + bs);
    ctx.lineTo(bx + bs, by + bs * 0.6);
    ctx.stroke();

    // Arrow (top-right)
    ctx.beginPath();
    ctx.moveTo(bx + bs * 0.5, by + bs * 0.5);
    ctx.lineTo(bx + bs, by);
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(bx + bs * 0.65, by);
    ctx.lineTo(bx + bs, by);
    ctx.lineTo(bx + bs, by + bs * 0.35);
    ctx.stroke();
  }

  getHitZones(
    width: number,
    _height: number,
    cellData: CellData,
  ): HitZone[] {
    const link = this.getLink(cellData);
    if (!link) return [];

    return [
      {
        id: LINK_HIT_ZONE,
        x: width - ICON_SIZE - 2,
        y: 0,
        width: ICON_SIZE + 2,
        height: ICON_SIZE + 2,
        cursor: 'pointer',
        padding: 3,
      },
    ];
  }

  private getLink(cellData: CellData): string | undefined {
    const link = cellData.metadata?.link;
    if (link && typeof link === 'object' && 'url' in link) {
      return typeof link.url === 'string' && link.url.length > 0 ? link.url : undefined;
    }
    return undefined;
  }
}
