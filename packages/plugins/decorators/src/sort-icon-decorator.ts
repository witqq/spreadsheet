// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  HitZone,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

const ICON_WIDTH = 14;
const ARROW_SIZE = 5;

export const SORT_HIT_ZONE = 'sort-request';

export type SortDirection = 'asc' | 'desc' | 'none';

/**
 * Renders a sort direction arrow (ascending/descending/none) based on
 * `metadata.sortDirection`. Provides a HitZone for click-to-sort interaction.
 */
export class SortIconDecorator implements CellDecorator {
  readonly id = 'sort-icon';
  readonly position = 'right' as const;

  getWidth(): number {
    return ICON_WIDTH;
  }

  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: SpreadsheetTheme,
  ): void {
    const direction = this.getDirection(cellData);
    if (direction === 'none') return;

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.fillStyle = theme.colors.cellText;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();

    if (direction === 'asc') {
      // Up arrow (▲)
      ctx.moveTo(centerX, centerY - ARROW_SIZE);
      ctx.lineTo(centerX + ARROW_SIZE, centerY + ARROW_SIZE);
      ctx.lineTo(centerX - ARROW_SIZE, centerY + ARROW_SIZE);
    } else {
      // Down arrow (▼)
      ctx.moveTo(centerX - ARROW_SIZE, centerY - ARROW_SIZE);
      ctx.lineTo(centerX + ARROW_SIZE, centerY - ARROW_SIZE);
      ctx.lineTo(centerX, centerY + ARROW_SIZE);
    }

    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  getHitZones(
    width: number,
    height: number,
  ): HitZone[] {
    return [
      {
        id: SORT_HIT_ZONE,
        x: 0,
        y: 0,
        width,
        height,
        cursor: 'pointer',
        padding: 2,
      },
    ];
  }

  private getDirection(cellData: CellData): SortDirection {
    return (cellData.metadata?.sortDirection as SortDirection) ?? 'none';
  }
}
