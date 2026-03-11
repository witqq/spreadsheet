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

import type { CellType, CellValue, CellData } from './interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';

export type CellAlignment = 'left' | 'center' | 'right';

/** Position of a cell decorator relative to cell content. */
export type CellDecoratorPosition = 'left' | 'right' | 'overlay' | 'underlay';

/**
 * A composable rendering addon for cells. Decorators augment the default
 * text rendering pipeline without replacing it.
 *
 * - `left`/`right`: reserve horizontal space, shifting text inward.
 * - `overlay`: renders on top of text.
 * - `underlay`: renders behind text.
 */
export interface CellDecorator {
  /** Unique identifier for this decorator. */
  readonly id: string;
  /** Where the decorator renders relative to cell content. */
  readonly position: CellDecoratorPosition;
  /**
   * Compute reserved width in pixels for left/right decorators.
   * Ignored for overlay/underlay decorators.
   * The ctx parameter is optional — during hit testing no canvas is available.
   * Decorators with fixed widths can ignore ctx entirely.
   */
  getWidth?(
    cellData: CellData,
    cellHeight: number,
    ctx?: CanvasRenderingContext2D,
    theme?: SpreadsheetTheme,
    row?: number,
    col?: number,
  ): number;
  /** Render the decorator in its allocated area. */
  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: SpreadsheetTheme,
    row?: number,
    col?: number,
  ): void;
  /** Optional hit zones relative to the decorator's allocated area. */
  getHitZones?(
    width: number,
    height: number,
    cellData: CellData,
    row?: number,
    col?: number,
  ): HitZone[];
}

/**
 * Links a decorator to an applicability predicate that determines
 * which cells the decorator applies to.
 */
export interface CellDecoratorRegistration {
  /** The decorator instance. */
  decorator: CellDecorator;
  /** Returns true if this decorator should apply to the given cell. */
  appliesTo: (row: number, col: number, cellData: CellData) => boolean;
}

/** A rectangular interactive area within a cell for sub-cell hit testing. */
export interface HitZone {
  /** Unique identifier for this zone within the cell. */
  readonly id: string;
  /** X position relative to cell left edge in pixels. */
  readonly x: number;
  /** Y position relative to cell top edge in pixels. */
  readonly y: number;
  /** Zone width in pixels. */
  readonly width: number;
  /** Zone height in pixels. */
  readonly height: number;
  /** Optional CSS cursor style when hovering this zone. */
  readonly cursor?: string;
}

export interface CellTypeRenderer {
  /** Format a cell value for text display. */
  format(value: CellValue, cellData?: CellData, row?: number, col?: number): string;
  /** Text alignment for this cell type. */
  align: CellAlignment;
  /**
   * Optional custom canvas rendering. When provided, CellTextLayer
   * calls this instead of fillText. The renderer receives the complete
   * CellData and cell area coordinates (already adjusted for scroll offset).
   */
  render?: (
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    width: number,
    height: number,
    theme: SpreadsheetTheme,
    row?: number,
    col?: number,
  ) => void;
  /**
   * Optional height measurement for auto row sizing.
   * Returns the desired row height in pixels for a given cell,
   * considering the available column width and theme.
   * When not provided, the default row height is used.
   */
  measureHeight?: (
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    width: number,
    theme: SpreadsheetTheme,
    row?: number,
    col?: number,
  ) => number;
  /**
   * Optional sub-cell hit zones. Returns interactive zones within a cell
   * for sub-cell hit testing. Each zone has an ID, position/size relative
   * to the cell origin, and an optional cursor style.
   */
  getHitZones?: (
    cellData: CellData,
    width: number,
    height: number,
    theme?: SpreadsheetTheme,
    row?: number,
    col?: number,
  ) => HitZone[];
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
  render: (ctx, cellData, x, y, width, height, theme) => {
    const value = cellData.value;
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
  private readonly decoratorRegistrations: CellDecoratorRegistration[] = [];
  private formatLocale: string = 'en-US';

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

  /** Set the format locale for number and date renderers. */
  setFormatLocale(locale: string): void {
    this.formatLocale = locale;
    const loc = locale;
    this.renderers.set('number', {
      format: (value) => {
        if (value == null) return '';
        if (typeof value === 'number') return value.toLocaleString(loc);
        return String(value);
      },
      align: 'right',
    });
    this.renderers.set('date', {
      format: (value) => {
        if (value == null) return '';
        if (value instanceof Date) return value.toLocaleDateString(loc);
        if (typeof value === 'string') {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString(loc);
        }
        return String(value);
      },
      align: 'left',
    });
  }

  /** Get the current format locale. */
  getFormatLocale(): string {
    return this.formatLocale;
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

  /** Add a cell decorator with an applicability predicate. Replaces existing decorator with same ID. */
  addDecorator(registration: CellDecoratorRegistration): void {
    const existingIdx = this.decoratorRegistrations.findIndex(
      (r) => r.decorator.id === registration.decorator.id,
    );
    if (existingIdx >= 0) {
      this.decoratorRegistrations[existingIdx] = registration;
    } else {
      this.decoratorRegistrations.push(registration);
    }
  }

  /** Remove a decorator by its ID. */
  removeDecorator(id: string): void {
    const idx = this.decoratorRegistrations.findIndex((r) => r.decorator.id === id);
    if (idx >= 0) this.decoratorRegistrations.splice(idx, 1);
  }

  /** Get decorators applicable to a specific cell. */
  getDecorators(row: number, col: number, cellData: CellData): CellDecorator[] {
    return this.decoratorRegistrations
      .filter((r) => r.appliesTo(row, col, cellData))
      .map((r) => r.decorator);
  }
}
