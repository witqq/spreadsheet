// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ProgressiveLoaderPlugin — Non-blocking data loader for large datasets.
 *
 * Loads rows in an async loop: each iteration works for up to `chunkBudgetMs`
 * (default 50ms), then yields to the browser via `scheduler.yield()` (Chrome
 * 129+) or `MessageChannel` (universal fallback). CSS animations (progress bar,
 * shimmer) run on the compositor thread and stay smooth regardless of budget.
 *
 * - scheduler.yield() — cooperates with browser event prioritization, best INP
 * - MessageChannel — no 4ms clamping unlike setTimeout(0), near-zero overhead
 *
 * Ref: https://web.dev/articles/optimize-long-tasks
 */

import type { SpreadsheetPlugin, PluginAPI } from '@witqq/spreadsheet';
import { ProgressOverlay } from './progress-overlay-layer';

// Ambient type for scheduler.yield() (Chrome 129+, not yet in lib.dom.d.ts)
declare global {
  interface Scheduler {
    yield(): Promise<void>;
  }
  // eslint-disable-next-line no-var
  var scheduler: Scheduler | undefined;
}

export const PROGRESSIVE_LOADER_PLUGIN_NAME = 'progressive-loader';

/**
 * Yield to the browser between work slices.
 * Uses scheduler.yield() when available (Chrome 129+), falls back to
 * MessageChannel (no 4ms clamping like setTimeout).
 */
function yieldToMain(): Promise<void> {
  // scheduler.yield is the recommended API per web.dev/optimize-long-tasks
  if (
    typeof globalThis.scheduler !== 'undefined' &&
    typeof globalThis.scheduler.yield === 'function'
  ) {
    return globalThis.scheduler.yield();
  }
  // MessageChannel fallback — posts a macrotask with ~0ms delay
  return new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}

export interface ProgressiveLoaderConfig {
  /** Total number of rows to load */
  totalRows: number;
  /** Column keys matching engine column order */
  columnKeys: string[];
  /** Row generator function: index → row data */
  generateRow: (index: number) => Record<string, unknown>;
  /** Called on each chunk completion */
  onProgress?: (loaded: number, total: number) => void;
  /** Called when all rows are loaded */
  onComplete?: (loadTimeMs: number) => void;
  /** Max ms to spend before yielding (default: 50). CSS animations run on compositor and stay smooth. */
  chunkBudgetMs?: number;
}

export class ProgressiveLoaderPlugin implements SpreadsheetPlugin {
  readonly name = PROGRESSIVE_LOADER_PLUGIN_NAME;
  readonly version = '1.0.0';

  private api: PluginAPI | null = null;
  private overlay: ProgressOverlay;
  private config: Required<
    Pick<ProgressiveLoaderConfig, 'totalRows' | 'columnKeys' | 'generateRow' | 'chunkBudgetMs'>
  > &
    ProgressiveLoaderConfig;
  private loadedRows = 0;
  private loading = false;
  private cancelled = false;
  private startTime = 0;

  constructor(config: ProgressiveLoaderConfig) {
    this.config = {
      chunkBudgetMs: 50,
      ...config,
    };
    this.overlay = new ProgressOverlay();
  }

  install(api: PluginAPI): void {
    this.api = api;
    const scrollEl = api.engine.getScrollManager()?.getElement();
    const container = scrollEl?.parentElement;
    if (container) {
      this.overlay.mount(container);
    }
  }

  destroy(): void {
    this.cancel();
    this.overlay.destroy();
    this.api = null;
  }

  /** Start progressive loading. Table renders immediately, data streams in. */
  start(): void {
    if (!this.api || this.loading) return;
    this.loading = true;
    this.cancelled = false;
    this.loadedRows = 0;
    this.startTime = performance.now();
    this.overlay.setProgress(0, this.config.totalRows);
    this.runLoop();
  }

  /** Cancel ongoing loading */
  cancel(): void {
    this.cancelled = true;
    this.loading = false;
    this.overlay.destroy();
  }

  getProgress(): number {
    return this.config.totalRows > 0 ? this.loadedRows / this.config.totalRows : 0;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getLoadedRows(): number {
    return this.loadedRows;
  }

  /**
   * Async loop: work for up to chunkBudgetMs, yield, repeat.
   * This is the pattern recommended by web.dev/optimize-long-tasks.
   */
  private async runLoop(): Promise<void> {
    const { totalRows, columnKeys, generateRow, chunkBudgetMs } = this.config;

    // Yield before first iteration so cancel() can intercept synchronously
    await yieldToMain();

    while (this.loadedRows < totalRows) {
      if (this.cancelled || !this.api) return;

      const engine = this.api.engine;
      const store = engine.getCellStore();
      const deadline = performance.now() + chunkBudgetMs;
      const startRow = this.loadedRows;
      let processed = 0;

      // Work until time budget exhausted
      while (startRow + processed < totalRows && performance.now() < deadline) {
        store.bulkGenerate(
          startRow + processed,
          Math.min(5000, totalRows - startRow - processed),
          columnKeys,
          generateRow,
        );
        processed += Math.min(5000, totalRows - startRow - processed);
      }

      this.loadedRows = startRow + processed;
      engine.setRowCount(this.loadedRows);
      engine.requestRender();
      this.overlay.setProgress(this.loadedRows, totalRows);
      this.config.onProgress?.(this.loadedRows, totalRows);

      // Yield to browser — lets it handle input, rendering, animations
      await yieldToMain();
    }

    this.completeLoading();
  }

  private completeLoading(): void {
    this.loading = false;
    const elapsed = performance.now() - this.startTime;
    this.overlay.setPhase('processing');
    setTimeout(() => {
      this.overlay.setPhase('done');
    }, 500);
    this.config.onComplete?.(Math.round(elapsed));
  }
}
