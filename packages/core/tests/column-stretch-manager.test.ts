// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi } from 'vitest';
import {
  ColumnStretchManager,
  type ColumnStretchConfig,
} from '../src/resize/column-stretch-manager';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(widths: number[], options?: Partial<ColumnDef>[]): ColumnDef[] {
  return widths.map((w, i) => ({
    key: `col${i}`,
    title: `Col ${i}`,
    width: w,
    ...(options?.[i] ?? {}),
  }));
}

function makeWidthGetter(widths: number[]) {
  return (colIndex: number) => widths[colIndex] ?? 0;
}

describe('ColumnStretchManager', () => {
  describe('mode: last', () => {
    it('should give all extra space to last column', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([100, 100, 100]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([100, 100, 100]));

      expect(result).not.toBeNull();
      expect(result!.size).toBe(1);
      // Last visible column (index 2) gets 500 - 300 = 200 extra → 100 + 200 = 300
      expect(result!.get(2)).toBe(300);
    });

    it('should return null when columns fill container', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([200, 200, 200]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([200, 200, 200]));

      expect(result).toBeNull();
    });

    it('should return null when columns exceed container', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([300, 300]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([300, 300]));

      expect(result).toBeNull();
    });

    it('should skip hidden columns', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([100, 100, 100], [
        {},
        { hidden: true },
        {},
      ]);
      // Only 2 visible columns (indices 0 and 2)
      const result = mgr.calculate(cols, 400, 0, makeWidthGetter([100, 100]));

      expect(result).not.toBeNull();
      // Last visible index is 1 (second visible col)
      expect(result!.get(1)).toBe(300);
    });

    it('should return null for zero container width', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([100]);
      const result = mgr.calculate(cols, 0, 0, makeWidthGetter([100]));

      expect(result).toBeNull();
    });
  });

  describe('mode: all', () => {
    it('should distribute extra space evenly', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100, 100]);
      const result = mgr.calculate(cols, 600, 0, makeWidthGetter([100, 100, 100]));

      expect(result).not.toBeNull();
      expect(result!.size).toBe(3);
      // 600 - 300 = 300 extra, 300/3 = 100 per col → 100+100 = 200 each
      expect(result!.get(0)).toBe(200);
      expect(result!.get(1)).toBe(200);
      expect(result!.get(2)).toBe(200);
    });

    it('should exclude frozen columns from stretch', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100, 100]);
      // First column is frozen
      const result = mgr.calculate(cols, 500, 1, makeWidthGetter([100, 100, 100]));

      expect(result).not.toBeNull();
      // 500 - 300 = 200 extra, 2 stretchable cols → 100 each
      expect(result!.has(0)).toBe(false);
      expect(result!.get(1)).toBe(200);
      expect(result!.get(2)).toBe(200);
    });

    it('should exclude manually resized columns from stretch', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100, 100]);

      mgr.markManualResize(1);
      const result = mgr.calculate(cols, 600, 0, makeWidthGetter([100, 100, 100]));

      expect(result).not.toBeNull();
      // 600 - 300 = 300 extra, 2 stretchable cols → 150 each
      expect(result!.has(1)).toBe(false);
      expect(result!.get(0)).toBe(250);
      expect(result!.get(2)).toBe(250);
    });

    it('should respect col.frozen property', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100, 100], [{ frozen: true }, {}, {}]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([100, 100, 100]));

      expect(result).not.toBeNull();
      expect(result!.has(0)).toBe(false);
      expect(result!.get(1)).toBe(200);
      expect(result!.get(2)).toBe(200);
    });

    it('should fall back to last mode when all columns are frozen/manual', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100]);

      mgr.markManualResize(0);
      mgr.markManualResize(1);
      const result = mgr.calculate(cols, 400, 0, makeWidthGetter([100, 100]));

      expect(result).not.toBeNull();
      // Falls back to last mode: last col gets all extra
      expect(result!.get(1)).toBe(300);
    });

    it('should respect minWidth from ColumnDef', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([10, 10, 10], [
        { minWidth: 50 },
        { minWidth: 50 },
        { minWidth: 50 },
      ]);
      // 10 + 10 + 10 = 30, container = 35, extra = 5, per col = 1.67
      // 10 + 1.67 < 50 → clamped to 50
      const result = mgr.calculate(cols, 35, 0, makeWidthGetter([10, 10, 10]));

      expect(result).not.toBeNull();
      for (const [, width] of result!) {
        expect(width).toBeGreaterThanOrEqual(50);
      }
    });

    it('should use default minWidth of 30 when not specified', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([5, 5, 5]);
      // 5 + 5 + 5 = 15, container = 16, extra = 1, per col = 0.33
      // 5 + 0.33 < 30 → clamped to 30
      const result = mgr.calculate(cols, 16, 0, makeWidthGetter([5, 5, 5]));

      expect(result).not.toBeNull();
      for (const [, width] of result!) {
        expect(width).toBeGreaterThanOrEqual(30);
      }
    });
  });

  describe('recalculate()', () => {
    it('should call applyWidths with calculated updates', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([100, 100]);

      mgr.recalculate(cols, 400, 0, makeWidthGetter([100, 100]));

      expect(applyCb).toHaveBeenCalledTimes(1);
      const updates = applyCb.mock.calls[0][0] as Map<number, number>;
      expect(updates.get(1)).toBe(300);
    });

    it('should not call applyWidths when no stretch needed', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([200, 200]);

      mgr.recalculate(cols, 300, 0, makeWidthGetter([200, 200]));

      expect(applyCb).not.toHaveBeenCalled();
    });
  });

  describe('clearManualResizes()', () => {
    it('should restore columns as stretchable after clear', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100]);

      mgr.markManualResize(0);
      let result = mgr.calculate(cols, 400, 0, makeWidthGetter([100, 100]));
      expect(result!.has(0)).toBe(false);

      mgr.clearManualResizes();
      result = mgr.calculate(cols, 400, 0, makeWidthGetter([100, 100]));
      expect(result!.has(0)).toBe(true);
      expect(result!.has(1)).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('should return null after destroy', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'last' }, applyCb);
      const cols = makeColumns([100]);

      mgr.destroy();
      expect(mgr.isDestroyed).toBe(true);

      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([100]));
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty columns array', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const result = mgr.calculate([], 500, 0, makeWidthGetter([]));
      expect(result).toBeNull();
    });

    it('should handle all columns hidden', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100, 100], [{ hidden: true }, { hidden: true }]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([]));
      expect(result).toBeNull();
    });

    it('should handle single column in all mode', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100]);
      const result = mgr.calculate(cols, 500, 0, makeWidthGetter([100]));

      expect(result).not.toBeNull();
      expect(result!.get(0)).toBe(500);
    });

    it('should handle negative container width', () => {
      const applyCb = vi.fn();
      const mgr = new ColumnStretchManager({ mode: 'all' }, applyCb);
      const cols = makeColumns([100]);
      const result = mgr.calculate(cols, -10, 0, makeWidthGetter([100]));
      expect(result).toBeNull();
    });
  });
});
