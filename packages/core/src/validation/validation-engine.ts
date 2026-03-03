// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ValidationEngine — stores validation rules per column/cell and validates on change.
 *
 * Built-in validators: required, range, regex, custom.
 * Integrates with ChangeTracker: if validation fails, overrides status to 'error'.
 */

import type { CellStore } from '../model/cell-store';
import type { EventBus } from '../events/event-bus';
import type { CellValue, ValidationResult } from '../types/interfaces';

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

// --- Validator types ---

export interface RequiredRule {
  readonly type: 'required';
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

export interface RangeRule {
  readonly type: 'range';
  readonly min?: number;
  readonly max?: number;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

export interface RegexRule {
  readonly type: 'regex';
  readonly pattern: string;
  readonly flags?: string;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

export interface CustomRule {
  readonly type: 'custom';
  readonly validate: (value: CellValue) => ValidationResult;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

export type SpreadsheetValidationRule = RequiredRule | RangeRule | RegexRule | CustomRule;

// --- Built-in validators ---

function validateRequired(value: CellValue, rule: RequiredRule): ValidationResult {
  const empty = value === null || value === undefined || value === '';
  if (empty) {
    return {
      valid: false,
      message: rule.message ?? 'This field is required',
      severity: rule.severity ?? 'error',
    };
  }
  return { valid: true };
}

function validateRange(value: CellValue, rule: RangeRule): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { valid: true }; // range doesn't apply to empty values
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return {
      valid: false,
      message: rule.message ?? 'Value must be a number',
      severity: rule.severity ?? 'error',
    };
  }
  if (rule.min !== undefined && num < rule.min) {
    return {
      valid: false,
      message: rule.message ?? `Value must be at least ${rule.min}`,
      severity: rule.severity ?? 'error',
    };
  }
  if (rule.max !== undefined && num > rule.max) {
    return {
      valid: false,
      message: rule.message ?? `Value must be at most ${rule.max}`,
      severity: rule.severity ?? 'error',
    };
  }
  return { valid: true };
}

function validateRegex(value: CellValue, rule: RegexRule): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { valid: true }; // regex doesn't apply to empty values
  }
  const str = String(value);
  const regex = new RegExp(rule.pattern, rule.flags);
  if (!regex.test(str)) {
    return {
      valid: false,
      message: rule.message ?? `Value does not match pattern ${rule.pattern}`,
      severity: rule.severity ?? 'error',
    };
  }
  return { valid: true };
}

function validateCustom(value: CellValue, rule: CustomRule): ValidationResult {
  const result = rule.validate(value);
  if (!result.valid && !result.message && rule.message) {
    return { ...result, message: rule.message };
  }
  if (!result.valid && !result.severity && rule.severity) {
    return { ...result, severity: rule.severity };
  }
  return result;
}

function runRule(value: CellValue, rule: SpreadsheetValidationRule): ValidationResult {
  switch (rule.type) {
    case 'required':
      return validateRequired(value, rule);
    case 'range':
      return validateRange(value, rule);
    case 'regex':
      return validateRegex(value, rule);
    case 'custom':
      return validateCustom(value, rule);
    default:
      return { valid: true };
  }
}

// --- ValidationEngine ---

export interface ValidationEngineConfig {
  cellStore: CellStore;
  eventBus: EventBus;
}

export class ValidationEngine {
  private readonly cellStore: CellStore;
  private readonly eventBus: EventBus;
  private readonly columnRules = new Map<number, SpreadsheetValidationRule[]>();
  private readonly cellRules = new Map<string, SpreadsheetValidationRule[]>();

  constructor(config: ValidationEngineConfig) {
    this.cellStore = config.cellStore;
    this.eventBus = config.eventBus;
  }

  /** Set validation rules for an entire column. */
  setColumnRules(col: number, rules: SpreadsheetValidationRule[]): void {
    if (rules.length === 0) {
      this.columnRules.delete(col);
    } else {
      this.columnRules.set(col, [...rules]);
    }
  }

  /** Get validation rules for a column. */
  getColumnRules(col: number): SpreadsheetValidationRule[] {
    return this.columnRules.get(col) ?? [];
  }

  /** Set validation rules for a specific cell (in addition to column rules). */
  setCellRules(row: number, col: number, rules: SpreadsheetValidationRule[]): void {
    const key = cellKey(row, col);
    if (rules.length === 0) {
      this.cellRules.delete(key);
    } else {
      this.cellRules.set(key, [...rules]);
    }
  }

  /** Get validation rules for a specific cell. */
  getCellRules(row: number, col: number): SpreadsheetValidationRule[] {
    return this.cellRules.get(cellKey(row, col)) ?? [];
  }

  /** Remove all column rules. */
  removeColumnRules(col: number): void {
    this.columnRules.delete(col);
  }

  /** Remove cell-specific rules. */
  removeCellRules(row: number, col: number): void {
    this.cellRules.delete(cellKey(row, col));
  }

  /** Check if any rules exist for a given cell position. */
  hasRules(row: number, col: number): boolean {
    return this.columnRules.has(col) || this.cellRules.has(cellKey(row, col));
  }

  /** Check if any rules are registered at all. */
  hasAnyRules(): boolean {
    return this.columnRules.size > 0 || this.cellRules.size > 0;
  }

  /**
   * Validate a cell value against all applicable rules (column + cell-specific).
   * Returns the first failing result, or {valid: true} if all pass.
   */
  validate(row: number, col: number, value: CellValue): ValidationResult {
    const colRules = this.columnRules.get(col) ?? [];
    const specificRules = this.cellRules.get(cellKey(row, col)) ?? [];
    const allRules = [...colRules, ...specificRules];

    for (const rule of allRules) {
      const result = runRule(value, rule);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }

  /**
   * Validate a cell using its current value from CellStore.
   * Updates cell metadata status and emits events.
   * Returns the validation result.
   */
  validateCell(row: number, col: number): ValidationResult {
    const cellData = this.cellStore.get(row, col);
    const value = cellData?.value ?? null;
    const result = this.validate(row, col, value);

    this.eventBus.emit('cellValidation', { row, col, result });

    if (!result.valid) {
      const oldStatus = cellData?.metadata?.status;
      this.cellStore.setMetadata(row, col, {
        status: 'error',
        errorMessage: result.message,
      });
      if (oldStatus !== 'error') {
        this.eventBus.emit('cellStatusChange', {
          row,
          col,
          oldStatus,
          newStatus: 'error',
          errorMessage: result.message,
        });
      }
    }

    return result;
  }

  /** Remove all rules. */
  clearAllRules(): void {
    this.columnRules.clear();
    this.cellRules.clear();
  }

  /**
   * Validate all populated cells that have rules.
   * Used to run initial validation after data load.
   */
  validateAll(rowCount: number): void {
    for (const [col] of this.columnRules) {
      for (let row = 0; row < rowCount; row++) {
        this.validateCell(row, col);
      }
    }
    for (const key of this.cellRules.keys()) {
      const [rowStr, colStr] = key.split(':');
      this.validateCell(Number(rowStr), Number(colStr));
    }
  }
}
