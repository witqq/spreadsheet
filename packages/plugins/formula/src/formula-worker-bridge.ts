// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * FormulaWorkerBridge — manages communication between main thread and formula Worker.
 *
 * Provides a Promise-based API for formula evaluation requests.
 * Handles request/response correlation via message IDs.
 */

import type { ComputeResult, WorkerRequest, WorkerResponse } from './formula-compute-engine';

export class FormulaWorkerBridge {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (results: ComputeResult[]) => void; reject: (error: Error) => void }
  >();
  private readyPromise: Promise<void>;

  constructor(worker: Worker) {
    this.worker = worker;

    let resolveReady!: () => void;
    this.readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'ready':
          resolveReady();
          break;

        case 'results': {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            handler.resolve(msg.results);
          }
          break;
        }

        case 'error': {
          const handler = this.pending.get(msg.id);
          if (handler) {
            this.pending.delete(msg.id);
            handler.reject(new Error(msg.error));
          }
          break;
        }
      }
    };

    this.worker.onerror = () => {
      for (const [, handler] of this.pending) {
        handler.reject(new Error('Worker error'));
      }
      this.pending.clear();
    };
  }

  /** Wait for the Worker to signal readiness. */
  waitReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Send a cell value update to the Worker (fire-and-forget). */
  setCellValue(row: number, col: number, value: unknown): void {
    const msg: WorkerRequest = { type: 'setCellValue', row, col, value };
    this.worker.postMessage(msg);
  }

  /** Request formula evaluation. Returns results for the cell and cascaded dependents. */
  processFormula(row: number, col: number, formula: string): Promise<ComputeResult[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerRequest = { type: 'processFormula', id, row, col, formula };
      this.worker.postMessage(msg);
    });
  }

  /** Notify Worker of a non-formula cell change. Returns cascade results. */
  cellChanged(row: number, col: number, value: unknown): Promise<ComputeResult[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerRequest = { type: 'cellChanged', id, row, col, value };
      this.worker.postMessage(msg);
    });
  }

  /** Request full recalculation with provided cell data. */
  recalculateAll(
    cells: Array<{ row: number; col: number; value: unknown; formula?: string }>,
  ): Promise<ComputeResult[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerRequest = { type: 'recalculateAll', id, cells };
      this.worker.postMessage(msg);
    });
  }

  /** Terminate the Worker and reject all pending requests. */
  destroy(): void {
    this.worker.terminate();
    for (const [, handler] of this.pending) {
      handler.reject(new Error('Worker terminated'));
    }
    this.pending.clear();
  }
}
