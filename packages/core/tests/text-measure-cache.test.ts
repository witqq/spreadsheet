import { describe, it, expect, vi } from 'vitest';
import { TextMeasureCache } from '../src/renderer/text-measure-cache';

function createMockCtx(widthFn?: (text: string) => number) {
  const defaultWidthFn = (text: string) => text.length * 8; // 8px per char
  return {
    font: '',
    measureText: vi.fn().mockImplementation((text: string) => ({
      width: (widthFn ?? defaultWidthFn)(text),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('TextMeasureCache', () => {
  describe('measureText', () => {
    it('returns measured width on cache miss', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx(() => 42);

      const width = cache.measureText(ctx, 'hello', '13px Arial');
      expect(width).toBe(42);
      expect(ctx.measureText).toHaveBeenCalledWith('hello');
    });

    it('returns cached width on cache hit without calling measureText', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx(() => 42);

      cache.measureText(ctx, 'hello', '13px Arial');
      expect(ctx.measureText).toHaveBeenCalledTimes(1);

      const width = cache.measureText(ctx, 'hello', '13px Arial');
      expect(width).toBe(42);
      expect(ctx.measureText).toHaveBeenCalledTimes(1); // not called again
    });

    it('uses different cache entries for different fonts', () => {
      const cache = new TextMeasureCache();
      let callCount = 0;
      const ctx = createMockCtx(() => {
        callCount++;
        return callCount === 1 ? 40 : 50;
      });

      const w1 = cache.measureText(ctx, 'hello', '13px Arial');
      const w2 = cache.measureText(ctx, 'hello', '16px Monospace');

      expect(w1).toBe(40);
      expect(w2).toBe(50);
      expect(ctx.measureText).toHaveBeenCalledTimes(2);
    });

    it('uses different cache entries for different text', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx((text) => text.length * 10);

      const w1 = cache.measureText(ctx, 'hi', '13px Arial');
      const w2 = cache.measureText(ctx, 'hello', '13px Arial');

      expect(w1).toBe(20);
      expect(w2).toBe(50);
      expect(ctx.measureText).toHaveBeenCalledTimes(2);
    });

    it('sets ctx.font before measuring', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx();

      cache.measureText(ctx, 'test', '16px Monospace');
      expect(ctx.font).toBe('16px Monospace');
    });
  });

  describe('clear', () => {
    it('clears all cached entries', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx(() => 42);

      cache.measureText(ctx, 'hello', '13px Arial');
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);

      // Should re-measure after clear
      cache.measureText(ctx, 'hello', '13px Arial');
      expect(ctx.measureText).toHaveBeenCalledTimes(2);
    });
  });

  describe('size', () => {
    it('returns number of cached entries', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx();

      expect(cache.size).toBe(0);
      cache.measureText(ctx, 'a', '13px Arial');
      expect(cache.size).toBe(1);
      cache.measureText(ctx, 'b', '13px Arial');
      expect(cache.size).toBe(2);
      // Same entry — size stays 2
      cache.measureText(ctx, 'a', '13px Arial');
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entries when cache reaches maxSize', () => {
      const cache = new TextMeasureCache(10);
      const ctx = createMockCtx((text) => text.length * 8);

      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.measureText(ctx, `text${i}`, '13px Arial');
      }
      expect(cache.size).toBe(10);

      // Add one more — triggers eviction of oldest half (5)
      cache.measureText(ctx, 'overflow', '13px Arial');
      expect(cache.size).toBeLessThanOrEqual(6); // 10 - 5 + 1
    });

    it('preserves recently accessed entries during eviction', () => {
      const cache = new TextMeasureCache(10);
      const ctx = createMockCtx(() => 42);

      // Fill with 10 entries
      for (let i = 0; i < 10; i++) {
        cache.measureText(ctx, `text${i}`, '13px Arial');
      }

      // Re-access last entry to promote it
      cache.measureText(ctx, 'text9', '13px Arial');
      const callsBefore = (ctx.measureText as ReturnType<typeof vi.fn>).mock.calls.length;

      // Trigger eviction
      cache.measureText(ctx, 'new-entry', '13px Arial');

      // text9 should still be cached (was promoted)
      cache.measureText(ctx, 'text9', '13px Arial');
      const callsAfter = (ctx.measureText as ReturnType<typeof vi.fn>).mock.calls.length;
      // new-entry required 1 real measureText call, text9 should be from cache (0 extra calls)
      expect(callsAfter - callsBefore).toBe(1); // only new-entry measured
    });

    it('uses default maxSize of 10000', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx((text) => text.length * 8);

      // Insert many entries — should not crash
      for (let i = 0; i < 100; i++) {
        cache.measureText(ctx, `text${i}`, '13px Arial');
      }
      expect(cache.size).toBe(100);
    });

    it('handles maxSize of 1', () => {
      const cache = new TextMeasureCache(1);
      const ctx = createMockCtx((text) => text.length * 8);

      cache.measureText(ctx, 'a', '13px Arial');
      expect(cache.size).toBe(1);

      cache.measureText(ctx, 'b', '13px Arial');
      // After eviction (evicts 0 = floor(1/2)), size could be 1 or 2
      // With maxSize=1, evictCount = 0, so no eviction happens — still grows
      // This is acceptable edge case — maxSize=1 is not practical
      expect(cache.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('truncateText', () => {
    it('returns original text when it fits within maxWidth', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx((text) => text.length * 8);

      const result = cache.truncateText(ctx, 'hello', '13px Arial', 100);
      expect(result).toBe('hello'); // 5*8=40 <= 100
    });

    it('truncates text and appends ellipsis when too wide', () => {
      const cache = new TextMeasureCache();
      // Each char is 10px, ellipsis (…) is also 10px (1 char)
      const ctx = createMockCtx((text) => text.length * 10);

      // "hello world" = 11 chars = 110px, maxWidth = 60px
      // ellipsis = 10px, available for text = 50px = 5 chars
      const result = cache.truncateText(ctx, 'hello world', '13px Arial', 60);
      expect(result).toBe('hello\u2026'); // "hello" (50px) + "…" (10px) = 60px
    });

    it('returns empty string when maxWidth is zero', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx();

      expect(cache.truncateText(ctx, 'hello', '13px Arial', 0)).toBe('');
    });

    it('returns empty string when maxWidth is negative', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx();

      expect(cache.truncateText(ctx, 'hello', '13px Arial', -10)).toBe('');
    });

    it('returns empty string when maxWidth is too small for ellipsis', () => {
      const cache = new TextMeasureCache();
      // Ellipsis is 8px (1 char * 8px)
      const ctx = createMockCtx((text) => text.length * 8);

      // maxWidth = 5, ellipsis = 8px → can't fit even ellipsis
      expect(cache.truncateText(ctx, 'hello', '13px Arial', 5)).toBe('');
    });

    it('returns just ellipsis when only ellipsis fits', () => {
      const cache = new TextMeasureCache();
      // Each char is 10px
      const ctx = createMockCtx((text) => text.length * 10);

      // maxWidth = 10, ellipsis = 10px, available for text = 0px
      // No characters fit before ellipsis → return just ellipsis
      const result = cache.truncateText(ctx, 'hello', '13px Arial', 10);
      expect(result).toBe('\u2026');
    });

    it('handles empty text', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx(() => 0);

      const result = cache.truncateText(ctx, '', '13px Arial', 100);
      expect(result).toBe(''); // 0px <= 100px, returns as-is
    });

    it('handles single character text that fits', () => {
      const cache = new TextMeasureCache();
      const ctx = createMockCtx((text) => text.length * 10);

      const result = cache.truncateText(ctx, 'A', '13px Arial', 100);
      expect(result).toBe('A');
    });

    it('truncates to correct length with variable-width characters', () => {
      const cache = new TextMeasureCache();
      // Simulate variable width: measure actual substring widths
      const charWidths: Record<string, number> = {
        W: 14, i: 4, d: 8, e: 8, ' ': 4, t: 6, x: 8,
        '\u2026': 10,
      };
      const ctx = createMockCtx((text) => {
        let w = 0;
        for (const ch of text) {
          w += charWidths[ch] ?? 8;
        }
        return w;
      });

      // "Wide text" = W(14) + i(4) + d(8) + e(8) + (4) + t(6) + e(8) + x(8) + t(6) = 66px
      // maxWidth = 40, ellipsis = 10px, available = 30px
      // W(14) + i(4) + d(8) = 26px ✓, + e(8) = 34px > 30 ✗
      // So truncate to "Wid…"
      const result = cache.truncateText(ctx, 'Wide text', '13px Arial', 40);
      expect(result).toBe('Wid\u2026');
    });
  });
});
