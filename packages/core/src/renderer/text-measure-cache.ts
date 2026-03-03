// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * TextMeasureCache — caches ctx.measureText() results keyed by font + text.
 *
 * Avoids redundant text measurement during rendering. Uses Map for O(1) lookups.
 * LRU eviction prevents unbounded memory growth: when the cache reaches maxSize,
 * the oldest half is evicted (Map iteration order = insertion order).
 */

export class TextMeasureCache {
  private readonly cache = new Map<string, number>();
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
}
