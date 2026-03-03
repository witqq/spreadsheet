import { describe, it, expect, vi } from 'vitest';
import {
  DependencyGraph,
  cellKey,
  parseCellKey,
  extractDependencies,
} from '../formula/src/dependency-graph';
import { parse, colLetterToIndex } from '../formula/src/parser';
import { tokenize } from '../formula/src/tokenizer';
import { evaluateFormula, FormulaError } from '../formula/src/index';
import type { CellValueResolver } from '../formula/src/types';

// Helper: parse a formula to AST
function parseFormula(formula: string) {
  const expr = formula.startsWith('=') ? formula.slice(1) : formula;
  return parse(tokenize(expr));
}

// Helper: create a resolver from a map
function mapResolver(cells: Record<string, unknown>): CellValueResolver {
  return {
    getCellValue(row: number, col: number): unknown {
      return cells[cellKey(row, col)] ?? null;
    },
  };
}

describe('Dependency Graph', () => {
  describe('cellKey / parseCellKey', () => {
    it('creates key from row and col', () => {
      expect(cellKey(0, 0)).toBe('0:0');
      expect(cellKey(5, 3)).toBe('5:3');
    });

    it('parses key back to row and col', () => {
      expect(parseCellKey('0:0')).toEqual({ row: 0, col: 0 });
      expect(parseCellKey('5:3')).toEqual({ row: 5, col: 3 });
    });
  });

  describe('extractDependencies', () => {
    it('extracts single cell reference', () => {
      const ast = parseFormula('=A1');
      const deps = extractDependencies(ast);
      expect(deps).toEqual([cellKey(0, 0)]);
    });

    it('extracts multiple cell references', () => {
      const ast = parseFormula('=A1+B2');
      const deps = extractDependencies(ast);
      expect(deps).toContain(cellKey(0, 0));
      expect(deps).toContain(cellKey(1, 1));
    });

    it('extracts range dependencies', () => {
      const ast = parseFormula('=SUM(A1:A3)');
      const deps = extractDependencies(ast);
      expect(deps).toContain(cellKey(0, 0));
      expect(deps).toContain(cellKey(1, 0));
      expect(deps).toContain(cellKey(2, 0));
      expect(deps).toHaveLength(3);
    });

    it('extracts 2D range dependencies', () => {
      const ast = parseFormula('=SUM(A1:B2)');
      const deps = extractDependencies(ast);
      expect(deps).toHaveLength(4);
      expect(deps).toContain(cellKey(0, 0));
      expect(deps).toContain(cellKey(0, 1));
      expect(deps).toContain(cellKey(1, 0));
      expect(deps).toContain(cellKey(1, 1));
    });

    it('extracts dependencies from nested functions', () => {
      const ast = parseFormula('=IF(A1>0, SUM(B1:B3), C1)');
      const deps = extractDependencies(ast);
      expect(deps).toContain(cellKey(0, 0)); // A1
      expect(deps).toContain(cellKey(0, 1)); // B1
      expect(deps).toContain(cellKey(1, 1)); // B2
      expect(deps).toContain(cellKey(2, 1)); // B3
      expect(deps).toContain(cellKey(0, 2)); // C1
    });

    it('returns empty for constant formulas', () => {
      const ast = parseFormula('=1+2*3');
      expect(extractDependencies(ast)).toEqual([]);
    });
  });

  describe('DependencyGraph class', () => {
    it('tracks basic dependencies', () => {
      const graph = new DependencyGraph();
      // B1 depends on A1
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);

      expect(graph.getDirectDependencies(cellKey(0, 1))).toEqual([cellKey(0, 0)]);
      expect(graph.getDirectDependents(cellKey(0, 0))).toEqual([cellKey(0, 1)]);
    });

    it('updates dependencies on re-set', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 2)]); // Change dep from A1 to C1

      expect(graph.getDirectDependencies(cellKey(0, 1))).toEqual([cellKey(0, 2)]);
      expect(graph.getDirectDependents(cellKey(0, 0))).toEqual([]); // Old dep removed
      expect(graph.getDirectDependents(cellKey(0, 2))).toEqual([cellKey(0, 1)]);
    });

    it('removes dependencies', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      graph.removeDependencies(cellKey(0, 1));

      expect(graph.getDirectDependencies(cellKey(0, 1))).toEqual([]);
      expect(graph.getDirectDependents(cellKey(0, 0))).toEqual([]);
    });

    it('detects direct circular reference', () => {
      const graph = new DependencyGraph();
      // A1 depends on A1 — direct cycle
      const ok = graph.setDependencies(cellKey(0, 0), [cellKey(0, 0)]);
      expect(ok).toBe(false);
    });

    it('detects indirect circular reference', () => {
      const graph = new DependencyGraph();
      // A1 depends on B1
      graph.setDependencies(cellKey(0, 0), [cellKey(0, 1)]);
      // B1 depends on C1
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 2)]);
      // C1 depends on A1 — cycle!
      const ok = graph.setDependencies(cellKey(0, 2), [cellKey(0, 0)]);
      expect(ok).toBe(false);
    });

    it('allows non-circular chains', () => {
      const graph = new DependencyGraph();
      expect(graph.setDependencies(cellKey(0, 0), [cellKey(0, 1)])).toBe(true);
      expect(graph.setDependencies(cellKey(0, 1), [cellKey(0, 2)])).toBe(true);
      expect(graph.setDependencies(cellKey(0, 2), [cellKey(0, 3)])).toBe(true);
    });

    it('hasDependents returns correct state', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      expect(graph.hasDependents(cellKey(0, 0))).toBe(true);
      expect(graph.hasDependents(cellKey(0, 1))).toBe(false);
    });

    it('clear removes all data', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 0), [cellKey(0, 1)]);
      graph.clear();
      expect(graph.getDirectDependencies(cellKey(0, 0))).toEqual([]);
      expect(graph.getDirectDependents(cellKey(0, 1))).toEqual([]);
    });
  });

  describe('getRecalcOrder', () => {
    it('returns empty for cells with no dependents', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      expect(graph.getRecalcOrder([cellKey(0, 1)])).toEqual([]);
    });

    it('returns direct dependents', () => {
      const graph = new DependencyGraph();
      // B1 = A1 + 1, C1 = A1 + 2
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      graph.setDependencies(cellKey(0, 2), [cellKey(0, 0)]);

      const order = graph.getRecalcOrder([cellKey(0, 0)]);
      expect(order).toHaveLength(2);
      expect(order).toContain(cellKey(0, 1));
      expect(order).toContain(cellKey(0, 2));
    });

    it('returns transitive dependents in topological order', () => {
      const graph = new DependencyGraph();
      // B1 = A1, C1 = B1, D1 = C1
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      graph.setDependencies(cellKey(0, 2), [cellKey(0, 1)]);
      graph.setDependencies(cellKey(0, 3), [cellKey(0, 2)]);

      const order = graph.getRecalcOrder([cellKey(0, 0)]);
      expect(order).toEqual([cellKey(0, 1), cellKey(0, 2), cellKey(0, 3)]);
    });

    it('handles diamond dependency correctly', () => {
      const graph = new DependencyGraph();
      // A1 → B1, A1 → C1, B1 → D1, C1 → D1
      graph.setDependencies(cellKey(0, 1), [cellKey(0, 0)]);
      graph.setDependencies(cellKey(0, 2), [cellKey(0, 0)]);
      graph.setDependencies(cellKey(0, 3), [cellKey(0, 1), cellKey(0, 2)]);

      const order = graph.getRecalcOrder([cellKey(0, 0)]);
      expect(order).toHaveLength(3);
      // D1 must come after both B1 and C1
      const idxB1 = order.indexOf(cellKey(0, 1));
      const idxC1 = order.indexOf(cellKey(0, 2));
      const idxD1 = order.indexOf(cellKey(0, 3));
      expect(idxD1).toBeGreaterThan(idxB1);
      expect(idxD1).toBeGreaterThan(idxC1);
    });

    it('handles multiple changed cells', () => {
      const graph = new DependencyGraph();
      graph.setDependencies(cellKey(0, 2), [cellKey(0, 0)]); // C1 = A1
      graph.setDependencies(cellKey(0, 3), [cellKey(0, 1)]); // D1 = B1

      const order = graph.getRecalcOrder([cellKey(0, 0), cellKey(0, 1)]);
      expect(order).toHaveLength(2);
      expect(order).toContain(cellKey(0, 2));
      expect(order).toContain(cellKey(0, 3));
    });
  });
});

describe('Parser Error Handling (M1 fixes)', () => {
  it('returns error for missing close parenthesis', () => {
    const result = evaluateFormula('=SUM(A1:A3', mapResolver({}));
    expect(result).toBeInstanceOf(FormulaError);
  });

  it('returns error for missing open parenthesis in function call', () => {
    const result = evaluateFormula('=SUM A1)', mapResolver({}));
    expect(result).toBeInstanceOf(FormulaError);
  });

  it('returns error for trailing tokens', () => {
    const result = evaluateFormula('=1+2 3', mapResolver({}));
    expect(result).toBeInstanceOf(FormulaError);
  });

  it('valid formulas still parse correctly', () => {
    const resolver = mapResolver({ '0:0': 10, '1:0': 20, '2:0': 30 });
    expect(evaluateFormula('=SUM(A1:A3)', resolver)).toBe(60);
    expect(evaluateFormula('=1+2*3', resolver)).toBe(7);
    expect(evaluateFormula('=A1+A2', resolver)).toBe(30);
  });
});

describe('Power right-associativity (m1 fix)', () => {
  it('evaluates 2^3^2 as 2^(3^2) = 512', () => {
    expect(evaluateFormula('=2^3^2', mapResolver({}))).toBe(512);
  });

  it('evaluates simple power correctly', () => {
    expect(evaluateFormula('=2^10', mapResolver({}))).toBe(1024);
  });
});

describe('Boolean consistency (M2 fix)', () => {
  it('SUM ignores booleans from ranges', () => {
    const resolver = mapResolver({ '0:0': true, '1:0': true });
    expect(evaluateFormula('=SUM(A1:A2)', resolver)).toBe(0);
  });

  it('AVERAGE ignores booleans from ranges', () => {
    const resolver = mapResolver({ '0:0': true, '1:0': true });
    const result = evaluateFormula('=AVERAGE(A1:A2)', resolver);
    expect(result).toBeInstanceOf(FormulaError); // #DIV/0! — no numeric values
  });

  it('COUNT ignores booleans from ranges', () => {
    const resolver = mapResolver({ '0:0': true, '1:0': 5 });
    expect(evaluateFormula('=COUNT(A1:A2)', resolver)).toBe(1);
  });
});

describe('LEFT function', () => {
  const resolver = mapResolver({});

  it('returns first character by default', () => {
    expect(evaluateFormula('=LEFT("Hello")', resolver)).toBe('H');
  });

  it('returns N characters', () => {
    expect(evaluateFormula('=LEFT("Hello", 3)', resolver)).toBe('Hel');
  });

  it('returns full string when N > length', () => {
    expect(evaluateFormula('=LEFT("Hi", 10)', resolver)).toBe('Hi');
  });

  it('returns empty for 0 characters', () => {
    expect(evaluateFormula('=LEFT("Hello", 0)', resolver)).toBe('');
  });
});

describe('RIGHT function', () => {
  const resolver = mapResolver({});

  it('returns last character by default', () => {
    expect(evaluateFormula('=RIGHT("Hello")', resolver)).toBe('o');
  });

  it('returns last N characters', () => {
    expect(evaluateFormula('=RIGHT("Hello", 3)', resolver)).toBe('llo');
  });

  it('returns full string when N > length', () => {
    expect(evaluateFormula('=RIGHT("Hi", 10)', resolver)).toBe('Hi');
  });

  it('returns empty for 0 characters', () => {
    expect(evaluateFormula('=RIGHT("Hello", 0)', resolver)).toBe('');
  });
});

describe('TODAY function', () => {
  it('returns current date as YYYY-MM-DD string', () => {
    const result = evaluateFormula('=TODAY()', mapResolver({}));
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const result = evaluateFormula('=TODAY()', mapResolver({}));
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
