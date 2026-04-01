// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Lightweight date format/parse utility for dateFormat column option.
 * Supports tokens: YYYY (4-digit year), MM (2-digit month), DD (2-digit day).
 * Zero external dependencies.
 */

/**
 * Format a Date using a pattern string.
 * Supported tokens: YYYY, MM, DD.
 * @example formatDate(new Date(2025, 0, 15), 'DD.MM.YYYY') // '15.01.2025'
 */
export function formatDate(date: Date, pattern: string): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return pattern.replace('YYYY', yyyy).replace('MM', mm).replace('DD', dd);
}

/**
 * Parse a date string according to a pattern. Returns null if invalid.
 * The pattern must contain exactly YYYY, MM, DD tokens separated by
 * a single non-letter character (e.g. '-', '.', '/').
 * @example parseDateString('15.01.2025', 'DD.MM.YYYY') // Date(2025, 0, 15)
 */
export function parseDateString(value: string, pattern: string): Date | null {
  const sepMatch = pattern.match(/[^A-Z]/);
  if (!sepMatch) return null;
  const sep = sepMatch[0];

  const patternParts = pattern.split(sep);
  const valueParts = value.split(sep);
  if (patternParts.length !== valueParts.length) return null;

  let year = -1;
  let month = -1;
  let day = -1;

  for (let i = 0; i < patternParts.length; i++) {
    const token = patternParts[i];
    const num = parseInt(valueParts[i], 10);
    if (isNaN(num)) return null;

    if (token === 'YYYY') year = num;
    else if (token === 'MM') month = num;
    else if (token === 'DD') day = num;
  }

  if (year < 0 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  // Validate: reject overflow dates (e.g. Feb 30 → Mar 2)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Parse a CellValue into a Date, trying the custom pattern first (if provided),
 * then ISO format, then native Date parsing.
 */
export function toDate(value: unknown, pattern?: string): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  if (typeof value === 'string') {
    // Try custom pattern first
    if (pattern) {
      const custom = parseDateString(value, pattern);
      if (custom) return custom;
    }
    // Try ISO YYYY-MM-DD (with optional time part)
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}
