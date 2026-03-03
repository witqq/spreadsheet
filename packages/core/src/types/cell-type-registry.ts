// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * CellTypeRegistry — maps CellType to render and format functions.
 *
 * Each registered type provides:
 * - format: converts CellValue to display string
 * - align: text alignment ('left' | 'center' | 'right')
 * - render (optional): custom canvas rendering (e.g. checkbox for boolean)
 *
 * When a type has a custom render function, it is called instead of
 * the default text rendering path in CellTextLayer.
 */

import type { CellType, CellValue } from './interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';

export type CellAlignment = 'left' | 'center' | 'right';

export interface CellTypeRenderer {
  /** Format a cell value for text display. */
  format(value: CellValue): string;
  /** Text alignment for this cell type. */
  align: CellAlignment;
  /**
   * Optional custom canvas rendering. When provided, CellTextLayer
   * calls this instead of fillText. The renderer receives the cell
   * area coordinates (already adjusted for scroll offset).
   */
  render?: (
    ctx: CanvasRenderingContext2D,
    value: CellValue,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: SpreadsheetTheme,
  ) => void;
}

const stringRenderer: CellTypeRenderer = {
  format: (value) => (value != null ? String(value) : ''),
  align: 'left',
};

const numberRenderer: CellTypeRenderer = {
  format: (value) => {
    if (value == null) return '';
    if (typeof value === 'number') {
      return value.toLocaleString('en-US');
    }
    return String(value);
  },
  align: 'right',
};

const booleanRenderer: CellTypeRenderer = {
  format: (value) => (value != null ? String(value) : ''),
  align: 'center',
  render: (ctx, value, x, y, width, height, theme) => {
    const size = Math.min(14, height - 6);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const half = size / 2;

    // Draw checkbox box
    ctx.strokeStyle = theme.colors.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - half, cy - half, size, size);

    // Draw checkmark if true
    if (value === true) {
      ctx.strokeStyle = theme.colors.activeCellBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - half + 3, cy);
      ctx.lineTo(cx - half + size / 3, cy + half - 3);
      ctx.lineTo(cx + half - 3, cy - half + 3);
      ctx.stroke();
    }
  },
};

const dateRenderer: CellTypeRenderer = {
  format: (value) => {
    if (value == null) return '';
    if (value instanceof Date) {
      return value.toLocaleDateString('en-US');
    }
    // Try to parse string dates
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US');
      }
    }
    return String(value);
  },
  align: 'left',
};

export class CellTypeRegistry {
  private readonly renderers = new Map<CellType, CellTypeRenderer>();

  constructor() {
    // Register built-in types
    this.renderers.set('string', stringRenderer);
    this.renderers.set('number', numberRenderer);
    this.renderers.set('boolean', booleanRenderer);
    this.renderers.set('date', dateRenderer);
  }

  /** Get the renderer for a given cell type. Falls back to string renderer. */
  get(type: CellType): CellTypeRenderer {
    return this.renderers.get(type) ?? stringRenderer;
  }

  /** Register a custom cell type renderer. */
  register(type: CellType, renderer: CellTypeRenderer): void {
    this.renderers.set(type, renderer);
  }

  /**
   * Detect cell type from a raw value when column type is not specified.
   * Returns the CellType or 'string' as fallback.
   */
  detectType(value: CellValue): CellType {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'string';
  }
}
