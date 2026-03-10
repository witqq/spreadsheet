// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ConditionalFormatLayer — renders cell backgrounds, data bars, and icons
 * based on conditional formatting rules.
 *
 * Uses destination-over compositing to paint behind existing content
 * (text, selection overlays) regardless of layer order.
 */

import type { RenderLayer, RenderContext } from '@witqq/spreadsheet';
import type {
  ConditionalFormatRule,
  ValueCondition,
  GradientScaleCondition,
  DataBarCondition,
  IconSetCondition,
  ComparisonOperator,
  CellValue,
} from '@witqq/spreadsheet';
import type { CellStore } from '@witqq/spreadsheet';
import type { DataView } from '@witqq/spreadsheet';

export class ConditionalFormatLayer implements RenderLayer {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private rules: ConditionalFormatRule[] = [];

  constructor(cellStore: CellStore, dataView: DataView) {
    this.cellStore = cellStore;
    this.dataView = dataView;
  }

  setRules(rules: ConditionalFormatRule[]): void {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  getRules(): readonly ConditionalFormatRule[] {
    return this.rules;
  }

  render(rc: RenderContext): void {
    if (rc.renderMode === 'placeholder' || this.rules.length === 0) return;

    const { ctx, geometry, viewport, scrollX, scrollY, canvasWidth, canvasHeight, mergeManager } = rc;
    const colRects = geometry.computeColumnRects();
    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    // Paint on top of background; alpha blending makes gradients/bars translucent
    ctx.globalCompositeOperation = 'source-over';

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        if (mergeManager?.isHiddenCell(physRow, c)) continue;

        const cellData = this.cellStore.get(physRow, c);
        const cellValue = cellData?.value ?? null;

        const cr = colRects[c];
        if (!cr) continue;

        const rowY = geometry.getRowY(r);
        const rowH = geometry.getRowHeight(r);
        const x = cr.x - scrollX;
        const y = headerHeight + rowY - scrollY;

        // Compute merged cell dimensions
        let cellWidth = cr.width;
        let cellHeight = rowH;
        if (mergeManager?.isAnchorCell(physRow, c)) {
          const region = mergeManager.getMergedRegion(physRow, c);
          if (region) {
            cellWidth = 0;
            for (let mc = region.startCol; mc <= region.endCol && mc < colRects.length; mc++) {
              cellWidth += colRects[mc].width;
            }
            cellHeight = 0;
            for (let mr = region.startRow; mr <= region.endRow; mr++) {
              const logicalMr = this.dataView.getLogicalRow(mr);
              if (logicalMr !== undefined) {
                cellHeight += geometry.getRowHeight(logicalMr);
              }
            }
          }
        }

        this.applyRules(ctx, physRow, c, cellValue, x, y, cellWidth, cellHeight, rc.theme.colors.background);
      }
    }

    ctx.restore();
  }

  private applyRules(
    ctx: CanvasRenderingContext2D,
    physRow: number,
    col: number,
    cellValue: CellValue,
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
  ): void {
    // Clip to cell interior (inset 1px) to preserve grid lines at cell boundaries
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.clip();

    for (const rule of this.rules) {
      if (!this.cellInRange(physRow, col, rule)) continue;

      const condition = rule.condition;
      let applied = false;

      switch (condition.type) {
        case 'value':
          applied = this.renderValueCondition(ctx, cellValue, condition, rule, x, y, w, h, bgColor);
          break;
        case 'gradientScale':
          applied = this.renderGradientScale(ctx, cellValue, condition, x, y, w, h);
          break;
        case 'dataBar':
          applied = this.renderDataBar(ctx, cellValue, condition, x, y, w, h);
          break;
        case 'iconSet':
          applied = this.renderIconSet(ctx, cellValue, condition, x, y, w, h, bgColor);
          break;
      }

      if (applied && rule.stopIfTrue) break;
    }

    ctx.restore();
  }

  private cellInRange(physRow: number, col: number, rule: ConditionalFormatRule): boolean {
    const { startRow, endRow, startCol, endCol } = rule.range;
    return physRow >= startRow && physRow <= endRow && col >= startCol && col <= endCol;
  }

  private renderValueCondition(
    ctx: CanvasRenderingContext2D,
    cellValue: CellValue,
    condition: ValueCondition,
    rule: ConditionalFormatRule,
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
  ): boolean {
    if (!evaluateComparison(cellValue, condition.operator, condition.value, condition.value2)) {
      return false;
    }
    if (rule.style?.bgColor) {
      ctx.fillStyle = rule.style.bgColor;
      ctx.fillRect(x, y, w, h);
    }
    if (rule.style?.textColor && cellValue != null) {
      // Clear cell area and re-render text with conditional format color
      ctx.clearRect(x, y, w, h);
      ctx.fillStyle = rule.style.bgColor ?? bgColor;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rule.style.textColor;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(String(cellValue), x + 4, y + h / 2);
    }
    return true;
  }

  private renderGradientScale(
    ctx: CanvasRenderingContext2D,
    cellValue: CellValue,
    condition: GradientScaleCondition,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const num = toNumber(cellValue);
    if (num === null || condition.stops.length < 2) return false;

    const color = interpolateColor(num, condition.stops);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1.0;
    return true;
  }

  private renderDataBar(
    ctx: CanvasRenderingContext2D,
    cellValue: CellValue,
    condition: DataBarCondition,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const num = toNumber(cellValue);
    if (num === null) return false;

    const min = condition.minValue ?? 0;
    const max = condition.maxValue ?? 100;
    if (max <= min) return false;

    const ratio = Math.max(0, Math.min(1, (num - min) / (max - min)));
    const barWidth = Math.round(w * ratio);

    if (barWidth > 0) {
      ctx.fillStyle = condition.color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, barWidth, h);
      ctx.globalAlpha = 1.0;
    }
    return true;
  }

  private renderIconSet(
    ctx: CanvasRenderingContext2D,
    cellValue: CellValue,
    condition: IconSetCondition,
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor: string,
  ): boolean {
    const num = toNumber(cellValue);
    if (num === null) return false;

    const sorted = [...condition.thresholds].sort((a, b) => b.value - a.value);
    let icon = sorted[sorted.length - 1]?.icon ?? '';
    for (const threshold of sorted) {
      if (num >= threshold.value) {
        icon = threshold.icon;
        break;
      }
    }

    if (icon) {
      ctx.save();
      // Clip to cell rect to prevent overflow
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      // Clear cell area to erase the number drawn by CellTextLayer
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(x, y, w, h);
      // Draw cell background using theme color
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, w, h);
      // Draw icon
      ctx.fillStyle = '#000000';
      ctx.font = `${Math.floor(h * 0.6)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, x + 2, y + h / 2);
      ctx.restore();
      // Restore compositing mode for subsequent rules
      ctx.globalCompositeOperation = 'source-over';
    }
    return true;
  }
}

// ─── Utility functions ────────────────────────────────────────

export function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

export function evaluateComparison(
  cellValue: CellValue,
  operator: ComparisonOperator,
  threshold: number,
  threshold2?: number,
): boolean {
  const num = toNumber(cellValue);
  if (num === null) return false;

  switch (operator) {
    case 'greaterThan':
      return num > threshold;
    case 'lessThan':
      return num < threshold;
    case 'greaterThanOrEqual':
      return num >= threshold;
    case 'lessThanOrEqual':
      return num <= threshold;
    case 'equal':
      return num === threshold;
    case 'notEqual':
      return num !== threshold;
    case 'between':
      return threshold2 !== undefined && num >= threshold && num <= threshold2;
    case 'notBetween':
      return threshold2 !== undefined && (num < threshold || num > threshold2);
  }
}

export function interpolateColor(
  value: number,
  stops: readonly { readonly value: number; readonly color: string }[],
): string {
  if (stops.length === 0) return 'transparent';
  if (stops.length === 1) return stops[0].color;

  const sorted = [...stops].sort((a, b) => a.value - b.value);

  if (value <= sorted[0].value) return sorted[0].color;
  if (value >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].color;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (value >= sorted[i].value && value <= sorted[i + 1].value) {
      const t = (value - sorted[i].value) / (sorted[i + 1].value - sorted[i].value);
      return lerpColor(sorted[i].color, sorted[i + 1].color, t);
    }
  }

  return sorted[sorted.length - 1].color;
}

function lerpColor(color1: string, color2: string, t: number): string {
  const rgb1 = parseHexColor(color1);
  const rgb2 = parseHexColor(color2);
  if (!rgb1 || !rgb2) return color1;

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);

  return `rgb(${r},${g},${b})`;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}
