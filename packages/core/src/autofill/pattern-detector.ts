// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellValue } from '../types/interfaces';

export type PatternType = 'number-sequence' | 'number-increment' | 'date-sequence' | 'text-repeat';

export interface DetectedPattern {
  readonly type: PatternType;
  /** For number-sequence: the common difference. For date-sequence: interval in ms. */
  readonly step: number;
  /** Source values that formed the pattern. */
  readonly sourceValues: readonly CellValue[];
}

/**
 * Detect a fill pattern from a list of source cell values.
 *
 * Priority:
 * 1. Number sequence (constant difference between all consecutive values)
 * 2. Date sequence (constant interval between Date values)
 * 3. Text repeat (cyclic repeat of source values)
 */
export function detectPattern(values: readonly CellValue[]): DetectedPattern {
  if (values.length === 0) {
    return { type: 'text-repeat', step: 0, sourceValues: values };
  }

  // Single value: check if it's a number (increment by 0) or text repeat
  if (values.length === 1) {
    const v = values[0];
    if (typeof v === 'number') {
      return { type: 'number-sequence', step: 0, sourceValues: values };
    }
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
      return { type: 'number-sequence', step: 0, sourceValues: values };
    }
    if (v instanceof Date) {
      return { type: 'date-sequence', step: 0, sourceValues: values };
    }
    return { type: 'text-repeat', step: 0, sourceValues: values };
  }

  // Try number sequence
  const numPattern = detectNumberPattern(values);
  if (numPattern) return numPattern;

  // Try date sequence
  const datePattern = detectDatePattern(values);
  if (datePattern) return datePattern;

  // Fallback: text repeat
  return { type: 'text-repeat', step: 0, sourceValues: values };
}

function detectNumberPattern(values: readonly CellValue[]): DetectedPattern | null {
  const numbers: number[] = [];
  for (const v of values) {
    if (typeof v === 'number') {
      numbers.push(v);
    } else if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
      numbers.push(Number(v));
    } else {
      return null;
    }
  }

  if (numbers.length < 2) return null;

  const diff = numbers[1] - numbers[0];
  for (let i = 2; i < numbers.length; i++) {
    if (Math.abs(numbers[i] - numbers[i - 1] - diff) > 1e-10) {
      return null;
    }
  }

  return {
    type: diff === 0 ? 'number-sequence' : 'number-increment',
    step: diff,
    sourceValues: values,
  };
}

function detectDatePattern(values: readonly CellValue[]): DetectedPattern | null {
  const dates: Date[] = [];
  for (const v of values) {
    if (!(v instanceof Date)) return null;
    dates.push(v);
  }

  if (dates.length < 2) return null;

  const interval = dates[1].getTime() - dates[0].getTime();
  for (let i = 2; i < dates.length; i++) {
    if (dates[i].getTime() - dates[i - 1].getTime() !== interval) {
      return null;
    }
  }

  return { type: 'date-sequence', step: interval, sourceValues: values };
}

/**
 * Extend a detected pattern to produce `count` new values.
 */
export function extendPattern(pattern: DetectedPattern, count: number): CellValue[] {
  const result: CellValue[] = [];
  const src = pattern.sourceValues;

  if (count <= 0 || src.length === 0) return result;

  switch (pattern.type) {
    case 'number-sequence':
    case 'number-increment': {
      const last = Number(src[src.length - 1]);
      const step = pattern.step;
      for (let i = 1; i <= count; i++) {
        result.push(last + step * i);
      }
      break;
    }
    case 'date-sequence': {
      const lastDate = src[src.length - 1] as Date;
      const interval = pattern.step;
      for (let i = 1; i <= count; i++) {
        result.push(new Date(lastDate.getTime() + interval * i));
      }
      break;
    }
    case 'text-repeat': {
      for (let i = 0; i < count; i++) {
        result.push(src[i % src.length]);
      }
      break;
    }
  }

  return result;
}
