// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

const SPINNER_RADIUS = 6;
const SPINNER_LINE_WIDTH = 2;
const ARC_LENGTH = Math.PI * 1.4;
const ROTATION_SPEED = 0.003; // radians per ms

/**
 * Renders a spinning loading indicator for cells with `metadata.loading === true`.
 * Demonstrates animation support via the `timestamp` parameter from Step 10.
 */
export class SpinnerDecorator implements CellDecorator {
  readonly id = 'spinner';
  readonly position = 'overlay' as const;

  render(
    ctx: CanvasRenderingContext2D,
    _cellData: CellData,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: SpreadsheetTheme,
    _row?: number,
    _col?: number,
    timestamp?: number,
  ): void {
    const centerX = x + width - SPINNER_RADIUS - 4;
    const centerY = y + height / 2;
    const rotation = ((timestamp ?? 0) * ROTATION_SPEED) % (Math.PI * 2);

    ctx.strokeStyle = theme.colors.cellText;
    ctx.lineWidth = SPINNER_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.7;

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      SPINNER_RADIUS,
      rotation,
      rotation + ARC_LENGTH,
    );
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}
