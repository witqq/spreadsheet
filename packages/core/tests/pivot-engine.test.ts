import { describe, it, expect } from 'vitest';
import { PivotEngine } from '../src/pivot/pivot-engine';
import type { PivotConfig } from '../src/pivot/types';

function makeSalesData() {
  return [
    { region: 'East', product: 'Widget', quarter: 'Q1', sales: 100, units: 10 },
    { region: 'East', product: 'Widget', quarter: 'Q2', sales: 150, units: 15 },
    { region: 'East', product: 'Gadget', quarter: 'Q1', sales: 200, units: 8 },
    { region: 'East', product: 'Gadget', quarter: 'Q2', sales: 250, units: 12 },
    { region: 'West', product: 'Widget', quarter: 'Q1', sales: 80, units: 7 },
    { region: 'West', product: 'Widget', quarter: 'Q2', sales: 120, units: 11 },
    { region: 'West', product: 'Gadget', quarter: 'Q1', sales: 300, units: 20 },
    { region: 'West', product: 'Gadget', quarter: 'Q2', sales: 350, units: 25 },
  ];
}

describe('PivotEngine', () => {
  const engine = new PivotEngine();

  describe('sum aggregation', () => {
    it('computes sum across column dimensions', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      expect(result.rows).toHaveLength(2);
      expect(result.frozenColumns).toBe(1);

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      const west = result.rows.find((r) => r[result.columns[0].key] === 'West')!;

      // East Q1: 100 + 200 = 300, East Q2: 150 + 250 = 400
      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;
      const q2Col = result.columns.find((c) => c.title.includes('Q2'))!;
      expect(east[q1Col.key]).toBe(300);
      expect(east[q2Col.key]).toBe(400);

      // West Q1: 80 + 300 = 380, West Q2: 120 + 350 = 470
      expect(west[q1Col.key]).toBe(380);
      expect(west[q2Col.key]).toBe(470);
    });
  });

  describe('count aggregation', () => {
    it('counts all rows in each group', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'count' }],
      });

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;
      const q2Col = result.columns.find((c) => c.title.includes('Q2'))!;

      // East Q1: Widget + Gadget = 2 rows
      expect(east[q1Col.key]).toBe(2);
      expect(east[q2Col.key]).toBe(2);
    });
  });

  describe('average aggregation', () => {
    it('computes average of numeric values', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'average' }],
      });

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;

      // East Q1: (100 + 200) / 2 = 150
      expect(east[q1Col.key]).toBe(150);
    });
  });

  describe('min aggregation', () => {
    it('finds minimum value in each group', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'min' }],
      });

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;

      // East Q1: min(100, 200) = 100
      expect(east[q1Col.key]).toBe(100);
    });
  });

  describe('max aggregation', () => {
    it('finds maximum value in each group', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'max' }],
      });

      const west = result.rows.find((r) => r[result.columns[0].key] === 'West')!;
      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;

      // West Q1: max(80, 300) = 300
      expect(west[q1Col.key]).toBe(300);
    });
  });

  describe('multiple measures', () => {
    it('computes multiple aggregations per cell group', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [
          { field: 'sales', aggregate: 'sum' },
          { field: 'units', aggregate: 'sum' },
        ],
      });

      // 1 dim col + 2 quarters × 2 measures = 5 columns
      expect(result.columns).toHaveLength(5);

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;

      const salesQ1 = result.columns.find(
        (c) => c.title.includes('Q1') && c.title.includes('sales'),
      )!;
      const unitsQ1 = result.columns.find(
        (c) => c.title.includes('Q1') && c.title.includes('units'),
      )!;

      expect(east[salesQ1.key]).toBe(300);
      expect(east[unitsQ1.key]).toBe(18); // 10 + 8
    });
  });

  describe('multiple row dimensions', () => {
    it('groups by multiple row fields', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region', 'product'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // 2 regions × 2 products = 4 rows
      expect(result.rows).toHaveLength(4);
      expect(result.frozenColumns).toBe(2);

      // Find East/Widget row
      const ewRow = result.rows.find(
        (r) =>
          r[result.columns[0].key] === 'East' &&
          r[result.columns[1].key] === 'Widget',
      )!;
      expect(ewRow).toBeDefined();

      const q1Col = result.columns.find((c) => c.title.includes('Q1'))!;
      expect(ewRow[q1Col.key]).toBe(100);
    });
  });

  describe('multiple column dimensions', () => {
    it('creates cross-tabulation with compound column headers', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter', 'product'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // 2 quarters × 2 products = 4 column groups + 1 dim = 5 columns
      expect(result.columns).toHaveLength(5);

      // Column titles should contain both quarter and product
      const valCols = result.columns.filter((c) => c.title.includes(' / '));
      expect(valCols.length).toBe(4);
      expect(valCols.some((c) => c.title.includes('Q1 / Gadget'))).toBe(true);
      expect(valCols.some((c) => c.title.includes('Q2 / Widget'))).toBe(true);
    });
  });

  describe('no column dimensions', () => {
    it('produces simple group-by without cross-tabulation', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: [],
        measures: [
          { field: 'sales', aggregate: 'sum' },
          { field: 'sales', aggregate: 'average' },
        ],
      });

      // 1 dim + 2 measures = 3 columns
      expect(result.columns).toHaveLength(3);

      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      const sumCol = result.columns.find((c) => c.title.includes('sum'))!;
      const avgCol = result.columns.find((c) => c.title.includes('average'))!;

      // East total: 100 + 150 + 200 + 250 = 700
      expect(east[sumCol.key]).toBe(700);
      // Average: 700 / 4 = 175
      expect(east[avgCol.key]).toBe(175);
    });
  });

  describe('column structure', () => {
    it('marks dimension columns as frozen', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      expect(result.columns[0].frozen).toBe(true);
      expect(result.columns[1].frozen).toBeUndefined();
    });

    it('marks all columns as non-editable', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      for (const col of result.columns) {
        expect(col.editable).toBe(false);
      }
    });

    it('sets type number for value columns', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // Skip dimension columns
      for (let i = 1; i < result.columns.length; i++) {
        expect(result.columns[i].type).toBe('number');
      }
    });
  });

  describe('custom measure labels', () => {
    it('uses provided label instead of default', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum', label: 'Total Sales' }],
      });

      const valCols = result.columns.filter((c) => c.title.includes('Total Sales'));
      expect(valCols.length).toBe(2); // Q1 and Q2
    });
  });

  describe('edge cases', () => {
    it('handles empty source data', () => {
      const result = engine.compute([], {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      expect(result.rows).toHaveLength(0);
      expect(result.columns).toHaveLength(1); // only dimension column
    });

    it('returns null for groups with no numeric values', () => {
      const data = [
        { region: 'East', quarter: 'Q1', sales: 'N/A' },
        { region: 'East', quarter: 'Q1', sales: undefined },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const valCol = result.columns.find((c) => c.title.includes('Q1'))!;
      expect(result.rows[0][valCol.key]).toBeNull();
    });

    it('count includes rows with non-numeric measure values', () => {
      const data = [
        { region: 'East', quarter: 'Q1', sales: 'N/A' },
        { region: 'East', quarter: 'Q1', sales: 100 },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'count' }],
      });

      const valCol = result.columns.find((c) => c.title.includes('Q1'))!;
      expect(result.rows[0][valCol.key]).toBe(2);
    });

    it('throws when no measures provided', () => {
      expect(() =>
        engine.compute(makeSalesData(), {
          rowDimensions: ['region'],
          columnDimensions: ['quarter'],
          measures: [],
        }),
      ).toThrow('at least one measure');
    });

    it('handles missing dimension fields gracefully', () => {
      const data = [
        { region: 'East', sales: 100 },
        { sales: 200 },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: [],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // Two rows: 'East' and '' (missing region)
      expect(result.rows).toHaveLength(2);
    });

    it('handles null for groups with no matching rows in a col bucket', () => {
      const data = [
        { region: 'East', quarter: 'Q1', sales: 100 },
        { region: 'West', quarter: 'Q2', sales: 200 },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const q2Col = result.columns.find((c) => c.title.includes('Q2'))!;
      const east = result.rows.find((r) => r[result.columns[0].key] === 'East')!;
      // East has no Q2 data
      expect(east[q2Col.key]).toBeNull();
    });
  });

  describe('deterministic output', () => {
    it('produces rows sorted by row key', () => {
      const data = [
        { region: 'West', sales: 100 },
        { region: 'East', sales: 200 },
        { region: 'North', sales: 300 },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: [],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const regions = result.rows.map((r) => r[result.columns[0].key]);
      expect(regions).toEqual(['East', 'North', 'West']);
    });

    it('produces columns sorted by column key', () => {
      const data = [
        { region: 'East', quarter: 'Q3', sales: 100 },
        { region: 'East', quarter: 'Q1', sales: 200 },
        { region: 'East', quarter: 'Q2', sales: 300 },
      ];

      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const valTitles = result.columns.slice(1).map((c) => c.title);
      expect(valTitles[0]).toContain('Q1');
      expect(valTitles[1]).toContain('Q2');
      expect(valTitles[2]).toContain('Q3');
    });
  });

  describe('sourceRowIndices', () => {
    it('maps each output value cell to source row indices', () => {
      const data = makeSalesData();
      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // East row = 0, Q1 col = 1 (first value col after 1 dim col)
      const eastQ1Indices = result.sourceRowIndices.get('0:1')!;
      expect(eastQ1Indices).toBeDefined();
      // East + Q1: indices 0 (East/Widget/Q1) and 2 (East/Gadget/Q1)
      expect(eastQ1Indices).toEqual([0, 2]);

      // West row = 1, Q2 col = 2
      const westQ2Indices = result.sourceRowIndices.get('1:2')!;
      expect(westQ2Indices).toBeDefined();
      // West + Q2: indices 5 (West/Widget/Q2) and 7 (West/Gadget/Q2)
      expect(westQ2Indices).toEqual([5, 7]);
    });

    it('returns empty array for dimension column lookups', () => {
      const result = engine.compute(makeSalesData(), {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // Column 0 is a dimension column — no entry in sourceRowIndices
      expect(result.sourceRowIndices.has('0:0')).toBe(false);
    });
  });

  describe('getDrillDownRows', () => {
    it('returns source rows for a given output cell', () => {
      const data = makeSalesData();
      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      // East + Q1 → rows at indices 0 and 2
      const drillRows = engine.getDrillDownRows(data, result, 0, 1);
      expect(drillRows).toHaveLength(2);
      expect(drillRows[0]).toEqual(data[0]);
      expect(drillRows[1]).toEqual(data[2]);
    });

    it('returns empty array for dimension column', () => {
      const data = makeSalesData();
      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const drillRows = engine.getDrillDownRows(data, result, 0, 0);
      expect(drillRows).toHaveLength(0);
    });

    it('returns empty array for non-existent cell', () => {
      const data = makeSalesData();
      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [{ field: 'sales', aggregate: 'sum' }],
      });

      const drillRows = engine.getDrillDownRows(data, result, 99, 99);
      expect(drillRows).toHaveLength(0);
    });

    it('works with multiple measures per column group', () => {
      const data = makeSalesData();
      const result = engine.compute(data, {
        rowDimensions: ['region'],
        columnDimensions: ['quarter'],
        measures: [
          { field: 'sales', aggregate: 'sum' },
          { field: 'units', aggregate: 'count' },
        ],
      });

      // With 2 measures, cols: 0=dim, 1=Q1/sum, 2=Q1/count, 3=Q2/sum, 4=Q2/count
      // East + Q1/sum at col 1
      const drillSum = engine.getDrillDownRows(data, result, 0, 1);
      expect(drillSum).toHaveLength(2);

      // East + Q1/count at col 2 — same source rows as sum
      const drillCount = engine.getDrillDownRows(data, result, 0, 2);
      expect(drillCount).toHaveLength(2);
      expect(drillCount).toEqual(drillSum);
    });
  });
});
