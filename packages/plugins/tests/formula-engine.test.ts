import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  tokenize,
  TokenType,
  parse,
  evaluate,
  FormulaError,
  FormulaErrorType,
  colLetterToIndex,
  colIndexToLetter,
} from '../formula/src/index';
import type { CellValueResolver, FormulaResult } from '../formula/src/index';

// ─── Test Helpers ────────────────────────────────────

function makeResolver(data: Record<string, unknown>): CellValueResolver {
  return {
    getCellValue(row: number, col: number): unknown {
      const colLetter = colIndexToLetter(col);
      const key = `${colLetter}${row + 1}`;
      return data[key] ?? null;
    },
  };
}

const emptyResolver: CellValueResolver = {
  getCellValue() {
    return null;
  },
};

function eval_(formula: string, data: Record<string, unknown> = {}): FormulaResult {
  return evaluateFormula(formula, makeResolver(data));
}

// ─── Tests ───────────────────────────────────────────

describe('Formula Engine', () => {
  describe('colLetterToIndex / colIndexToLetter', () => {
    it('converts A to 0', () => {
      expect(colLetterToIndex('A')).toBe(0);
      expect(colIndexToLetter(0)).toBe('A');
    });

    it('converts Z to 25', () => {
      expect(colLetterToIndex('Z')).toBe(25);
      expect(colIndexToLetter(25)).toBe('Z');
    });

    it('converts AA to 26', () => {
      expect(colLetterToIndex('AA')).toBe(26);
      expect(colIndexToLetter(26)).toBe('AA');
    });

    it('converts AZ to 51', () => {
      expect(colLetterToIndex('AZ')).toBe(51);
      expect(colIndexToLetter(51)).toBe('AZ');
    });

    it('round-trips correctly', () => {
      for (let i = 0; i < 100; i++) {
        expect(colLetterToIndex(colIndexToLetter(i))).toBe(i);
      }
    });
  });

  describe('Tokenizer', () => {
    it('tokenizes a number', () => {
      const tokens = tokenize('42');
      expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '42' });
    });

    it('tokenizes a decimal', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0]).toMatchObject({ type: TokenType.Number, value: '3.14' });
    });

    it('tokenizes operators', () => {
      const tokens = tokenize('1+2*3');
      expect(tokens.map((t) => t.value)).toEqual(['1', '+', '2', '*', '3', '']);
    });

    it('tokenizes cell references', () => {
      const tokens = tokenize('A1+B2');
      expect(tokens[0]).toMatchObject({ type: TokenType.CellRef, value: 'A1' });
      expect(tokens[2]).toMatchObject({ type: TokenType.CellRef, value: 'B2' });
    });

    it('tokenizes absolute references', () => {
      const tokens = tokenize('$A$1');
      expect(tokens[0]).toMatchObject({ type: TokenType.CellRef, value: '$A$1' });
    });

    it('tokenizes function calls', () => {
      const tokens = tokenize('SUM(A1:A10)');
      expect(tokens[0]).toMatchObject({ type: TokenType.FunctionName, value: 'SUM' });
      expect(tokens[1]).toMatchObject({ type: TokenType.OpenParen });
      expect(tokens[2]).toMatchObject({ type: TokenType.CellRef, value: 'A1' });
      expect(tokens[3]).toMatchObject({ type: TokenType.Colon });
      expect(tokens[4]).toMatchObject({ type: TokenType.CellRef, value: 'A10' });
      expect(tokens[5]).toMatchObject({ type: TokenType.CloseParen });
    });

    it('tokenizes string literals', () => {
      const tokens = tokenize('"hello"');
      expect(tokens[0]).toMatchObject({ type: TokenType.String, value: 'hello' });
    });

    it('tokenizes booleans', () => {
      const tokens = tokenize('TRUE');
      expect(tokens[0]).toMatchObject({ type: TokenType.Boolean, value: 'TRUE' });
    });

    it('tokenizes comparison operators', () => {
      const tokens = tokenize('A1<>B1');
      expect(tokens[1]).toMatchObject({ type: TokenType.Operator, value: '<>' });
    });

    it('tokenizes multi-char operators <=, >=', () => {
      expect(tokenize('A1<=B1')[1].value).toBe('<=');
      expect(tokenize('A1>=B1')[1].value).toBe('>=');
    });
  });

  describe('Parser', () => {
    it('parses a number', () => {
      const tokens = tokenize('42');
      const ast = parse(tokens);
      expect(ast).toEqual({ type: 'Number', value: 42 });
    });

    it('parses addition', () => {
      const tokens = tokenize('1+2');
      const ast = parse(tokens);
      expect(ast.type).toBe('BinaryOp');
    });

    it('parses cell reference', () => {
      const tokens = tokenize('A1');
      const ast = parse(tokens);
      expect(ast).toMatchObject({ type: 'CellRef', col: 0, row: 0 });
    });

    it('parses range', () => {
      const tokens = tokenize('A1:B2');
      const ast = parse(tokens);
      expect(ast.type).toBe('Range');
    });

    it('parses function call', () => {
      const tokens = tokenize('SUM(1,2,3)');
      const ast = parse(tokens);
      expect(ast).toMatchObject({ type: 'FunctionCall', name: 'SUM' });
      if (ast.type === 'FunctionCall') {
        expect(ast.args).toHaveLength(3);
      }
    });

    it('respects operator precedence', () => {
      const tokens = tokenize('1+2*3');
      const ast = parse(tokens);
      // Should be 1 + (2 * 3), not (1 + 2) * 3
      expect(ast.type).toBe('BinaryOp');
      if (ast.type === 'BinaryOp') {
        expect(ast.op).toBe('+');
        expect(ast.right).toMatchObject({ type: 'BinaryOp', op: '*' });
      }
    });

    it('parses unary negation', () => {
      const tokens = tokenize('-5');
      const ast = parse(tokens);
      expect(ast).toMatchObject({ type: 'UnaryOp', op: '-' });
    });

    it('parses parenthesized expressions', () => {
      const tokens = tokenize('(1+2)*3');
      const ast = parse(tokens);
      if (ast.type === 'BinaryOp') {
        expect(ast.op).toBe('*');
        expect(ast.left.type).toBe('BinaryOp');
      }
    });

    it('parses percentage', () => {
      const tokens = tokenize('50%');
      const ast = parse(tokens);
      expect(ast.type).toBe('Percent');
    });
  });

  describe('Arithmetic', () => {
    it('evaluates addition', () => {
      expect(eval_('=1+2')).toBe(3);
    });

    it('evaluates subtraction', () => {
      expect(eval_('=10-3')).toBe(7);
    });

    it('evaluates multiplication', () => {
      expect(eval_('=4*5')).toBe(20);
    });

    it('evaluates division', () => {
      expect(eval_('=10/4')).toBe(2.5);
    });

    it('evaluates power', () => {
      expect(eval_('=2^10')).toBe(1024);
    });

    it('evaluates complex expression', () => {
      expect(eval_('=(1+2)*3-4/2')).toBe(7);
    });

    it('evaluates unary negation', () => {
      expect(eval_('=-5')).toBe(-5);
    });

    it('evaluates percentage', () => {
      expect(eval_('=50%')).toBe(0.5);
    });

    it('evaluates nested expressions', () => {
      expect(eval_('=((2+3)*(4-1))/5')).toBe(3);
    });

    it('returns #DIV/0! for division by zero', () => {
      const result = eval_('=1/0');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe(FormulaErrorType.DIV0);
    });
  });

  describe('Cell References', () => {
    it('resolves single cell reference', () => {
      expect(eval_('=A1', { A1: 42 })).toBe(42);
    });

    it('resolves multiple cell references', () => {
      expect(eval_('=A1+B1', { A1: 10, B1: 20 })).toBe(30);
    });

    it('treats empty cells as 0 in arithmetic', () => {
      expect(eval_('=A1+1', {})).toBe(1);
    });

    it('resolves string cell value', () => {
      expect(eval_('=A1', { A1: 'hello' })).toBe('hello');
    });

    it('resolves boolean cell value', () => {
      expect(eval_('=A1', { A1: true })).toBe(true);
    });
  });

  describe('Comparison Operators', () => {
    it('evaluates = (equal)', () => {
      expect(eval_('=1=1')).toBe(true);
      expect(eval_('=1=2')).toBe(false);
    });

    it('evaluates <> (not equal)', () => {
      expect(eval_('=1<>2')).toBe(true);
      expect(eval_('=1<>1')).toBe(false);
    });

    it('evaluates < and >', () => {
      expect(eval_('=1<2')).toBe(true);
      expect(eval_('=2>1')).toBe(true);
      expect(eval_('=2<1')).toBe(false);
    });

    it('evaluates <= and >=', () => {
      expect(eval_('=1<=1')).toBe(true);
      expect(eval_('=1>=1')).toBe(true);
      expect(eval_('=2<=1')).toBe(false);
    });

    it('compares strings', () => {
      expect(eval_('="abc"="abc"')).toBe(true);
      expect(eval_('="abc"<>"def"')).toBe(true);
    });
  });

  describe('Concatenation', () => {
    it('concatenates strings', () => {
      expect(eval_('="hello"&" "&"world"')).toBe('hello world');
    });

    it('concatenates numbers as strings', () => {
      expect(eval_('="Age: "&25')).toBe('Age: 25');
    });
  });

  describe('SUM', () => {
    it('sums numbers', () => {
      expect(eval_('=SUM(1,2,3)')).toBe(6);
    });

    it('sums a range', () => {
      expect(eval_('=SUM(A1:A3)', { A1: 10, A2: 20, A3: 30 })).toBe(60);
    });

    it('sums mixed args and ranges', () => {
      expect(eval_('=SUM(A1:A2,100)', { A1: 1, A2: 2 })).toBe(103);
    });

    it('ignores non-numeric values in range', () => {
      expect(eval_('=SUM(A1:A3)', { A1: 10, A2: 'text', A3: 30 })).toBe(40);
    });

    it('returns 0 for empty range', () => {
      expect(eval_('=SUM(A1:A3)', {})).toBe(0);
    });
  });

  describe('AVERAGE', () => {
    it('averages numbers', () => {
      expect(eval_('=AVERAGE(2,4,6)')).toBe(4);
    });

    it('averages a range', () => {
      expect(eval_('=AVERAGE(A1:A3)', { A1: 10, A2: 20, A3: 30 })).toBe(20);
    });

    it('returns #DIV/0! for empty values', () => {
      const result = eval_('=AVERAGE(A1:A3)', {});
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe(FormulaErrorType.DIV0);
    });
  });

  describe('COUNT', () => {
    it('counts numbers', () => {
      expect(eval_('=COUNT(A1:A4)', { A1: 1, A2: 'text', A3: 3, A4: null })).toBe(2);
    });

    it('counts zero', () => {
      expect(eval_('=COUNT(A1:A2)', {})).toBe(0);
    });
  });

  describe('MIN / MAX', () => {
    it('finds minimum', () => {
      expect(eval_('=MIN(5,3,7,1,9)')).toBe(1);
    });

    it('finds maximum', () => {
      expect(eval_('=MAX(5,3,7,1,9)')).toBe(9);
    });

    it('works with ranges', () => {
      expect(eval_('=MIN(A1:A3)', { A1: 5, A2: 2, A3: 8 })).toBe(2);
      expect(eval_('=MAX(A1:A3)', { A1: 5, A2: 2, A3: 8 })).toBe(8);
    });

    it('returns 0 for empty', () => {
      expect(eval_('=MIN(A1:A3)', {})).toBe(0);
      expect(eval_('=MAX(A1:A3)', {})).toBe(0);
    });
  });

  describe('IF', () => {
    it('returns true branch when condition true', () => {
      expect(eval_('=IF(TRUE,"yes","no")')).toBe('yes');
    });

    it('returns false branch when condition false', () => {
      expect(eval_('=IF(FALSE,"yes","no")')).toBe('no');
    });

    it('returns FALSE when no false branch', () => {
      expect(eval_('=IF(FALSE,"yes")')).toBe(false);
    });

    it('evaluates condition expression', () => {
      expect(eval_('=IF(A1>10,"big","small")', { A1: 15 })).toBe('big');
      expect(eval_('=IF(A1>10,"big","small")', { A1: 5 })).toBe('small');
    });

    it('handles nested IF', () => {
      expect(eval_('=IF(A1>10,"big",IF(A1>5,"medium","small"))', { A1: 7 })).toBe('medium');
    });
  });

  describe('ABS', () => {
    it('returns absolute value', () => {
      expect(eval_('=ABS(-5)')).toBe(5);
      expect(eval_('=ABS(5)')).toBe(5);
      expect(eval_('=ABS(0)')).toBe(0);
    });
  });

  describe('ROUND', () => {
    it('rounds to integer', () => {
      expect(eval_('=ROUND(3.7)')).toBe(4);
      expect(eval_('=ROUND(3.2)')).toBe(3);
    });

    it('rounds to decimal places', () => {
      expect(eval_('=ROUND(3.14159,2)')).toBe(3.14);
    });

    it('rounds to negative decimal places', () => {
      expect(eval_('=ROUND(1234,-2)')).toBe(1200);
    });
  });

  describe('Boolean Functions', () => {
    it('AND returns true when all true', () => {
      expect(eval_('=AND(TRUE,TRUE)')).toBe(true);
      expect(eval_('=AND(TRUE,FALSE)')).toBe(false);
    });

    it('OR returns true when any true', () => {
      expect(eval_('=OR(FALSE,TRUE)')).toBe(true);
      expect(eval_('=OR(FALSE,FALSE)')).toBe(false);
    });

    it('NOT negates', () => {
      expect(eval_('=NOT(TRUE)')).toBe(false);
      expect(eval_('=NOT(FALSE)')).toBe(true);
    });
  });

  describe('String Functions', () => {
    it('LEN returns length', () => {
      expect(eval_('=LEN("hello")')).toBe(5);
      expect(eval_('=LEN("")')).toBe(0);
    });

    it('UPPER/LOWER', () => {
      expect(eval_('=UPPER("hello")')).toBe('HELLO');
      expect(eval_('=LOWER("HELLO")')).toBe('hello');
    });

    it('CONCATENATE', () => {
      expect(eval_('=CONCATENATE("a","b","c")')).toBe('abc');
    });
  });

  describe('Error Handling', () => {
    it('returns #NAME? for unknown function', () => {
      const result = eval_('=UNKNOWN(1)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe(FormulaErrorType.NAME);
    });

    it('returns #VALUE! for invalid coercion', () => {
      const result = eval_('=A1+1', { A1: 'abc' });
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe(FormulaErrorType.VALUE);
    });

    it('returns #DIV/0! for division by zero', () => {
      const result = eval_('=10/0');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe(FormulaErrorType.DIV0);
    });

    it('returns error for empty formula', () => {
      const result = evaluateFormula('', emptyResolver);
      expect(result).toBeInstanceOf(FormulaError);
    });

    it('returns error for formula with only =', () => {
      const result = evaluateFormula('=', emptyResolver);
      expect(result).toBeInstanceOf(FormulaError);
    });

    it('propagates errors through expressions', () => {
      const result = eval_('=1+(A1+"abc")', { A1: 'text' });
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('Complex Formulas', () => {
    it('evaluates =SUM(A1:A10) for 10 cells', () => {
      const data: Record<string, unknown> = {};
      for (let i = 1; i <= 10; i++) {
        data[`A${i}`] = i;
      }
      expect(eval_('=SUM(A1:A10)', data)).toBe(55);
    });

    it('evaluates nested function calls', () => {
      expect(eval_('=ROUND(AVERAGE(A1:A3),1)', { A1: 1, A2: 2, A3: 3 })).toBe(2);
    });

    it('evaluates formula without leading =', () => {
      expect(evaluateFormula('1+2', emptyResolver)).toBe(3);
    });

    it('evaluates 2D range', () => {
      expect(eval_('=SUM(A1:B2)', { A1: 1, A2: 2, B1: 3, B2: 4 })).toBe(10);
    });

    it('handles COUNTA', () => {
      expect(eval_('=COUNTA(A1:A4)', { A1: 1, A2: 'text', A3: true })).toBe(3);
    });
  });
});
