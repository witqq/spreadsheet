// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Tokenizer — converts formula strings into a stream of tokens.
 *
 * Supports: numbers, strings, cell references (A1, $A$1), ranges (A1:B10),
 * function names, operators (+, -, *, /, ^, =, <>, <, >, <=, >=, &),
 * parentheses, commas, and boolean literals (TRUE, FALSE).
 */

export enum TokenType {
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  CellRef = 'CellRef',
  FunctionName = 'FunctionName',
  Operator = 'Operator',
  OpenParen = 'OpenParen',
  CloseParen = 'CloseParen',
  Comma = 'Comma',
  Colon = 'Colon',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const CELL_REF_RE = /^\$?[A-Z]+\$?\d+/;
const NUMBER_RE = /^\d+(\.\d+)?([eE][+-]?\d+)?/;
const TWO_CHAR_OPS = new Set(['<>', '<=', '>=']);
const SINGLE_OPS = new Set(['+', '-', '*', '/', '^', '=', '<', '>', '&', '%']);
const BOOLEANS = new Set(['TRUE', 'FALSE']);

/**
 * Tokenize a formula string (without leading '=').
 */
export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < formula.length) {
    const ch = formula[pos];

    // Skip whitespace
    if (ch === ' ' || ch === '\t') {
      pos++;
      continue;
    }

    // String literal
    if (ch === '"') {
      const start = pos;
      pos++;
      let str = '';
      let terminated = false;
      while (pos < formula.length) {
        if (formula[pos] === '"') {
          if (pos + 1 < formula.length && formula[pos + 1] === '"') {
            str += '"';
            pos += 2;
          } else {
            pos++;
            terminated = true;
            break;
          }
        } else {
          str += formula[pos];
          pos++;
        }
      }
      if (!terminated) {
        // Unterminated string — push as-is but let parser handle the error
        // by producing a string token that will likely cause parse issues
        tokens.push({ type: TokenType.String, value: str, position: start });
      } else {
        tokens.push({ type: TokenType.String, value: str, position: start });
      }
      continue;
    }

    // Number
    const numMatch = formula.slice(pos).match(NUMBER_RE);
    if (numMatch && (tokens.length === 0 || !isCellRefPrecursor(tokens[tokens.length - 1]))) {
      tokens.push({ type: TokenType.Number, value: numMatch[0], position: pos });
      pos += numMatch[0].length;
      continue;
    }

    // Two-character operators
    if (pos + 1 < formula.length && TWO_CHAR_OPS.has(formula.slice(pos, pos + 2))) {
      tokens.push({ type: TokenType.Operator, value: formula.slice(pos, pos + 2), position: pos });
      pos += 2;
      continue;
    }

    // Single-character operators
    if (SINGLE_OPS.has(ch)) {
      tokens.push({ type: TokenType.Operator, value: ch, position: pos });
      pos++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: TokenType.OpenParen, value: '(', position: pos });
      pos++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: TokenType.CloseParen, value: ')', position: pos });
      pos++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: TokenType.Comma, value: ',', position: pos });
      pos++;
      continue;
    }

    // Colon (for ranges)
    if (ch === ':') {
      tokens.push({ type: TokenType.Colon, value: ':', position: pos });
      pos++;
      continue;
    }

    // Cell reference or function name (starts with letter or $)
    if (/[A-Za-z$_]/.test(ch)) {
      const start = pos;
      // Try cell reference first
      const cellMatch = formula.slice(pos).match(CELL_REF_RE);
      if (cellMatch) {
        tokens.push({ type: TokenType.CellRef, value: cellMatch[0], position: start });
        pos += cellMatch[0].length;
        continue;
      }

      // Identifier (function name or boolean)
      let ident = '';
      while (pos < formula.length && /[A-Za-z0-9_.]/.test(formula[pos])) {
        ident += formula[pos];
        pos++;
      }
      const upper = ident.toUpperCase();
      if (BOOLEANS.has(upper)) {
        tokens.push({ type: TokenType.Boolean, value: upper, position: start });
      } else {
        tokens.push({ type: TokenType.FunctionName, value: upper, position: start });
      }
      continue;
    }

    // Unknown character — skip
    pos++;
  }

  tokens.push({ type: TokenType.EOF, value: '', position: pos });
  return tokens;
}

/** Check if previous token could be part of a cell ref (to disambiguate numbers). */
function isCellRefPrecursor(token: Token): boolean {
  return token.type === TokenType.CellRef;
}
