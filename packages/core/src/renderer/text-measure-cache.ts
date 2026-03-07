// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * TextMeasureCache — caches ctx.measureText() results keyed by font + text.
 *
 * Avoids redundant text measurement during rendering. Uses Map for O(1) lookups.
 * LRU eviction prevents unbounded memory growth: when the cache reaches maxSize,
 * the oldest half is evicted (Map iteration order = insertion order).
 */

import { LINE_HEIGHT_MULTIPLIER } from '../constants';

export class TextMeasureCache {
  private readonly cache = new Map<string, number>();
  private readonly wrapCache = new Map<string, string[]>();
  private readonly emHeightCache = new Map<string, number>();
  private readonly maxSize: number;

  constructor(maxSize: number = 10_000) {
    this.maxSize = maxSize;
  }

  /**
   * Measure text width, returning cached value when available.
   * Sets ctx.font before measuring to ensure correct measurement.
   * Promotes accessed entries to end of Map for LRU ordering.
   */
  measureText(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    const key = `${font}\0${text}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      // Move to end for LRU ordering
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    ctx.font = font;
    const width = ctx.measureText(text).width;

    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, width);
    return width;
  }

  /**
   * Measure the em-height of a font (approximation of line height).
   * Uses actualBoundingBoxAscent + actualBoundingBoxDescent when available,
   * falls back to measuring 'M' width as rough em-height.
   */
  measureEmHeight(ctx: CanvasRenderingContext2D, font: string): number {
    const cached = this.emHeightCache.get(font);
    if (cached !== undefined) return cached;

    ctx.font = font;
    const metrics = ctx.measureText('Mg');
    let height: number;

    if (
      typeof metrics.actualBoundingBoxAscent === 'number' &&
      typeof metrics.actualBoundingBoxDescent === 'number'
    ) {
      height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    } else {
      // Fallback: parse font size from font string
      const match = font.match(/(\d+(?:\.\d+)?)\s*px/);
      height = match ? parseFloat(match[1]) : 16;
    }

    this.emHeightCache.set(font, height);
    return height;
  }

  /**
   * Split text into wrapped lines for a given maxWidth.
   * Uses word-boundary splitting with character-level fallback for long words.
   * This is the single source of truth for line splitting — used by both
   * measurement and rendering to maintain the measure-render duality invariant.
   */
  getWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    maxWidth: number,
  ): string[] {
    if (!text || maxWidth <= 0) return [''];

    const wrapKey = `${font}\0${text}\0${maxWidth}`;
    const cached = this.wrapCache.get(wrapKey);
    if (cached !== undefined) return cached;

    const lines: string[] = [];
    // Split on explicit newlines first
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(/(\s+)/); // keep whitespace tokens
      let currentLine = '';

      for (const token of words) {
        if (token === '') continue;

        const testLine = currentLine + token;
        const testWidth = this.measureText(ctx, testLine, font);

        if (testWidth <= maxWidth || currentLine === '') {
          // Fits, or first token on line (must accept it)
          if (currentLine === '' && testWidth > maxWidth) {
            // Single token wider than maxWidth — character-level fallback
            const charLines = this.splitByCharacters(ctx, token, font, maxWidth);
            for (let i = 0; i < charLines.length; i++) {
              if (i < charLines.length - 1) {
                lines.push(charLines[i]);
              } else {
                currentLine = charLines[i];
              }
            }
          } else {
            currentLine = testLine;
          }
        } else {
          // Doesn't fit — wrap to next line
          lines.push(currentLine);
          // If the new token itself is wider than maxWidth, split it
          const tokenWidth = this.measureText(ctx, token.trimStart(), font);
          if (tokenWidth > maxWidth) {
            const charLines = this.splitByCharacters(ctx, token.trimStart(), font, maxWidth);
            for (let i = 0; i < charLines.length; i++) {
              if (i < charLines.length - 1) {
                lines.push(charLines[i]);
              } else {
                currentLine = charLines[i];
              }
            }
          } else {
            currentLine = token.trimStart();
          }
        }
      }

      lines.push(currentLine);
    }

    // Evict oldest entries from wrap cache
    if (this.wrapCache.size >= this.maxSize) {
      const evictCount = Math.max(1, this.maxSize >> 1);
      let count = 0;
      for (const key of this.wrapCache.keys()) {
        if (count >= evictCount) break;
        this.wrapCache.delete(key);
        count++;
      }
    }

    this.wrapCache.set(wrapKey, lines);
    return lines;
  }

  /**
   * Count how many wrapped lines text would produce at a given maxWidth.
   */
  countWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    maxWidth: number,
  ): number {
    return this.getWrappedLines(ctx, text, font, maxWidth).length;
  }

  /**
   * Compute total pixel height for wrapped text including padding.
   * lineHeight is expressed as a multiplier of em-height (e.g. 1.2).
   */
  measureWrappedHeight(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    maxWidth: number,
    lineHeight: number = LINE_HEIGHT_MULTIPLIER,
    padding?: { top: number; bottom: number },
  ): number {
    const lineCount = this.countWrappedLines(ctx, text, font, maxWidth);
    const emHeight = this.measureEmHeight(ctx, font);
    const lineHeightPx = emHeight * lineHeight;
    const textHeight = lineCount * lineHeightPx;
    const paddingTop = padding?.top ?? 0;
    const paddingBottom = padding?.bottom ?? 0;
    return textHeight + paddingTop + paddingBottom;
  }

  /**
   * Truncate text to fit within maxWidth, appending ellipsis if needed.
   * Returns the original text if it fits, or truncated text + "…".
   */
  truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: string,
    maxWidth: number,
  ): string {
    if (maxWidth <= 0) return '';

    const fullWidth = this.measureText(ctx, text, font);
    if (fullWidth <= maxWidth) return text;

    const ellipsis = '\u2026'; // …
    const ellipsisWidth = this.measureText(ctx, ellipsis, font);

    if (ellipsisWidth > maxWidth) return '';

    const availableWidth = maxWidth - ellipsisWidth;

    // Binary search for maximum characters that fit
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const substr = text.substring(0, mid);
      const w = this.measureText(ctx, substr, font);
      if (w <= availableWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    if (lo === 0) return ellipsis;
    return text.substring(0, lo) + ellipsis;
  }

  clear(): void {
    this.cache.clear();
    this.wrapCache.clear();
    this.emHeightCache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  /** Evict oldest half of entries (first entries in Map iteration order). */
  private evict(): void {
    const evictCount = Math.max(1, this.maxSize >> 1);
    let count = 0;
    for (const key of this.cache.keys()) {
      if (count >= evictCount) break;
      this.cache.delete(key);
      count++;
    }
  }

  /** Split a long word into lines by characters when it exceeds maxWidth. */
  private splitByCharacters(
    ctx: CanvasRenderingContext2D,
    word: string,
    font: string,
    maxWidth: number,
  ): string[] {
    const result: string[] = [];
    let current = '';
    for (const char of word) {
      const test = current + char;
      if (this.measureText(ctx, test, font) > maxWidth && current !== '') {
        result.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current) result.push(current);
    return result.length > 0 ? result : [''];
  }
}
