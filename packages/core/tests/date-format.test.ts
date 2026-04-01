// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatDate, parseDateString, toDate } from '../src/utils/date-format';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { ColumnDef } from '../src/types/interfaces';

// ─── formatDate ────────────────────────────────────────────

describe('formatDate', () => {
  const date = new Date(2025, 0, 15); // Jan 15, 2025

  it('formats YYYY-MM-DD', () => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-01-15');
  });

  it('formats DD.MM.YYYY', () => {
    expect(formatDate(date, 'DD.MM.YYYY')).toBe('15.01.2025');
  });

  it('formats MM/DD/YYYY', () => {
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2025');
  });

  it('formats DD/MM/YYYY', () => {
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('15/01/2025');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2025, 2, 5); // Mar 5
    expect(formatDate(d, 'DD.MM.YYYY')).toBe('05.03.2025');
  });
});

// ─── parseDateString ───────────────────────────────────────

describe('parseDateString', () => {
  it('parses YYYY-MM-DD', () => {
    const result = parseDateString('2025-01-15', 'YYYY-MM-DD');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('parses DD.MM.YYYY', () => {
    const result = parseDateString('15.01.2025', 'DD.MM.YYYY');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('parses MM/DD/YYYY', () => {
    const result = parseDateString('01/15/2025', 'MM/DD/YYYY');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('parses DD/MM/YYYY', () => {
    const result = parseDateString('15/01/2025', 'DD/MM/YYYY');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('returns null for invalid date (Feb 30)', () => {
    expect(parseDateString('30.02.2025', 'DD.MM.YYYY')).toBeNull();
  });

  it('returns null for wrong separator', () => {
    expect(parseDateString('15/01/2025', 'DD.MM.YYYY')).toBeNull();
  });

  it('returns null for non-numeric parts', () => {
    expect(parseDateString('ab.01.2025', 'DD.MM.YYYY')).toBeNull();
  });

  it('returns null for month out of range', () => {
    expect(parseDateString('15.13.2025', 'DD.MM.YYYY')).toBeNull();
  });
});

// ─── Round-trip ────────────────────────────────────────────

describe('round-trip format → parse', () => {
  const formats = ['YYYY-MM-DD', 'DD.MM.YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY'];
  const date = new Date(2025, 11, 31); // Dec 31, 2025

  for (const fmt of formats) {
    it(`round-trips with ${fmt}`, () => {
      const formatted = formatDate(date, fmt);
      const parsed = parseDateString(formatted, fmt);
      expect(parsed).toEqual(date);
    });
  }
});

// ─── toDate ────────────────────────────────────────────────

describe('toDate', () => {
  it('returns Date instances as-is', () => {
    const d = new Date(2025, 0, 15);
    expect(toDate(d)).toBe(d);
  });

  it('parses ISO string without custom format', () => {
    const result = toDate('2025-01-15');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('parses custom format string', () => {
    const result = toDate('15.01.2025', 'DD.MM.YYYY');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('falls back to ISO when custom format fails', () => {
    const result = toDate('2025-01-15', 'DD.MM.YYYY');
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('parses numeric timestamp', () => {
    const ts = new Date(2025, 0, 15).getTime();
    const result = toDate(ts);
    expect(result).toEqual(new Date(2025, 0, 15));
  });

  it('returns null for invalid value', () => {
    expect(toDate('not-a-date')).toBeNull();
  });

  it('returns null for null', () => {
    expect(toDate(null)).toBeNull();
  });
});

// ─── CellTypeRegistry with dateFormat ──────────────────────

describe('CellTypeRegistry date format integration', () => {
  it('formats date with dateFormat from ColumnDef', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date', dateFormat: 'DD.MM.YYYY' };
    expect(renderer.format('2025-01-15', undefined, 0, 0, col)).toBe('15.01.2025');
  });

  it('formats Date object with dateFormat', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date', dateFormat: 'MM/DD/YYYY' };
    const date = new Date(2025, 11, 25);
    expect(renderer.format(date, undefined, 0, 0, col)).toBe('12/25/2025');
  });

  it('falls back to locale when no dateFormat', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date' };
    const result = renderer.format('2025-01-15', undefined, 0, 0, col);
    // Default locale is en-US, toLocaleDateString produces "1/15/2025"
    expect(result).toBe('1/15/2025');
  });

  it('uses dateFormat after setFormatLocale', () => {
    const registry = new CellTypeRegistry();
    registry.setFormatLocale('ru-RU');
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date', dateFormat: 'DD.MM.YYYY' };
    expect(renderer.format('2025-01-15', undefined, 0, 0, col)).toBe('15.01.2025');
  });

  it('falls back to locale format when dateFormat not set (after setFormatLocale)', () => {
    const registry = new CellTypeRegistry();
    registry.setFormatLocale('en-US');
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date' };
    const result = renderer.format('2025-01-15', undefined, 0, 0, col);
    expect(result).toBe('1/15/2025');
  });

  it('parses custom-formatted stored value', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date', dateFormat: 'DD.MM.YYYY' };
    // Value stored in custom format from a previous commit
    expect(renderer.format('15.01.2025', undefined, 0, 0, col)).toBe('15.01.2025');
  });

  it('returns empty string for null value', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    const col: ColumnDef = { key: 'date', title: 'Date', width: 100, type: 'date', dateFormat: 'DD.MM.YYYY' };
    expect(renderer.format(null, undefined, 0, 0, col)).toBe('');
  });

  it('backwards compatible — format works without columnDef', () => {
    const registry = new CellTypeRegistry();
    const renderer = registry.get('date');
    expect(renderer.format('2025-01-15')).toBe('1/15/2025');
  });
});
