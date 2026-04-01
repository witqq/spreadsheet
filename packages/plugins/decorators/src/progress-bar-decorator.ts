// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

export interface ProgressBarOptions {
  /** Bar color. Default: theme accent or '#4CAF50' */
  color?: string;
  /** Bar height in pixels. Default: 4 */
  height?: number;
  /** Corner radius. Default: 2 */
  borderRadius?: number;
  /** Vertical position. Default: 'bottom' */
  position?: 'top' | 'center' | 'bottom';
}

const DEFAULT_COLOR = '#4CAF50';
const DEFAULT_HEIGHT = 4;
const DEFAULT_RADIUS = 2;
const INSET = 2;

/**
 * Renders a colored bar behind cell text showing progress percentage.
 * Value comes from cell data (0-100 numeric or 0.0-1.0 fraction).
 */
export class ProgressBarDecorator implements CellDecorator {
  readonly id = 'progress-bar';
  readonly position = 'underlay' as const;

  constructor(private readonly options: ProgressBarOptions = {}) {}

  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    width: number,
    height: number,
    _theme: SpreadsheetTheme,
  ): void {
    const progress = this.getProgress(cellData);
    if (progress <= 0) return;

    const barHeight = this.options.height ?? DEFAULT_HEIGHT;
    const radius = this.options.borderRadius ?? DEFAULT_RADIUS;
    const color = this.options.color ?? DEFAULT_COLOR;
    const pos = this.options.position ?? 'bottom';

    let barY: number;
    if (pos === 'top') {
      barY = y + INSET;
    } else if (pos === 'center') {
      barY = y + (height - barHeight) / 2;
    } else {
      barY = y + height - barHeight - INSET;
    }

    const barX = x + INSET;
    const maxBarWidth = width - INSET * 2;
    const barWidth = maxBarWidth * Math.min(progress, 1);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;

    if (radius > 0) {
      this.roundRect(ctx, barX, barY, barWidth, barHeight, radius);
      ctx.fill();
    } else {
      ctx.fillRect(barX, barY, barWidth, barHeight);
    }

    ctx.globalAlpha = 1;
  }

  private getProgress(cellData: CellData): number {
    const raw = cellData.metadata?.progress as number | undefined;
    if (raw == null || typeof raw !== 'number' || isNaN(raw)) return 0;
    // Support both 0-100 and 0-1 ranges
    return raw > 1 ? raw / 100 : raw;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
