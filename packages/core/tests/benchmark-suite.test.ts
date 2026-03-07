// @vitest-environment jsdom
/**
 * Comprehensive benchmark suite for @witqq/spreadsheet.
 *
 * Measures 6 key operations across 1K, 10K, and 100K row datasets:
 *   1. Initial render time (LayoutEngine + CellStore bulk load)
 *   2. Scroll performance (binary search hit-testing throughput)
 *   3. Cell update latency (single cell set + layout recalc)
 *   4. Text measurement throughput (cache hit and miss paths)
 *   5. Layout recalculation speed (row height changes → cumulative recompute)
 *   6. Memory usage after data load
 *
 * Results are collected in a BenchmarkRunner and output as JSON.
 * Run with: npx vitest run packages/core/tests/benchmark-suite.test.ts
 */

import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { CellStore } from '../src/model/cell-store';
import { TextMeasureCache } from '../src/renderer/text-measure-cache';
import { RowStore } from '../src/model/row-store';
import {
  measureMultiRun,
  measureThroughput,
  BenchmarkRunner,
} from '../src/benchmark/performance-benchmark';

const DATASETS = [
  { label: '1K', rowCount: 1_000 },
  { label: '10K', rowCount: 10_000 },
  { label: '100K', rowCount: 100_000 },
] as const;

const COL_COUNT = 20;
const BENCHMARK_RUNS = 5;
// Variance threshold: CV < 0.30 is realistic for non-isolated environments
const MAX_CV = 0.30;

function makeColumns(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    key: `col${i}`,
    header: `Column ${i}`,
    width: 80 + (i % 5) * 20,
  }));
}

function makeColumnKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `col${i}`);
}

function generateRow(index: number): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (let c = 0; c < COL_COUNT; c++) {
    row[`col${c}`] = c % 3 === 0
      ? `Row ${index} Col ${c} with some text`
      : c % 3 === 1
        ? index * 100 + c
        : index % 2 === 0;
  }
  return row;
}

// Canvas mock for TextMeasureCache benchmarks (jsdom doesn't support canvas)
function createMockCtx(): CanvasRenderingContext2D {
  let currentFont = '';
  return {
    get font() { return currentFont; },
    set font(f: string) { currentFont = f; },
    measureText(text: string) {
      // Approximate: 7px per character (consistent for benchmarking)
      return { width: text.length * 7 } as TextMetrics;
    },
  } as unknown as CanvasRenderingContext2D;
}

describe('Benchmark Suite', { timeout: 30_000 }, () => {
  const runner = new BenchmarkRunner();
  const columns = makeColumns(COL_COUNT);
  const columnKeys = makeColumnKeys(COL_COUNT);

  describe('1. Initial render time (LayoutEngine + bulk data load)', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        const stats = measureMultiRun(() => {
          const layout = new LayoutEngine({
            columns,
            rowCount,
            rowHeight: 32,
            headerHeight: 36,
            rowNumberWidth: 50,
          });
          const store = new CellStore();
          store.bulkGenerate(0, rowCount, columnKeys, generateRow);

          // Verify creation
          expect(layout.rowCount).toBe(rowCount);
          expect(store.get(0, 0)?.value).toBeDefined();
        }, BENCHMARK_RUNS);

        runner.record('initial-render', label, stats);
        if (stats.cv >= MAX_CV) console.warn(`  ⚠ High variance: cv=${(stats.cv * 100).toFixed(1)}% (threshold: ${MAX_CV * 100}%)`);
      });
    }
  });

  describe('2. Scroll performance (hit-test throughput)', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        const layout = new LayoutEngine({
          columns,
          rowCount,
          rowHeight: 32,
          headerHeight: 36,
          rowNumberWidth: 50,
        });

        const HIT_TEST_OPS = 50_000;
        const maxY = layout.contentHeight;

        const stats = measureMultiRun(() => {
          for (let i = 0; i < HIT_TEST_OPS; i++) {
            const y = (i * 7919) % maxY; // deterministic pseudo-random
            layout.getRowAtY(y);
          }
        }, BENCHMARK_RUNS);

        runner.record('scroll-hit-test', label, stats);
        if (stats.cv >= MAX_CV) console.warn(`  ⚠ High variance: cv=${(stats.cv * 100).toFixed(1)}% (threshold: ${MAX_CV * 100}%)`);
      });
    }
  });

  describe('3. Cell update latency', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        const layout = new LayoutEngine({
          columns,
          rowCount,
          rowHeight: 32,
          headerHeight: 36,
          rowNumberWidth: 50,
        });
        const store = new CellStore();
        store.bulkGenerate(0, rowCount, columnKeys, generateRow);

        const UPDATE_OPS = 1_000;

        const stats = measureMultiRun(() => {
          for (let i = 0; i < UPDATE_OPS; i++) {
            const row = (i * 97) % rowCount;
            const col = i % COL_COUNT;
            store.set(row, col, { value: `updated-${i}` });
            // Simulate layout recalc for the row
            layout.setRowHeight(row, 32 + (i % 10));
          }
        }, BENCHMARK_RUNS);

        runner.record('cell-update-latency', label, stats);
        if (stats.cv >= MAX_CV) console.warn(`  ⚠ High variance: cv=${(stats.cv * 100).toFixed(1)}% (threshold: ${MAX_CV * 100}%)`);
      });
    }
  });

  describe('4. Text measurement throughput', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        const ctx = createMockCtx();
        const cache = new TextMeasureCache(10_000);
        const font = '14px Arial';
        const textCount = Math.min(rowCount, 10_000);

        // Prepare unique texts
        const texts: string[] = [];
        for (let i = 0; i < textCount; i++) {
          texts.push(`Row ${i} sample text for measurement`);
        }

        // Measure cold path (cache miss)
        const coldStats = measureMultiRun(() => {
          cache.clear();
          for (let i = 0; i < textCount; i++) {
            cache.measureText(ctx, texts[i], font);
          }
        }, BENCHMARK_RUNS);

        // Measure hot path (cache hit) — run enough iterations for stable timing
        cache.clear();
        for (const t of texts) cache.measureText(ctx, t, font);
        const hotPasses = Math.max(10, Math.ceil(50_000 / textCount));

        const hotStats = measureMultiRun(() => {
          for (let pass = 0; pass < hotPasses; pass++) {
            for (let i = 0; i < textCount; i++) {
              cache.measureText(ctx, texts[i], font);
            }
          }
        }, BENCHMARK_RUNS);

        runner.record('text-measure-cold', label, coldStats);
        runner.record('text-measure-hot', label, hotStats);
        if (coldStats.cv >= MAX_CV) console.warn(`  ⚠ High cold variance: cv=${(coldStats.cv * 100).toFixed(1)}%`);
        if (hotStats.cv >= MAX_CV) console.warn(`  ⚠ High hot variance: cv=${(hotStats.cv * 100).toFixed(1)}%`);
      });
    }
  });

  describe('5. Layout recalculation speed', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        const layout = new LayoutEngine({
          columns,
          rowCount,
          rowHeight: 32,
          headerHeight: 36,
          rowNumberWidth: 50,
        });

        // Measure recalc triggered by row height changes at various positions
        const RECALC_OPS = 100;

        const stats = measureMultiRun(() => {
          for (let i = 0; i < RECALC_OPS; i++) {
            const row = Math.floor((i / RECALC_OPS) * rowCount);
            layout.setRowHeight(row, 28 + (i % 20));
          }
        }, BENCHMARK_RUNS);

        runner.record('layout-recalc', label, stats);
        if (stats.cv >= MAX_CV) console.warn(`  ⚠ High variance: cv=${(stats.cv * 100).toFixed(1)}% (threshold: ${MAX_CV * 100}%)`);
      });
    }
  });

  describe('6. Memory usage after data load', () => {
    for (const { label, rowCount } of DATASETS) {
      it(`${label} rows`, () => {
        // Force GC if available
        if (typeof globalThis.gc === 'function') globalThis.gc();

        const heapBefore = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;

        const layout = new LayoutEngine({
          columns,
          rowCount,
          rowHeight: 32,
          headerHeight: 36,
          rowNumberWidth: 50,
        });
        const store = new CellStore();
        store.bulkGenerate(0, rowCount, columnKeys, generateRow);

        const heapAfter = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;

        const memoryMB = heapBefore > 0
          ? (heapAfter - heapBefore) / (1024 * 1024)
          : NaN;

        // Keep references alive so GC doesn't collect them
        expect(layout.rowCount).toBe(rowCount);
        expect(store.get(0, 0)).toBeDefined();

        // Record memory metric (NaN if API unavailable)
        runner.record(
          'memory-after-load',
          label,
          {
            medianMs: memoryMB,
            meanMs: memoryMB,
            minMs: memoryMB,
            maxMs: memoryMB,
            cv: 0,
            runs: [memoryMB],
          },
          'MB',
        );

        // Memory test is informational — no strict assertion
        // since heap APIs differ across environments
        expect(true).toBe(true);
      });
    }
  });

  it('outputs JSON results', () => {
    const result = runner.toJSON();
    expect(result.timestamp).toBeTruthy();
    expect(result.metrics.length).toBeGreaterThan(0);

    // Output results as JSON for external consumption
    const json = JSON.stringify(result, null, 2);
    console.log('\n=== BENCHMARK RESULTS ===');
    console.log(json);
    console.log('=== END BENCHMARK RESULTS ===\n');

    // Summary table
    console.log('Benchmark Summary:');
    console.log('-'.repeat(70));
    for (const m of result.metrics) {
      const value = m.unit === 'MB'
        ? (isNaN(m.stats.medianMs) ? 'N/A' : `${m.stats.medianMs.toFixed(1)} MB`)
        : `${m.stats.medianMs.toFixed(2)} ms (cv=${(m.stats.cv * 100).toFixed(1)}%)`;
      console.log(`  ${m.name.padEnd(22)} ${m.dataset.padEnd(6)} ${value}`);
    }
    console.log('-'.repeat(70));
  });
});
