// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Formula error types following spreadsheet conventions.
 */
export enum FormulaErrorType {
  REF = '#REF!',
  VALUE = '#VALUE!',
  DIV0 = '#DIV/0!',
  NAME = '#NAME?',
  NUM = '#NUM!',
  NULL = '#NULL!',
}

export class FormulaError {
  readonly type: FormulaErrorType;
  readonly message: string;

  constructor(type: FormulaErrorType, message?: string) {
    this.type = type;
    this.message = message ?? type;
  }

  toString(): string {
    return this.type;
  }
}

/** Formula result is either a value or an error. */
export type FormulaResult = number | string | boolean | FormulaError;

/** Cell reference like A1, B2, $A$1 */
export interface CellRef {
  col: number;
  row: number;
  absCol: boolean;
  absRow: boolean;
}

/** Range reference like A1:B10 */
export interface RangeRef {
  start: CellRef;
  end: CellRef;
}

/** Interface for resolving cell values during evaluation. */
export interface CellValueResolver {
  getCellValue(row: number, col: number): unknown;
}
