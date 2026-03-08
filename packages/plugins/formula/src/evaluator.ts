// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Evaluator — walks AST and computes formula results.
 *
 * Resolves cell references via CellValueResolver, supports arithmetic,
 * comparison, concatenation, and built-in functions.
 */

import type { ASTNode, RangeNode } from './parser';
import {
  FormulaError,
  FormulaErrorType,
  type FormulaResult,
  type CellValueResolver,
} from './types';

// ─── Value Coercion ──────────────────────────────────

function toNumber(val: unknown): number | FormulaError {
  if (val instanceof FormulaError) return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    if (val === '') return 0;
    const n = Number(val);
    if (isNaN(n)) return new FormulaError(FormulaErrorType.VALUE, `Cannot convert "${val}" to number`);
    return n;
  }
  if (val == null) return 0;
  return new FormulaError(FormulaErrorType.VALUE, 'Cannot convert to number');
}

function toBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const upper = val.toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    return val.length > 0;
  }
  return false;
}

function toString(val: unknown): string {
  if (val instanceof FormulaError) return val.type;
  if (val == null) return '';
  return String(val);
}

// ─── Range Expansion ─────────────────────────────────

function expandRange(
  range: RangeNode,
  resolver: CellValueResolver,
): (unknown)[] {
  const values: unknown[] = [];
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const startCol = Math.min(range.start.col, range.end.col);
  const endCol = Math.max(range.start.col, range.end.col);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      values.push(resolver.getCellValue(r, c));
    }
  }
  return values;
}

/** Flatten arguments — ranges expand to arrays of values. */
function flattenArgs(
  args: ASTNode[],
  resolver: CellValueResolver,
  evalNode: (node: ASTNode) => FormulaResult,
): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    if (arg.type === 'Range') {
      result.push(...expandRange(arg, resolver));
    } else {
      result.push(evalNode(arg));
    }
  }
  return result;
}

/** Extract numeric values from a flat list. Booleans from ranges are ignored for aggregate functions. */
function numericValues(values: unknown[]): number[] {
  const nums: number[] = [];
  for (const v of values) {
    if (v instanceof FormulaError) continue;
    if (typeof v === 'number') {
      nums.push(v);
    }
    // Booleans and strings from ranges are ignored
  }
  return nums;
}

// ─── Built-in Functions ──────────────────────────────

type FnImpl = (args: ASTNode[], resolver: CellValueResolver, evalNode: (n: ASTNode) => FormulaResult) => FormulaResult;

const FUNCTIONS: Record<string, FnImpl> = {
  SUM(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    // Check for errors first
    for (const v of flat) {
      if (v instanceof FormulaError) return v;
    }
    const nums = numericValues(flat);
    return nums.reduce((a, b) => a + b, 0);
  },

  AVERAGE(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    const nums = numericValues(flat);
    if (nums.length === 0) return new FormulaError(FormulaErrorType.DIV0, 'AVERAGE: no numeric values');
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },

  COUNT(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    let count = 0;
    for (const v of flat) {
      if (typeof v === 'number') count++;
    }
    return count;
  },

  MIN(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    const nums = numericValues(flat);
    if (nums.length === 0) return 0;
    return Math.min(...nums);
  },

  MAX(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    const nums = numericValues(flat);
    if (nums.length === 0) return 0;
    return Math.max(...nums);
  },

  IF(args, _resolver, evalNode) {
    if (args.length < 2) return new FormulaError(FormulaErrorType.VALUE, 'IF requires 2-3 arguments');
    const condition = evalNode(args[0]);
    if (condition instanceof FormulaError) return condition;
    const truthValue = toBoolean(condition);
    if (truthValue) {
      return evalNode(args[1]);
    }
    return args.length >= 3 ? evalNode(args[2]) : false;
  },

  ABS(args, _resolver, evalNode) {
    if (args.length !== 1) return new FormulaError(FormulaErrorType.VALUE, 'ABS requires 1 argument');
    const val = evalNode(args[0]);
    const n = toNumber(val);
    if (n instanceof FormulaError) return n;
    return Math.abs(n);
  },

  ROUND(args, _resolver, evalNode) {
    if (args.length < 1 || args.length > 2) {
      return new FormulaError(FormulaErrorType.VALUE, 'ROUND requires 1-2 arguments');
    }
    const val = evalNode(args[0]);
    const n = toNumber(val);
    if (n instanceof FormulaError) return n;

    let digits = 0;
    if (args.length === 2) {
      const d = evalNode(args[1]);
      const dNum = toNumber(d);
      if (dNum instanceof FormulaError) return dNum;
      digits = Math.trunc(dNum);
    }

    const factor = Math.pow(10, digits);
    return Math.round(n * factor) / factor;
  },

  COUNTA(args, resolver, evalNode) {
    const flat = flattenArgs(args, resolver, evalNode);
    let count = 0;
    for (const v of flat) {
      if (v != null && v !== '') count++;
    }
    return count;
  },

  NOT(args, _resolver, evalNode) {
    if (args.length !== 1) return new FormulaError(FormulaErrorType.VALUE, 'NOT requires 1 argument');
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    return !toBoolean(val);
  },

  AND(args, _resolver, evalNode) {
    if (args.length === 0) return new FormulaError(FormulaErrorType.VALUE, 'AND requires at least 1 argument');
    for (const arg of args) {
      const val = evalNode(arg);
      if (val instanceof FormulaError) return val;
      if (!toBoolean(val)) return false;
    }
    return true;
  },

  OR(args, _resolver, evalNode) {
    if (args.length === 0) return new FormulaError(FormulaErrorType.VALUE, 'OR requires at least 1 argument');
    for (const arg of args) {
      const val = evalNode(arg);
      if (val instanceof FormulaError) return val;
      if (toBoolean(val)) return true;
    }
    return false;
  },

  CONCATENATE(args, _resolver, evalNode) {
    let result = '';
    for (const arg of args) {
      const val = evalNode(arg);
      if (val instanceof FormulaError) return val;
      result += toString(val);
    }
    return result;
  },

  LEN(args, _resolver, evalNode) {
    if (args.length !== 1) return new FormulaError(FormulaErrorType.VALUE, 'LEN requires 1 argument');
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    return toString(val).length;
  },

  UPPER(args, _resolver, evalNode) {
    if (args.length !== 1) return new FormulaError(FormulaErrorType.VALUE, 'UPPER requires 1 argument');
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    return toString(val).toUpperCase();
  },

  LOWER(args, _resolver, evalNode) {
    if (args.length !== 1) return new FormulaError(FormulaErrorType.VALUE, 'LOWER requires 1 argument');
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    return toString(val).toLowerCase();
  },

  LEFT(args, _resolver, evalNode) {
    if (args.length < 1 || args.length > 2) {
      return new FormulaError(FormulaErrorType.VALUE, 'LEFT requires 1-2 arguments');
    }
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    const str = toString(val);
    let numChars = 1;
    if (args.length === 2) {
      const n = evalNode(args[1]);
      const num = toNumber(n);
      if (num instanceof FormulaError) return num;
      numChars = Math.max(0, Math.trunc(num));
    }
    return str.slice(0, numChars);
  },

  RIGHT(args, _resolver, evalNode) {
    if (args.length < 1 || args.length > 2) {
      return new FormulaError(FormulaErrorType.VALUE, 'RIGHT requires 1-2 arguments');
    }
    const val = evalNode(args[0]);
    if (val instanceof FormulaError) return val;
    const str = toString(val);
    let numChars = 1;
    if (args.length === 2) {
      const n = evalNode(args[1]);
      const num = toNumber(n);
      if (num instanceof FormulaError) return num;
      numChars = Math.max(0, Math.trunc(num));
    }
    if (numChars >= str.length) return str;
    return str.slice(str.length - numChars);
  },

  TODAY(_args, _resolver, _evalNode) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
};

// ─── Evaluator ───────────────────────────────────────

export function evaluate(
  node: ASTNode,
  resolver: CellValueResolver,
): FormulaResult {
  function evalNode(n: ASTNode): FormulaResult {
    switch (n.type) {
      case 'Number':
        return n.value;

      case 'String':
        return n.value;

      case 'Boolean':
        return n.value;

      case 'Error':
        return n.error;

      case 'Percent': {
        const val = evalNode(n.operand);
        const num = toNumber(val);
        if (num instanceof FormulaError) return num;
        return num / 100;
      }

      case 'CellRef': {
        if (n.row < 0 || n.col < 0) {
          return new FormulaError(FormulaErrorType.REF, `Invalid reference: ${n.ref}`);
        }
        const cellVal = resolver.getCellValue(n.row, n.col);
        if (cellVal instanceof FormulaError) return cellVal;
        if (cellVal == null) return 0;
        if (typeof cellVal === 'number' || typeof cellVal === 'string' || typeof cellVal === 'boolean') {
          return cellVal;
        }
        return toNumber(cellVal) as FormulaResult;
      }

      case 'Range':
        // Ranges should only appear as function arguments; evaluated there
        return new FormulaError(FormulaErrorType.VALUE, 'Range used outside function');

      case 'UnaryOp': {
        const operand = evalNode(n.operand);
        if (operand instanceof FormulaError) return operand;
        const num = toNumber(operand);
        if (num instanceof FormulaError) return num;
        return n.op === '-' ? -num : num;
      }

      case 'BinaryOp':
        return evalBinaryOp(n.op, n.left, n.right);

      case 'FunctionCall': {
        const fn = FUNCTIONS[n.name];
        if (!fn) {
          return new FormulaError(FormulaErrorType.NAME, `Unknown function: ${n.name}`);
        }
        return fn(n.args, resolver, evalNode);
      }
    }
  }

  function evalBinaryOp(op: string, left: ASTNode, right: ASTNode): FormulaResult {
    // Concatenation
    if (op === '&') {
      const l = evalNode(left);
      if (l instanceof FormulaError) return l;
      const r = evalNode(right);
      if (r instanceof FormulaError) return r;
      return toString(l) + toString(r);
    }

    const lVal = evalNode(left);
    if (lVal instanceof FormulaError) return lVal;
    const rVal = evalNode(right);
    if (rVal instanceof FormulaError) return rVal;

    // Comparison operators work with mixed types
    if (op === '=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') {
      return evalComparison(op, lVal, rVal);
    }

    // Arithmetic operators require numeric values
    const lNum = toNumber(lVal);
    if (lNum instanceof FormulaError) return lNum;
    const rNum = toNumber(rVal);
    if (rNum instanceof FormulaError) return rNum;

    switch (op) {
      case '+': return lNum + rNum;
      case '-': return lNum - rNum;
      case '*': return lNum * rNum;
      case '/':
        if (rNum === 0) return new FormulaError(FormulaErrorType.DIV0);
        return lNum / rNum;
      case '^': return Math.pow(lNum, rNum);
      default:
        return new FormulaError(FormulaErrorType.VALUE, `Unknown operator: ${op}`);
    }
  }

  function evalComparison(op: string, left: FormulaResult, right: FormulaResult): boolean {
    // Same type comparison
    if (typeof left === 'number' && typeof right === 'number') {
      switch (op) {
        case '=': return left === right;
        case '<>': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
      }
    }

    if (typeof left === 'string' && typeof right === 'string') {
      const cmp = left.localeCompare(right, undefined, { sensitivity: 'accent' });
      switch (op) {
        case '=': return cmp === 0;
        case '<>': return cmp !== 0;
        case '<': return cmp < 0;
        case '>': return cmp > 0;
        case '<=': return cmp <= 0;
        case '>=': return cmp >= 0;
      }
    }

    // Mixed type: convert to strings for comparison
    const ls = toString(left);
    const rs = toString(right);
    switch (op) {
      case '=': return ls === rs;
      case '<>': return ls !== rs;
      default: return false;
    }
  }

  return evalNode(node);
}
