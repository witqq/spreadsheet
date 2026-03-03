// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Parser — builds an AST from a token stream using recursive descent.
 *
 * Grammar (precedence low → high):
 *   expression    → comparison (("&") comparison)*
 *   comparison    → addition (("=" | "<>" | "<" | ">" | "<=" | ">=") addition)*
 *   addition      → multiplication (("+" | "-") multiplication)*
 *   multiplication → power (("*" | "/") power)*
 *   power         → unary ("^" unary)*
 *   unary         → ("-" | "+") unary | postfix
 *   postfix       → primary "%" | primary
 *   primary       → NUMBER | STRING | BOOLEAN | cellRef | range | functionCall | "(" expression ")"
 */

import { type Token, TokenType } from './tokenizer';
import { FormulaError, FormulaErrorType } from './types';

// ─── AST Node Types ──────────────────────────────────

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellRefNode
  | RangeNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | PercentNode
  | ErrorNode;

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface CellRefNode {
  type: 'CellRef';
  ref: string;
  col: number;
  row: number;
  absCol: boolean;
  absRow: boolean;
}

export interface RangeNode {
  type: 'Range';
  start: CellRefNode;
  end: CellRefNode;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  op: string;
  operand: ASTNode;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface PercentNode {
  type: 'Percent';
  operand: ASTNode;
}

export interface ErrorNode {
  type: 'Error';
  error: FormulaError;
}

// ─── Cell Reference Parsing ──────────────────────────

const COL_RE = /^(\$?)([A-Z]+)/;
const ROW_RE = /(\$?)(\d+)$/;

/** Convert column letters to 0-based index: A→0, B→1, Z→25, AA→26 */
export function colLetterToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** Convert 0-based column index to letters: 0→A, 1→B, 25→Z, 26→AA */
export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function parseCellRefString(ref: string): CellRefNode {
  const colMatch = ref.match(COL_RE);
  const rowMatch = ref.match(ROW_RE);

  if (!colMatch || !rowMatch) {
    return {
      type: 'CellRef',
      ref,
      col: -1,
      row: -1,
      absCol: false,
      absRow: false,
    };
  }

  return {
    type: 'CellRef',
    ref,
    col: colLetterToIndex(colMatch[2]),
    row: parseInt(rowMatch[2], 10) - 1, // 0-based
    absCol: colMatch[1] === '$',
    absRow: rowMatch[1] === '$',
  };
}

// ─── Parser ──────────────────────────────────────────

class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function peek(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function expect(type: TokenType): Token {
    const tok = peek();
    if (tok.type !== type) {
      throw new ParseError(
        `Expected ${type}, got ${tok.type} at position ${tok.position}`,
      );
    }
    return advance();
  }

  try {
    const result = parseExpression();
    if (peek().type !== TokenType.EOF) {
      return {
        type: 'Error',
        error: new FormulaError(
          FormulaErrorType.VALUE,
          `Unexpected token: ${peek().value} at position ${peek().position}`,
        ),
      };
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      type: 'Error',
      error: new FormulaError(FormulaErrorType.VALUE, message),
    };
  }

  function parseExpression(): ASTNode {
    return parseConcatenation();
  }

  function parseConcatenation(): ASTNode {
    let left = parseComparison();
    while (peek().type === TokenType.Operator && peek().value === '&') {
      advance();
      const right = parseComparison();
      left = { type: 'BinaryOp', op: '&', left, right };
    }
    return left;
  }

  function parseComparison(): ASTNode {
    let left = parseAddition();
    const compOps = new Set(['=', '<>', '<', '>', '<=', '>=']);
    while (peek().type === TokenType.Operator && compOps.has(peek().value)) {
      const op = advance().value;
      const right = parseAddition();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parseAddition(): ASTNode {
    let left = parseMultiplication();
    while (peek().type === TokenType.Operator && (peek().value === '+' || peek().value === '-')) {
      const op = advance().value;
      const right = parseMultiplication();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parseMultiplication(): ASTNode {
    let left = parsePower();
    while (peek().type === TokenType.Operator && (peek().value === '*' || peek().value === '/')) {
      const op = advance().value;
      const right = parsePower();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  function parsePower(): ASTNode {
    let left = parseUnary();
    if (peek().type === TokenType.Operator && peek().value === '^') {
      advance();
      const right = parsePower(); // Right-associative: 2^3^2 = 2^(3^2)
      left = { type: 'BinaryOp', op: '^', left, right };
    }
    return left;
  }

  function parseUnary(): ASTNode {
    if (peek().type === TokenType.Operator && (peek().value === '-' || peek().value === '+')) {
      const op = advance().value;
      const operand = parseUnary();
      return { type: 'UnaryOp', op, operand };
    }
    return parsePostfix();
  }

  function parsePostfix(): ASTNode {
    let node = parsePrimary();
    if (peek().type === TokenType.Operator && peek().value === '%') {
      advance();
      node = { type: 'Percent', operand: node };
    }
    return node;
  }

  function parsePrimary(): ASTNode {
    const tok = peek();

    // Number
    if (tok.type === TokenType.Number) {
      advance();
      return { type: 'Number', value: parseFloat(tok.value) };
    }

    // String
    if (tok.type === TokenType.String) {
      advance();
      return { type: 'String', value: tok.value };
    }

    // Boolean
    if (tok.type === TokenType.Boolean) {
      advance();
      return { type: 'Boolean', value: tok.value === 'TRUE' };
    }

    // Function call
    if (tok.type === TokenType.FunctionName) {
      advance();
      expect(TokenType.OpenParen);
      const args: ASTNode[] = [];
      if (peek().type !== TokenType.CloseParen) {
        args.push(parseExpression());
        while (peek().type === TokenType.Comma) {
          advance();
          args.push(parseExpression());
        }
      }
      expect(TokenType.CloseParen);
      return { type: 'FunctionCall', name: tok.value, args };
    }

    // Cell reference (possibly range)
    if (tok.type === TokenType.CellRef) {
      advance();
      const cellNode = parseCellRefString(tok.value);

      // Check for range (colon)
      if (peek().type === TokenType.Colon) {
        advance();
        const endTok = expect(TokenType.CellRef);
        const endNode = parseCellRefString(endTok.value);
        return { type: 'Range', start: cellNode, end: endNode };
      }

      return cellNode;
    }

    // Parenthesized expression
    if (tok.type === TokenType.OpenParen) {
      advance();
      const expr = parseExpression();
      expect(TokenType.CloseParen);
      return expr;
    }

    // Error: unexpected token
    advance();
    return {
      type: 'Error',
      error: new FormulaError(
        FormulaErrorType.VALUE,
        `Unexpected token: ${tok.value}`,
      ),
    };
  }
}
