import { describe, it, expect, vi } from 'vitest';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { CellTypeRenderer } from '../src/types/cell-type-registry';
import type { CellData } from '../src/types/interfaces';
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

      renderer.render!(ctx, { value: true }, 10, 10, 60, 28, lightTheme);

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

      renderer.render!(ctx, { value: false }, 10, 10, 60, 28, lightTheme);

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

    it('registers custom renderer with measureHeight', () => {
      const registry = new CellTypeRegistry();
      const customRenderer: CellTypeRenderer = {
        format: (v) => String(v),
        align: 'left',
        measureHeight: (_ctx, _cellData, width, _theme) => {
          // Example: simulate height based on text that fills width
          return width > 100 ? 28 : 56;
        },
      };
      registry.register('custom', customRenderer);
      const renderer = registry.get('custom');
      expect(renderer.measureHeight).toBeTypeOf('function');

      const ctx = {} as CanvasRenderingContext2D;
      const theme = lightTheme;
      expect(renderer.measureHeight!(ctx, { value: 'test' }, 200, theme)).toBe(28);
      expect(renderer.measureHeight!(ctx, { value: 'test' }, 50, theme)).toBe(56);
    });

    it('built-in renderers do not have measureHeight', () => {
      const registry = new CellTypeRegistry();
      expect(registry.get('string').measureHeight).toBeUndefined();
      expect(registry.get('number').measureHeight).toBeUndefined();
      expect(registry.get('boolean').measureHeight).toBeUndefined();
      expect(registry.get('date').measureHeight).toBeUndefined();
    });
  });

  describe('setFormatLocale', () => {
    it('defaults to en-US format locale', () => {
      const registry = new CellTypeRegistry();
      expect(registry.getFormatLocale()).toBe('en-US');
    });

    it('changes number formatting to specified locale', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('de-DE');
      expect(registry.getFormatLocale()).toBe('de-DE');
      const formatted = registry.get('number').format(1234.56);
      // German locale uses comma for decimal
      expect(formatted).toContain(',');
    });

    it('changes date formatting to specified locale', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('ru-RU');
      const date = new Date(2025, 0, 15);
      const formatted = registry.get('date').format(date);
      // Russian date format: DD.MM.YYYY
      expect(formatted).toContain('15');
    });

    it('preserves number renderer alignment after locale change', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('fr-FR');
      expect(registry.get('number').align).toBe('right');
    });

    it('preserves date renderer alignment after locale change', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('ja-JP');
      expect(registry.get('date').align).toBe('left');
    });

    it('handles null/undefined values after locale change', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('ru-RU');
      expect(registry.get('number').format(null)).toBe('');
      expect(registry.get('number').format(undefined)).toBe('');
      expect(registry.get('date').format(null)).toBe('');
      expect(registry.get('date').format(undefined)).toBe('');
    });

    it('formats string dates with new locale', () => {
      const registry = new CellTypeRegistry();
      registry.setFormatLocale('en-GB');
      const formatted = registry.get('date').format('2025-01-15');
      expect(formatted).toContain('15');
    });

    it('does not affect string and boolean renderers', () => {
      const registry = new CellTypeRegistry();
      const strBefore = registry.get('string').format('test');
      const boolBefore = registry.get('boolean').format(true);
      registry.setFormatLocale('ja-JP');
      expect(registry.get('string').format('test')).toBe(strBefore);
      expect(registry.get('boolean').format(true)).toBe(boolBefore);
    });
  });

  describe('CellTypeRenderer receives CellData and row/col', () => {
    it('format() receives optional cellData, row, col', () => {
      const registry = new CellTypeRegistry();
      const received: { cellData?: CellData; row?: number; col?: number } = {};
      const custom: CellTypeRenderer = {
        format: (v, cellData, row, col) => {
          received.cellData = cellData;
          received.row = row;
          received.col = col;
          return String(v);
        },
        align: 'left',
      };
      registry.register('custom', custom);
      const data: CellData = { value: 'hello', custom: { tag: 'a' } };
      registry.get('custom').format(data.value, data, 5, 3);
      expect(received.cellData).toBe(data);
      expect(received.row).toBe(5);
      expect(received.col).toBe(3);
    });

    it('render() receives CellData instead of CellValue', () => {
      const registry = new CellTypeRegistry();
      const received: { cellData?: CellData; row?: number; col?: number } = {};
      const custom: CellTypeRenderer = {
        format: (v) => String(v),
        align: 'left',
        render: (_ctx, cellData, _x, _y, _w, _h, _theme, row, col) => {
          received.cellData = cellData;
          received.row = row;
          received.col = col;
        },
      };
      registry.register('custom', custom);
      const ctx = {} as CanvasRenderingContext2D;
      const data: CellData = { value: 42, custom: { flag: true } };
      registry.get('custom').render!(ctx, data, 0, 0, 100, 28, lightTheme, 10, 2);
      expect(received.cellData).toBe(data);
      expect(received.cellData!.custom).toEqual({ flag: true });
      expect(received.row).toBe(10);
      expect(received.col).toBe(2);
    });

    it('measureHeight() receives CellData instead of CellValue', () => {
      const registry = new CellTypeRegistry();
      const received: { cellData?: CellData; row?: number; col?: number } = {};
      const custom: CellTypeRenderer = {
        format: (v) => String(v),
        align: 'left',
        measureHeight: (_ctx, cellData, _w, _theme, row, col) => {
          received.cellData = cellData;
          received.row = row;
          received.col = col;
          return 40;
        },
      };
      registry.register('custom', custom);
      const ctx = {} as CanvasRenderingContext2D;
      const data: CellData = { value: 'text' };
      const h = registry.get('custom').measureHeight!(ctx, data, 100, lightTheme, 7, 1);
      expect(h).toBe(40);
      expect(received.cellData).toBe(data);
      expect(received.row).toBe(7);
      expect(received.col).toBe(1);
    });

    it('getHitZones() receives CellData instead of CellValue', () => {
      const registry = new CellTypeRegistry();
      const received: { cellData?: CellData; row?: number; col?: number } = {};
      const custom: CellTypeRenderer = {
        format: (v) => String(v),
        align: 'center',
        getHitZones: (cellData, _w, _h, _theme, row, col) => {
          received.cellData = cellData;
          received.row = row;
          received.col = col;
          return [{ id: 'zone1', x: 0, y: 0, width: 10, height: 10 }];
        },
      };
      registry.register('custom', custom);
      const data: CellData = { value: true, custom: { extra: 1 } };
      const zones = registry.get('custom').getHitZones!(data, 80, 28, lightTheme, 3, 5);
      expect(zones).toHaveLength(1);
      expect(zones[0].id).toBe('zone1');
      expect(received.cellData).toBe(data);
      expect(received.row).toBe(3);
      expect(received.col).toBe(5);
    });

    it('boolean renderer render() works with CellData', () => {
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

      renderer.render!(ctx, { value: true }, 10, 10, 60, 28, lightTheme, 0, 0);
      expect(ctx.strokeRect).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});
