import { describe, it, expect } from 'vitest';
import { detectPattern, extendPattern } from '../src/autofill/pattern-detector';

describe('Pattern Detector', () => {
  describe('detectPattern', () => {
    it('detects number sequence with constant difference', () => {
      const p = detectPattern([1, 2, 3]);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(1);
    });

    it('detects number increment by 10', () => {
      const p = detectPattern([10, 20, 30]);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(10);
    });

    it('detects negative increment', () => {
      const p = detectPattern([30, 20, 10]);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(-10);
    });

    it('detects constant number (step 0)', () => {
      const p = detectPattern([5, 5, 5]);
      expect(p.type).toBe('number-sequence');
      expect(p.step).toBe(0);
    });

    it('detects single number as number-sequence', () => {
      const p = detectPattern([42]);
      expect(p.type).toBe('number-sequence');
      expect(p.step).toBe(0);
    });

    it('detects date sequence with day interval', () => {
      const d1 = new Date('2025-01-01');
      const d2 = new Date('2025-01-02');
      const d3 = new Date('2025-01-03');
      const p = detectPattern([d1, d2, d3]);
      expect(p.type).toBe('date-sequence');
      expect(p.step).toBe(86400000); // 1 day in ms
    });

    it('detects single date as date-sequence', () => {
      const p = detectPattern([new Date('2025-06-15')]);
      expect(p.type).toBe('date-sequence');
      expect(p.step).toBe(0);
    });

    it('falls back to text-repeat for strings', () => {
      const p = detectPattern(['a', 'b', 'c']);
      expect(p.type).toBe('text-repeat');
    });

    it('falls back to text-repeat for mixed types', () => {
      const p = detectPattern([1, 'two', 3]);
      expect(p.type).toBe('text-repeat');
    });

    it('falls back to text-repeat for non-linear numbers', () => {
      const p = detectPattern([1, 2, 4]);
      expect(p.type).toBe('text-repeat');
    });

    it('handles empty values array', () => {
      const p = detectPattern([]);
      expect(p.type).toBe('text-repeat');
    });

    it('handles null values as text-repeat', () => {
      const p = detectPattern([null, null]);
      expect(p.type).toBe('text-repeat');
    });

    it('detects two-value number sequence', () => {
      const p = detectPattern([1, 3]);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(2);
    });

    it('detects date sequence with week interval', () => {
      const d1 = new Date('2025-01-06');
      const d2 = new Date('2025-01-13');
      const d3 = new Date('2025-01-20');
      const p = detectPattern([d1, d2, d3]);
      expect(p.type).toBe('date-sequence');
      expect(p.step).toBe(7 * 86400000);
    });

    it('returns text-repeat for non-uniform dates', () => {
      const d1 = new Date('2025-01-01');
      const d2 = new Date('2025-01-03');
      const d3 = new Date('2025-01-10');
      const p = detectPattern([d1, d2, d3]);
      expect(p.type).toBe('text-repeat');
    });

    it('detects numeric strings as number-increment', () => {
      const p = detectPattern(['1', '2', '3', '4']);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(1);
    });

    it('detects single numeric string as number-sequence', () => {
      const p = detectPattern(['5']);
      expect(p.type).toBe('number-sequence');
      expect(p.step).toBe(0);
    });

    it('detects mixed number and numeric string', () => {
      const p = detectPattern([1, '2', 3]);
      expect(p.type).toBe('number-increment');
      expect(p.step).toBe(1);
    });

    it('rejects non-numeric strings in number detection', () => {
      const p = detectPattern(['1', '2', 'abc']);
      expect(p.type).toBe('text-repeat');
    });
  });

  describe('extendPattern', () => {
    it('extends number increment by 1', () => {
      const p = detectPattern([1, 2, 3]);
      const result = extendPattern(p, 3);
      expect(result).toEqual([4, 5, 6]);
    });

    it('extends number increment by 10', () => {
      const p = detectPattern([10, 20, 30]);
      const result = extendPattern(p, 3);
      expect(result).toEqual([40, 50, 60]);
    });

    it('extends constant number (repeats same value)', () => {
      const p = detectPattern([5, 5, 5]);
      const result = extendPattern(p, 2);
      expect(result).toEqual([5, 5]);
    });

    it('extends single number (repeats)', () => {
      const p = detectPattern([42]);
      const result = extendPattern(p, 3);
      expect(result).toEqual([42, 42, 42]);
    });

    it('extends date sequence by day', () => {
      const d1 = new Date('2025-01-01');
      const d2 = new Date('2025-01-02');
      const d3 = new Date('2025-01-03');
      const p = detectPattern([d1, d2, d3]);
      const result = extendPattern(p, 2);
      expect(result).toHaveLength(2);
      expect((result[0] as Date).toISOString().slice(0, 10)).toBe('2025-01-04');
      expect((result[1] as Date).toISOString().slice(0, 10)).toBe('2025-01-05');
    });

    it('extends text cyclically', () => {
      const p = detectPattern(['a', 'b', 'c']);
      const result = extendPattern(p, 5);
      expect(result).toEqual(['a', 'b', 'c', 'a', 'b']);
    });

    it('extends single text value cyclically', () => {
      const p = detectPattern(['hello']);
      const result = extendPattern(p, 3);
      expect(result).toEqual(['hello', 'hello', 'hello']);
    });

    it('returns empty array for count 0', () => {
      const p = detectPattern([1, 2, 3]);
      expect(extendPattern(p, 0)).toEqual([]);
    });

    it('returns empty array for negative count', () => {
      const p = detectPattern([1, 2, 3]);
      expect(extendPattern(p, -1)).toEqual([]);
    });

    it('handles negative number increment', () => {
      const p = detectPattern([30, 20, 10]);
      const result = extendPattern(p, 3);
      expect(result).toEqual([0, -10, -20]);
    });

    it('extends fractional number sequence', () => {
      const p = detectPattern([0.1, 0.2, 0.3]);
      const result = extendPattern(p, 2);
      expect(result[0]).toBeCloseTo(0.4);
      expect(result[1]).toBeCloseTo(0.5);
    });

    it('extends numeric strings as numbers', () => {
      const p = detectPattern(['1', '2', '3', '4']);
      const result = extendPattern(p, 4);
      expect(result).toEqual([5, 6, 7, 8]);
    });

    it('extends single numeric string (repeats)', () => {
      const p = detectPattern(['5']);
      const result = extendPattern(p, 3);
      expect(result).toEqual([5, 5, 5]);
    });
  });
});
