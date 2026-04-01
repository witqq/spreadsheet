// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  HitZone,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

const ICON_SIZE = 10;
const INDENT_PER_LEVEL = 16;
const HIT_ZONE_PADDING = 4;

export const TREE_TOGGLE_HIT_ZONE = 'tree-toggle';

/**
 * Renders an expand/collapse triangle icon with indentation based on a `treeLevel`
 * property in cell metadata. Uses HitZone with padding for easy clicking.
 */
export class TreeExpanderDecorator implements CellDecorator {
  readonly id = 'tree-expander';
  readonly position = 'left' as const;

  getWidth(
    cellData: CellData,
    _cellHeight: number,
    _ctx?: CanvasRenderingContext2D,
    _theme?: SpreadsheetTheme,
  ): number {
    const level = this.getLevel(cellData);
    return level * INDENT_PER_LEVEL + ICON_SIZE + HIT_ZONE_PADDING;
  }

  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    _width: number,
    height: number,
    theme: SpreadsheetTheme,
  ): void {
    const level = this.getLevel(cellData);
    const expanded = this.isExpanded(cellData);
    const indent = level * INDENT_PER_LEVEL;
    const centerX = x + indent + ICON_SIZE / 2;
    const centerY = y + height / 2;

    ctx.fillStyle = theme.colors.cellText;
    ctx.beginPath();

    if (expanded) {
      // Downward triangle (▼)
      ctx.moveTo(centerX - ICON_SIZE / 2, centerY - ICON_SIZE / 4);
      ctx.lineTo(centerX + ICON_SIZE / 2, centerY - ICON_SIZE / 4);
      ctx.lineTo(centerX, centerY + ICON_SIZE / 4);
    } else {
      // Right triangle (▶)
      ctx.moveTo(centerX - ICON_SIZE / 4, centerY - ICON_SIZE / 2);
      ctx.lineTo(centerX + ICON_SIZE / 4, centerY);
      ctx.lineTo(centerX - ICON_SIZE / 4, centerY + ICON_SIZE / 2);
    }

    ctx.closePath();
    ctx.fill();
  }

  getHitZones(
    _width: number,
    height: number,
    cellData: CellData,
  ): HitZone[] {
    const level = this.getLevel(cellData);
    const indent = level * INDENT_PER_LEVEL;
    return [
      {
        id: TREE_TOGGLE_HIT_ZONE,
        x: indent,
        y: (height - ICON_SIZE) / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
        cursor: 'pointer',
        padding: HIT_ZONE_PADDING,
      },
    ];
  }

  private getLevel(cellData: CellData): number {
    return (cellData.metadata?.treeLevel as number) ?? 0;
  }

  private isExpanded(cellData: CellData): boolean {
    return (cellData.metadata?.treeExpanded as boolean) ?? false;
  }
}
