// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * PerformanceBenchmark — utilities for measuring spreadsheet performance.
 *
 * Provides timing, FPS counting, multi-run statistics, and a benchmark runner
 * that outputs structured JSON results.
 */

export interface BenchmarkResult {
  /** Initialization time in milliseconds */
  initTimeMs: number;
  /** Memory used in MB (if available) */
  memoryMB?: number;
  /** Row count */
  rowCount: number;
  /** Column count */
  columnCount: number;
}

export interface FPSResult {
  /** Average FPS during measurement window */
  avgFPS: number;
  /** Minimum FPS recorded */
  minFPS: number;
  /** Maximum FPS recorded */
  maxFPS: number;
  /** Number of frames sampled */
  frameCount: number;
  /** Duration of measurement in ms */
  durationMs: number;
}

/** Result of a single timing measurement */
export interface TimingResult {
  /** Elapsed time in milliseconds */
  timeMs: number;
}

/** Statistical summary of multiple runs */
export interface RunStats {
  /** Median time across runs (ms) */
  medianMs: number;
  /** Mean time across runs (ms) */
  meanMs: number;
  /** Minimum time across runs (ms) */
  minMs: number;
  /** Maximum time across runs (ms) */
  maxMs: number;
  /** Coefficient of variation (stddev / mean) as fraction 0..1 */
  cv: number;
  /** All individual run times (ms) */
  runs: number[];
}

/** Result of a single benchmark operation */
export interface BenchmarkMetric {
  /** Human-readable metric name */
  name: string;
  /** Dataset size label (e.g. "1K", "10K", "100K") */
  dataset: string;
  /** Statistical summary */
  stats: RunStats;
  /** Unit of measurement */
  unit: string;
}

/** Full benchmark suite output */
export interface BenchmarkSuiteResult {
  /** Timestamp of the run */
  timestamp: string;
  /** All collected metrics */
  metrics: BenchmarkMetric[];
}

/**
 * Measure execution time of a synchronous function.
 */
export function measureInitTime(factory: () => void): TimingResult {
  const start = performance.now();
  factory();
  const end = performance.now();
  return { timeMs: end - start };
}

/**
 * Run a function multiple times and return statistical summary.
 * Includes a warmup run that is discarded.
 */
export function measureMultiRun(fn: () => void, runs: number = 3): RunStats {
  // Warmup (discarded)
  fn();

  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return computeStats(times);
}

/**
 * Compute statistical summary from an array of timing values.
 */
export function computeStats(times: number[]): RunStats {
  if (times.length === 0) {
    return { medianMs: 0, meanMs: 0, minMs: 0, maxMs: 0, cv: 0, runs: [] };
  }

  const sorted = [...times].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;

  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = sorted.reduce((acc, t) => acc + (t - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 0;

  return {
    medianMs: median,
    meanMs: mean,
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    cv,
    runs: times,
  };
}

/**
 * Measure throughput: how many operations per second.
 */
export function measureThroughput(
  fn: () => void,
  iterations: number,
): { opsPerSec: number; totalMs: number } {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalMs = performance.now() - start;
  return {
    opsPerSec: (iterations / totalMs) * 1000,
    totalMs,
  };
}

/**
 * FPS counter — call tick() on each rAF, read results after measurement window.
 */
export class FPSCounter {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private running = false;

  start(): void {
    this.frameTimes = [];
    this.lastTime = performance.now();
    this.running = true;
  }

  tick(): void {
    if (!this.running) return;
    const now = performance.now();
    this.frameTimes.push(now - this.lastTime);
    this.lastTime = now;
  }

  stop(): FPSResult {
    this.running = false;
    const times = this.frameTimes;
    if (times.length === 0) {
      return { avgFPS: 0, minFPS: 0, maxFPS: 0, frameCount: 0, durationMs: 0 };
    }

    const totalMs = times.reduce((a, b) => a + b, 0);
    const avgFrameTime = totalMs / times.length;
    let minFrameTime = Infinity;
    let maxFrameTime = -Infinity;
    for (const t of times) {
      if (t < minFrameTime) minFrameTime = t;
      if (t > maxFrameTime) maxFrameTime = t;
    }

    return {
      avgFPS: 1000 / avgFrameTime,
      minFPS: 1000 / maxFrameTime,
      maxFPS: 1000 / minFrameTime,
      frameCount: times.length,
      durationMs: totalMs,
    };
  }
}

/**
 * Benchmark runner that collects metrics and produces JSON output.
 */
export class BenchmarkRunner {
  private metrics: BenchmarkMetric[] = [];

  /** Record a multi-run benchmark result */
  record(name: string, dataset: string, stats: RunStats, unit: string = 'ms'): void {
    this.metrics.push({ name, dataset, stats, unit });
  }

  /** Get all collected metrics as a structured result */
  toJSON(): BenchmarkSuiteResult {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
    };
  }

  /** Reset all collected metrics */
  reset(): void {
    this.metrics = [];
  }
}
