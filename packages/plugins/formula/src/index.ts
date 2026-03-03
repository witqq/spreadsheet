// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Formula Engine — tokenizer, parser, and evaluator for spreadsheet formulas.
 *
 * Usage:
 *   import { evaluateFormula, FormulaError, FormulaErrorType } from './formula';
 *   const result = evaluateFormula('=SUM(A1:A10)', resolver);
 */

export { tokenize, TokenType } from './tokenizer';
export type { Token } from './tokenizer';
export { parse, colLetterToIndex, colIndexToLetter } from './parser';
export type {
  ASTNode,
  NumberNode,
  StringNode,
  BooleanNode,
  CellRefNode,
  RangeNode,
  BinaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
  PercentNode,
  ErrorNode,
} from './parser';
export { evaluate } from './evaluator';
export {
  DependencyGraph,
  cellKey,
  parseCellKey,
  extractDependencies,
} from './dependency-graph';
export { FormulaPlugin, FORMULA_PLUGIN_NAME } from './formula-plugin';
export type { FormulaPluginOptions } from './formula-plugin';
export {
  FormulaError,
  FormulaErrorType,
} from './types';
export type {
  FormulaResult,
  CellRef,
  RangeRef,
  CellValueResolver,
} from './types';
export { FormulaComputeEngine } from './formula-compute-engine';
export type { ComputeResult, WorkerRequest, WorkerResponse } from './formula-compute-engine';
export { FormulaWorkerBridge } from './formula-worker-bridge';

import { tokenize } from './tokenizer';
import { parse } from './parser';
import { evaluate } from './evaluator';
import { FormulaError, FormulaErrorType, type FormulaResult, type CellValueResolver } from './types';

/**
 * Evaluate a formula string. If it starts with '=', strips it.
 * Returns a FormulaResult (number | string | boolean | FormulaError).
 */
export function evaluateFormula(
  formula: string,
  resolver: CellValueResolver,
): FormulaResult {
  if (!formula || typeof formula !== 'string') {
    return new FormulaError(FormulaErrorType.VALUE, 'Empty formula');
  }

  // Strip leading '='
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  if (expr.trim() === '') {
    return new FormulaError(FormulaErrorType.VALUE, 'Empty expression');
  }

  const tokens = tokenize(expr);
  const ast = parse(tokens);
  return evaluate(ast, resolver);
}
