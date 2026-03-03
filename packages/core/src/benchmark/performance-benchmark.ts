// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * PerformanceBenchmark — utility for measuring init time, scroll FPS, and memory.
 *
 * Used for development benchmarking and CI performance regression checks.
 * Not included in production bundle (test/dev only).
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

/**
 * Measure execution time of a factory function.
 */
export function measureInitTime(
  factory: () => void,
): { timeMs: number } {
  const start = performance.now();
  factory();
  const end = performance.now();
  return { timeMs: end - start };
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
