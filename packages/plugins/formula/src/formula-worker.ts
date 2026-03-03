// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Formula Worker — Web Worker script for off-main-thread formula evaluation.
 *
 * Receives cell data updates and formula evaluation requests from the main thread.
 * Uses FormulaComputeEngine for all computation.
 */

import { FormulaComputeEngine } from './formula-compute-engine';
import type { WorkerRequest, WorkerResponse } from './formula-compute-engine';

/** Minimal Worker global scope — avoids adding WebWorker lib to project tsconfig */
interface WorkerGlobalScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const engine = new FormulaComputeEngine();

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Worker global scope type assertion
const ctx = self as unknown as WorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'setCellValue':
        engine.setCellValue(msg.row, msg.col, msg.value);
        break;

      case 'processFormula': {
        const results = engine.processFormula(msg.row, msg.col, msg.formula);
        const response: WorkerResponse = { type: 'results', id: msg.id, results };
        ctx.postMessage(response);
        break;
      }

      case 'cellChanged': {
        const results = engine.cellChanged(msg.row, msg.col, msg.value);
        const response: WorkerResponse = { type: 'results', id: msg.id, results };
        ctx.postMessage(response);
        break;
      }

      case 'recalculateAll': {
        const results = engine.recalculateAll(msg.cells);
        const response: WorkerResponse = { type: 'results', id: msg.id, results };
        ctx.postMessage(response);
        break;
      }
    }
  } catch (err) {
    if ('id' in msg) {
      const response: WorkerResponse = {
        type: 'error',
        id: (msg as { id: number }).id,
        error: err instanceof Error ? err.message : String(err),
      };
      ctx.postMessage(response);
    }
  }
};

const readyMsg: WorkerResponse = { type: 'ready' };
ctx.postMessage(readyMsg);
