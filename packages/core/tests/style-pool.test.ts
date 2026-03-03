import { describe, it, expect } from 'vitest';
import { StylePool } from '../src/model/style-pool';
import type { CellStyle } from '../src/types/interfaces';

describe('StylePool', () => {
  describe('empty pool', () => {
    it('has size 0', () => {
      const pool = new StylePool();
      expect(pool.size).toBe(0);
    });

    it('resolve returns undefined for unknown ref', () => {
      const pool = new StylePool();
      expect(pool.resolve('nonexistent')).toBeUndefined();
    });

    it('has returns false for unknown ref', () => {
      const pool = new StylePool();
      expect(pool.has('nonexistent')).toBe(false);
    });
  });

  describe('intern and resolve', () => {
    it('interns a style and returns a ref', () => {
      const pool = new StylePool();
      const style: CellStyle = { bgColor: '#fff', textColor: '#000' };
      const ref = pool.intern(style);
      expect(typeof ref).toBe('string');
      expect(ref.length).toBeGreaterThan(0);
      expect(pool.size).toBe(1);
    });

    it('resolves a ref back to the style', () => {
      const pool = new StylePool();
      const style: CellStyle = { bgColor: '#fff', fontSize: 14 };
      const ref = pool.intern(style);
      const resolved = pool.resolve(ref);
      expect(resolved).toEqual(style);
    });

    it('has returns true for interned ref', () => {
      const pool = new StylePool();
      const ref = pool.intern({ bgColor: '#fff' });
      expect(pool.has(ref)).toBe(true);
    });

    it('returned style is frozen (immutable)', () => {
      const pool = new StylePool();
      const ref = pool.intern({ bgColor: '#fff' });
      const resolved = pool.resolve(ref)!;
      expect(Object.isFrozen(resolved)).toBe(true);
    });
  });

  describe('deduplication', () => {
    it('returns same ref for identical styles', () => {
      const pool = new StylePool();
      const ref1 = pool.intern({ bgColor: '#fff', textColor: '#000' });
      const ref2 = pool.intern({ bgColor: '#fff', textColor: '#000' });
      expect(ref1).toBe(ref2);
      expect(pool.size).toBe(1);
    });

    it('deduplicates regardless of property order', () => {
      const pool = new StylePool();
      const ref1 = pool.intern({ bgColor: '#fff', textColor: '#000' });
      const ref2 = pool.intern({ textColor: '#000', bgColor: '#fff' });
      expect(ref1).toBe(ref2);
      expect(pool.size).toBe(1);
    });

    it('different styles get different refs', () => {
      const pool = new StylePool();
      const ref1 = pool.intern({ bgColor: '#fff' });
      const ref2 = pool.intern({ bgColor: '#000' });
      expect(ref1).not.toBe(ref2);
      expect(pool.size).toBe(2);
    });

    it('deduplicates styles with borders', () => {
      const pool = new StylePool();
      const style: CellStyle = {
        borderTop: { width: 1, color: '#000', style: 'solid' },
        bgColor: '#fff',
      };
      const ref1 = pool.intern(style);
      const ref2 = pool.intern({
        bgColor: '#fff',
        borderTop: { width: 1, color: '#000', style: 'solid' },
      });
      expect(ref1).toBe(ref2);
      expect(pool.size).toBe(1);
    });

    it('distinguishes styles with different border properties', () => {
      const pool = new StylePool();
      const ref1 = pool.intern({
        borderTop: { width: 1, color: '#000', style: 'solid' },
      });
      const ref2 = pool.intern({
        borderTop: { width: 2, color: '#000', style: 'solid' },
      });
      expect(ref1).not.toBe(ref2);
      expect(pool.size).toBe(2);
    });

    it('does not mutate the original input style', () => {
      const pool = new StylePool();
      const style: CellStyle = { bgColor: '#fff', textColor: '#000' };
      pool.intern(style);
      // Input should not be frozen
      expect(Object.isFrozen(style)).toBe(false);
    });
  });

  describe('complex styles', () => {
    it('handles style with all properties', () => {
      const pool = new StylePool();
      const style: CellStyle = {
        bgColor: '#ffffff',
        textColor: '#000000',
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 'bold',
        fontStyle: 'italic',
        textAlign: 'center',
        verticalAlign: 'middle',
        borderTop: { width: 1, color: '#ccc', style: 'solid' },
        borderRight: { width: 1, color: '#ccc', style: 'dashed' },
        borderBottom: { width: 2, color: '#000', style: 'solid' },
        borderLeft: { width: 1, color: '#ccc', style: 'dotted' },
        numberFormat: '#,##0.00',
        textWrap: true,
        indent: 2,
      };
      const ref = pool.intern(style);
      const resolved = pool.resolve(ref);
      expect(resolved).toEqual(style);
    });

    it('handles empty style', () => {
      const pool = new StylePool();
      const ref = pool.intern({});
      expect(pool.resolve(ref)).toEqual({});
      expect(pool.size).toBe(1);
    });

    it('ignores undefined properties in hash', () => {
      const pool = new StylePool();
      const ref1 = pool.intern({ bgColor: '#fff' });
      const ref2 = pool.intern({ bgColor: '#fff', textColor: undefined });
      expect(ref1).toBe(ref2);
    });
  });

  describe('clear', () => {
    it('removes all interned styles', () => {
      const pool = new StylePool();
      pool.intern({ bgColor: '#fff' });
      pool.intern({ bgColor: '#000' });
      expect(pool.size).toBe(2);
      pool.clear();
      expect(pool.size).toBe(0);
    });
  });
});
