// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { CellStore } from '../src/model/cell-store';
import { measureInitTime, FPSCounter, measureMultiRun, measureThroughput, computeStats, BenchmarkRunner } from '../src/benchmark/performance-benchmark';

describe('Performance: 1M row initialization', () => {
  it('LayoutEngine initializes 1M rows in <500ms', () => {
    const ROW_COUNT = 1_000_000;
    const columns = Array.from({ length: 40 }, (_, i) => ({
      key: `col${i}`,
      header: `Column ${i}`,
      width: 100 + (i % 3) * 20,
    }));

    let layout: LayoutEngine | null = null;
    const result = measureInitTime(() => {
      layout = new LayoutEngine({
        columns,
        rowCount: ROW_COUNT,
        rowHeight: 32,
        headerHeight: 36,
        rowNumberWidth: 50,
      });
    });

    expect(result.timeMs).toBeLessThan(500);
    expect(layout!.rowCount).toBe(ROW_COUNT);
    expect(layout!.contentHeight).toBe(ROW_COUNT * 32);
  });

  it('binary search O(log n) works at 1M scale', () => {
    const ROW_COUNT = 1_000_000;
    const columns = [{ key: 'a', header: 'A', width: 100 }];

    const layout = new LayoutEngine({
      columns,
      rowCount: ROW_COUNT,
      rowHeight: 32,
      headerHeight: 36,
      rowNumberWidth: 50,
    });

    // Binary search should find rows in microseconds
    const start = performance.now();
    const iterations = 10_000;
    for (let i = 0; i < iterations; i++) {
      const y = Math.floor(Math.random() * layout.contentHeight);
      layout.getRowAtY(y);
    }
    const elapsed = performance.now() - start;

    // 10K lookups should complete in well under 100ms
    expect(elapsed).toBeLessThan(100);

    // Verify correctness at boundaries
    expect(layout.getRowAtY(0)).toBe(0);
    expect(layout.getRowAtY(31)).toBe(0);
    expect(layout.getRowAtY(32)).toBe(1);
    expect(layout.getRowAtY(layout.contentHeight - 1)).toBe(ROW_COUNT - 1);
  });

  it('CellStore sparse map handles 1M row address space', () => {
    const store = new CellStore();

    // Set cells at various positions in 1M space
    store.set(0, 0, { value: 'first' });
    store.set(500_000, 5, { value: 'middle' });
    store.set(999_999, 39, { value: 'last' });

    expect(store.get(0, 0)?.value).toBe('first');
    expect(store.get(500_000, 5)?.value).toBe('middle');
    expect(store.get(999_999, 39)?.value).toBe('last');
    expect(store.get(750_000, 20)).toBeUndefined();
  });

  it('setRowCount reallocation preserves existing row heights', () => {
    const columns = [{ key: 'a', header: 'A', width: 100 }];
    const layout = new LayoutEngine({
      columns,
      rowCount: 100,
      rowHeight: 28,
      headerHeight: 32,
      rowNumberWidth: 50,
    });

    // Verify initial state
    expect(layout.rowCount).toBe(100);
    expect(layout.contentHeight).toBe(100 * 28);

    // Grow to 1000 — should reallocate and preserve existing positions
    layout.setRowCount(1000);
    expect(layout.rowCount).toBe(1000);
    expect(layout.contentHeight).toBe(1000 * 28);

    // Existing rows should still have correct positions
    const rect0 = layout.getCellRect(0, 0);
    expect(rect0.y).toBe(32); // headerHeight
    expect(rect0.height).toBe(28);

    const rect50 = layout.getCellRect(50, 0);
    expect(rect50.y).toBe(32 + 50 * 28);

    // New rows should have default height
    const rect500 = layout.getCellRect(500, 0);
    expect(rect500.y).toBe(32 + 500 * 28);
    expect(rect500.height).toBe(28);

    // Shrink back — should work without reallocation
    layout.setRowCount(50);
    expect(layout.rowCount).toBe(50);
    expect(layout.contentHeight).toBe(50 * 28);

    // Grow again within existing capacity — no reallocation needed
    layout.setRowCount(800);
    expect(layout.rowCount).toBe(800);
    expect(layout.contentHeight).toBe(800 * 28);
  });
});

describe('Performance: benchmark utilities', () => {
  it('measureInitTime returns positive time', () => {
    const result = measureInitTime(() => {
      let sum = 0;
      for (let i = 0; i < 100_000; i++) sum += i;
    });
    expect(result.timeMs).toBeGreaterThan(0);
  });

  it('FPSCounter tracks frames', () => {
    const counter = new FPSCounter();
    counter.start();

    // Simulate frames with ~16ms intervals
    for (let i = 0; i < 10; i++) {
      counter.tick();
    }

    const result = counter.stop();
    expect(result.frameCount).toBe(10);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('FPSCounter returns zeros when no frames', () => {
    const counter = new FPSCounter();
    counter.start();
    const result = counter.stop();
    expect(result.frameCount).toBe(0);
    expect(result.avgFPS).toBe(0);
  });

  it('measureMultiRun returns stats with correct run count', () => {
    const stats = measureMultiRun(() => {
      let sum = 0;
      for (let i = 0; i < 10_000; i++) sum += i;
    }, 5);
    expect(stats.runs).toHaveLength(5);
    expect(stats.meanMs).toBeGreaterThan(0);
    expect(stats.medianMs).toBeGreaterThan(0);
    expect(stats.minMs).toBeLessThanOrEqual(stats.medianMs);
    expect(stats.maxMs).toBeGreaterThanOrEqual(stats.medianMs);
    expect(stats.cv).toBeGreaterThanOrEqual(0);
  });

  it('computeStats handles empty array', () => {
    const stats = computeStats([]);
    expect(stats.meanMs).toBe(0);
    expect(stats.medianMs).toBe(0);
    expect(stats.cv).toBe(0);
    expect(stats.runs).toHaveLength(0);
  });

  it('computeStats calculates correct median for odd count', () => {
    const stats = computeStats([10, 20, 30]);
    expect(stats.medianMs).toBe(20);
    expect(stats.meanMs).toBe(20);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(30);
  });

  it('computeStats calculates correct median for even count', () => {
    const stats = computeStats([10, 20, 30, 40]);
    expect(stats.medianMs).toBe(25);
  });

  it('measureThroughput returns ops/sec', () => {
    const result = measureThroughput(() => {
      Math.sqrt(42);
    }, 10_000);
    expect(result.opsPerSec).toBeGreaterThan(0);
    expect(result.totalMs).toBeGreaterThan(0);
  });

  it('BenchmarkRunner collects metrics and outputs JSON', () => {
    const runner = new BenchmarkRunner();
    runner.record('test-metric', '1K', {
      medianMs: 10,
      meanMs: 11,
      minMs: 8,
      maxMs: 15,
      cv: 0.1,
      runs: [10, 11, 12],
    });

    const result = runner.toJSON();
    expect(result.timestamp).toBeTruthy();
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].name).toBe('test-metric');
    expect(result.metrics[0].dataset).toBe('1K');
    expect(result.metrics[0].stats.medianMs).toBe(10);

    runner.reset();
    expect(runner.toJSON().metrics).toHaveLength(0);
  });
});
