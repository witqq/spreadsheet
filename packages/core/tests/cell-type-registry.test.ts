import { describe, it, expect, vi } from 'vitest';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { CellTypeRenderer } from '../src/types/cell-type-registry';
import { lightTheme } from '../src/themes/built-in-themes';

describe('CellTypeRegistry', () => {
  describe('built-in types', () => {
    it('has string, number, boolean, date registered by default', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('string')).toBeDefined();
      expect(registry.get('number')).toBeDefined();
      expect(registry.get('boolean')).toBeDefined();
      expect(registry.get('date')).toBeDefined();
    });

    it('falls back to string renderer for unknown types', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('custom');
      expect(renderer.align).toBe('left');
      expect(renderer.format('hello')).toBe('hello');
    });
  });

  describe('string renderer', () => {
    it('formats strings as-is', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('string');
      expect(renderer.format('hello')).toBe('hello');
    });

    it('converts numbers to string', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('string');
      expect(renderer.format(42)).toBe('42');
    });

    it('returns empty string for null', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('string');
      expect(renderer.format(null)).toBe('');
    });

    it('aligns left', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('string').align).toBe('left');
    });

    it('has no custom render function', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('string').render).toBeUndefined();
    });
  });

  describe('number renderer', () => {
    it('formats numbers with locale string', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      expect(renderer.format(1234567)).toBe('1,234,567');
    });

    it('formats small numbers without separator', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      expect(renderer.format(42)).toBe('42');
    });

    it('formats zero', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      expect(renderer.format(0)).toBe('0');
    });

    it('formats negative numbers', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      const formatted = renderer.format(-1234);
      // Locale formatting may vary; just check it contains the digits
      expect(formatted).toContain('1,234');
    });

    it('formats decimals', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      const formatted = renderer.format(3.14);
      expect(formatted).toContain('3.14');
    });

    it('returns empty string for null', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      expect(renderer.format(null)).toBe('');
    });

    it('converts non-number to string', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('number');
      expect(renderer.format('not a number')).toBe('not a number');
    });

    it('aligns right', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('number').align).toBe('right');
    });

    it('has no custom render function', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('number').render).toBeUndefined();
    });
  });

  describe('boolean renderer', () => {
    it('formats true as "true"', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('boolean');
      expect(renderer.format(true)).toBe('true');
    });

    it('formats false as "false"', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('boolean');
      expect(renderer.format(false)).toBe('false');
    });

    it('returns empty string for null', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('boolean');
      expect(renderer.format(null)).toBe('');
    });

    it('aligns center', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('boolean').align).toBe('center');
    });

    it('has custom render function for checkbox', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('boolean').render).toBeTypeOf('function');
    });

    it('render draws checkbox for true (calls stroke)', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('boolean');
      const ctx = {
        strokeStyle: '',
        lineWidth: 0,
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      renderer.render!(ctx, true, 10, 10, 60, 28, lightTheme);

      expect(ctx.strokeRect).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled(); // checkmark drawn
    });

    it('render draws empty checkbox for false (no stroke for checkmark)', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('boolean');
      const ctx = {
        strokeStyle: '',
        lineWidth: 0,
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      renderer.render!(ctx, false, 10, 10, 60, 28, lightTheme);

      expect(ctx.strokeRect).toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled(); // no checkmark
    });
  });

  describe('date renderer', () => {
    it('formats Date object as locale date string', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('date');
      const date = new Date(2025, 0, 15); // Jan 15, 2025
      const formatted = renderer.format(date);
      expect(formatted).toContain('2025');
      expect(formatted).toContain('15');
    });

    it('formats date string by parsing', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('date');
      const formatted = renderer.format('2025-06-15');
      expect(formatted).toContain('2025');
      expect(formatted).toContain('15');
    });

    it('returns original string for unparseable date', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('date');
      expect(renderer.format('not-a-date')).toBe('not-a-date');
    });

    it('returns empty string for null', () => {
      const registry = new CellTypeRegistry();
      const renderer = registry.get('date');
      expect(renderer.format(null)).toBe('');
    });

    it('aligns left', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('date').align).toBe('left');
    });

    it('has no custom render function', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('date').render).toBeUndefined();
    });
  });

  describe('detectType', () => {
    it('detects number', () => {
      const registry = new CellTypeRegistry();
      expect(registry.detectType(42)).toBe('number');
    });

    it('detects boolean', () => {
      const registry = new CellTypeRegistry();
      expect(registry.detectType(true)).toBe('boolean');
    });

    it('detects Date', () => {
      const registry = new CellTypeRegistry();
      expect(registry.detectType(new Date())).toBe('date');
    });

    it('detects string as fallback', () => {
      const registry = new CellTypeRegistry();
      expect(registry.detectType('hello')).toBe('string');
    });

    it('detects null as string', () => {
      const registry = new CellTypeRegistry();
      expect(registry.detectType(null)).toBe('string');
    });
  });

  describe('register', () => {
    it('registers custom type renderer', () => {
      const registry = new CellTypeRegistry();
      const customRenderer: CellTypeRenderer = {
        format: (v) => `[${v}]`,
        align: 'center',
      };
      registry.register('custom', customRenderer);
      expect(registry.get('custom')).toBe(customRenderer);
      expect(registry.get('custom').format('test')).toBe('[test]');
    });

    it('overrides existing type renderer', () => {
      const registry = new CellTypeRegistry();
      const customNumber: CellTypeRenderer = {
        format: (v) => `$${v}`,
        align: 'right',
      };
      registry.register('number', customNumber);
      expect(registry.get('number').format(42)).toBe('$42');
    });
  });
});
