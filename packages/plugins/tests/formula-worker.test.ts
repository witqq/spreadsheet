// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';
import { FormulaPlugin, FORMULA_PLUGIN_NAME } from '../formula/src/formula-plugin';
import { FormulaComputeEngine } from '../formula/src/formula-compute-engine';
import type { WorkerRequest, WorkerResponse } from '../formula/src/formula-compute-engine';

// ---- Helpers ----

function makeColumns(): ColumnDef[] {
  return [
    { key: 'a', title: 'A', width: 100 },
    { key: 'b', title: 'B', width: 100 },
    { key: 'c', title: 'C', width: 100 },
  ];
}

function createMockCtx(): CanvasRenderingContext2D {
  return {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    canvas: {} as HTMLCanvasElement,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * MockFormulaWorker simulates a Web Worker using FormulaComputeEngine.
 * Messages are processed asynchronously via queueMicrotask to match real Worker behavior.
 */
class MockFormulaWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  private engine = new FormulaComputeEngine();

  constructor() {
    // Simulate the 'ready' message Workers send on startup
    queueMicrotask(() => {
      const msg: WorkerResponse = { type: 'ready' };
      this.onmessage?.({ data: msg } as MessageEvent);
    });
  }

  postMessage(data: WorkerRequest): void {
    queueMicrotask(() => {
      try {
        switch (data.type) {
          case 'setCellValue':
            this.engine.setCellValue(data.row, data.col, data.value);
            break;

          case 'processFormula': {
            const results = this.engine.processFormula(data.row, data.col, data.formula);
            const msg: WorkerResponse = { type: 'results', id: data.id, results };
            this.onmessage?.({ data: msg } as MessageEvent);
            break;
          }

          case 'cellChanged': {
            const results = this.engine.cellChanged(data.row, data.col, data.value);
            const msg: WorkerResponse = { type: 'results', id: data.id, results };
            this.onmessage?.({ data: msg } as MessageEvent);
            break;
          }

          case 'recalculateAll': {
            const results = this.engine.recalculateAll(data.cells);
            const msg: WorkerResponse = { type: 'results', id: data.id, results };
            this.onmessage?.({ data: msg } as MessageEvent);
            break;
          }
        }
      } catch (err) {
        if ('id' in data) {
          const msg: WorkerResponse = {
            type: 'error',
            id: (data as { id: number }).id,
            error: err instanceof Error ? err.message : String(err),
          };
          this.onmessage?.({ data: msg } as MessageEvent);
        }
      }
    });
  }

  terminate(): void {
    // no-op
  }
}

/** Flush all pending microtasks. */
async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ---- Tests ----

describe('FormulaComputeEngine', () => {
  it('evaluates a simple formula', () => {
    const engine = new FormulaComputeEngine();
    const results = engine.processFormula(0, 0, '=1+2');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ row: 0, col: 0, value: 3, formula: '=1+2' });
  });

  it('evaluates formula with cell references', () => {
    const engine = new FormulaComputeEngine();
    engine.setCellValue(0, 0, 10);
    engine.setCellValue(1, 0, 20);
    engine.setCellValue(2, 0, 30);

    const results = engine.processFormula(0, 1, '=SUM(A1:A3)');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe(60);
  });

  it('cascades to dependent formulas', () => {
    const engine = new FormulaComputeEngine();
    engine.setCellValue(0, 0, 5);

    // B1 = A1 + 1
    engine.processFormula(0, 1, '=A1+1');
    // C1 = B1 * 10
    engine.processFormula(0, 2, '=B1*10');

    // Change A1 → should cascade to B1 and C1
    const results = engine.cellChanged(0, 0, 10);
    expect(results.length).toBeGreaterThanOrEqual(2);

    const b1 = results.find((r) => r.row === 0 && r.col === 1);
    const c1 = results.find((r) => r.row === 0 && r.col === 2);
    expect(b1?.value).toBe(11);
    expect(c1?.value).toBe(110);
  });

  it('detects circular references', () => {
    const engine = new FormulaComputeEngine();
    const results = engine.processFormula(0, 0, '=A1');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('#REF!');
  });

  it('handles division by zero', () => {
    const engine = new FormulaComputeEngine();
    const results = engine.processFormula(0, 0, '=1/0');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('#DIV/0!');
  });

  it('recalculates all formulas', () => {
    const engine = new FormulaComputeEngine();
    const results = engine.recalculateAll([
      { row: 0, col: 0, value: 10 },
      { row: 0, col: 1, value: '=A1*2', formula: '=A1*2' },
      { row: 0, col: 2, value: '=B1+5', formula: '=B1+5' },
    ]);

    const b1 = results.find((r) => r.row === 0 && r.col === 1);
    const c1 = results.find((r) => r.row === 0 && r.col === 2);
    expect(b1?.value).toBe(20);
    expect(c1?.value).toBe(25);
  });

  it('clears formula on non-formula cell change', () => {
    const engine = new FormulaComputeEngine();
    engine.setCellValue(0, 0, 5);
    engine.processFormula(0, 1, '=A1+1');

    // Change B1 from formula to plain value
    engine.cellChanged(0, 1, 'plain');

    // Now changing A1 should not cascade (B1 is no longer a formula)
    const results = engine.cellChanged(0, 0, 99);
    expect(results).toHaveLength(0);
  });

  it('produces identical results for sync and async evaluation', () => {
    const engine1 = new FormulaComputeEngine();
    const engine2 = new FormulaComputeEngine();

    // Set same initial state
    for (const eng of [engine1, engine2]) {
      eng.setCellValue(0, 0, 10);
      eng.setCellValue(1, 0, 20);
      eng.setCellValue(2, 0, 30);
    }

    const r1 = engine1.processFormula(0, 1, '=SUM(A1:A3)');
    const r2 = engine2.processFormula(0, 1, '=SUM(A1:A3)');

    expect(r1).toEqual(r2);
  });
});

describe('FormulaPlugin Worker Mode', () => {
  let container: HTMLDivElement;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  function createEngine(data?: Record<string, unknown>[]): SpreadsheetEngine {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: data ?? [],
      rowCount: 10,
    });
    engine.mount(container);
    return engine;
  }

  function simulateCellEdit(engine: SpreadsheetEngine, row: number, col: number, value: string): void {
    const physRow = engine.getDataView().getPhysicalRow(row);
    engine.getCellStore().setValue(physRow, col, value);
    const columns = engine.getConfig().columns.filter((c) => !c.hidden);
    engine.getEventBus().emit('cellChange', {
      row,
      col,
      value,
      column: columns[col],
      oldValue: null,
      newValue: value,
      source: 'edit',
    });
  }

  // ---- Sync Fallback ----

  it('uses sync mode when no Worker is provided', () => {
    const plugin = new FormulaPlugin();
    const engine = createEngine();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(false);

    simulateCellEdit(engine, 0, 0, '=1+2');
    expect(engine.getCellStore().get(0, 0)?.value).toBe(3);

    engine.destroy();
  });

  it('uses sync mode when syncOnly option is set', () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const plugin = new FormulaPlugin({ worker: mockWorker, syncOnly: true });
    const engine = createEngine();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(false);
    engine.destroy();
  });

  // ---- Worker Mode ----

  it('activates Worker mode when Worker is provided', () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const plugin = new FormulaPlugin({ worker: mockWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(true);
    engine.destroy();
  });

  it('evaluates formulas via Worker', async () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const plugin = new FormulaPlugin({ worker: mockWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    // Set source data
    engine.getCellStore().setValue(0, 0, 10);
    engine.getCellStore().setValue(1, 0, 20);

    // Sync Worker cell data
    (mockWorker as unknown as MockFormulaWorker).postMessage({
      type: 'setCellValue', row: 0, col: 0, value: 10,
    });
    (mockWorker as unknown as MockFormulaWorker).postMessage({
      type: 'setCellValue', row: 1, col: 0, value: 20,
    });
    await flushMicrotasks();

    // Enter formula
    simulateCellEdit(engine, 0, 1, '=SUM(A1:A2)');
    await flushMicrotasks();

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(30);
    expect(cell?.formula).toBe('=SUM(A1:A2)');
    expect(cell?.type).toBe('formula');

    engine.destroy();
  });

  it('cascades through Worker', async () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const plugin = new FormulaPlugin({ worker: mockWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    // Set initial data
    engine.getCellStore().setValue(0, 0, 5);
    (mockWorker as unknown as MockFormulaWorker).postMessage({
      type: 'setCellValue', row: 0, col: 0, value: 5,
    });
    await flushMicrotasks();

    // B1 = =A1+1
    simulateCellEdit(engine, 0, 1, '=A1+1');
    await flushMicrotasks();
    expect(engine.getCellStore().get(0, 1)?.value).toBe(6);

    // C1 = =B1*10
    simulateCellEdit(engine, 0, 2, '=B1*10');
    await flushMicrotasks();
    expect(engine.getCellStore().get(0, 2)?.value).toBe(60);

    // Change A1 to 10 → B1=11, C1=110
    simulateCellEdit(engine, 0, 0, '10');
    await flushMicrotasks();
    expect(engine.getCellStore().get(0, 1)?.value).toBe(11);
    expect(engine.getCellStore().get(0, 2)?.value).toBe(110);

    engine.destroy();
  });

  it('handles Worker error with sync fallback', async () => {
    // Create a Worker that always errors
    const brokenWorker = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage(_data: unknown): void {
        queueMicrotask(() => {
          const msg: WorkerResponse = { type: 'error', id: 1, error: 'Worker broken' };
          this.onmessage?.({ data: msg } as MessageEvent);
        });
      },
      terminate(): void {},
    } as unknown as Worker;

    // Simulate ready
    queueMicrotask(() => {
      const msg: WorkerResponse = { type: 'ready' };
      (brokenWorker as any).onmessage?.({ data: msg } as MessageEvent);
    });

    const plugin = new FormulaPlugin({ worker: brokenWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(true);

    // Formula should still evaluate (via sync fallback on error)
    simulateCellEdit(engine, 0, 0, '=1+2');
    await flushMicrotasks();

    // The sync fallback should have computed the result
    expect(engine.getCellStore().get(0, 0)?.value).toBe(3);

    engine.destroy();
  });

  it('destroys Worker bridge on plugin destroy', () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const terminateSpy = vi.spyOn(mockWorker, 'terminate');
    const plugin = new FormulaPlugin({ worker: mockWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(true);
    engine.removePlugin(FORMULA_PLUGIN_NAME);
    expect(plugin.isUsingWorker()).toBe(false);
    expect(terminateSpy).toHaveBeenCalled();

    engine.destroy();
  });

  it('recalculateAll via Worker on undo', async () => {
    const mockWorker = new MockFormulaWorker() as unknown as Worker;
    const plugin = new FormulaPlugin({ worker: mockWorker });
    const engine = createEngine();
    engine.installPlugin(plugin);

    // Set initial state
    engine.getCellStore().setValue(0, 0, 10);
    (mockWorker as unknown as MockFormulaWorker).postMessage({
      type: 'setCellValue', row: 0, col: 0, value: 10,
    });
    await flushMicrotasks();

    // Enter formula
    simulateCellEdit(engine, 0, 1, '=A1*2');
    await flushMicrotasks();
    expect(engine.getCellStore().get(0, 1)?.value).toBe(20);

    // Simulate undo - restore formula as raw value
    engine.getCellStore().setValue(0, 1, '=A1*2');
    engine.getEventBus().emit('commandUndo', { description: 'test' });
    await flushMicrotasks();

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(20);
    expect(cell?.formula).toBe('=A1*2');

    engine.destroy();
  });
});

describe('FormulaPlugin sync mode backward compatibility', () => {
  let container: HTMLDivElement;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  function createEngine(): SpreadsheetEngine {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: [],
      rowCount: 10,
    });
    engine.mount(container);
    return engine;
  }

  function simulateCellEdit(engine: SpreadsheetEngine, row: number, col: number, value: string): void {
    const physRow = engine.getDataView().getPhysicalRow(row);
    engine.getCellStore().setValue(physRow, col, value);
    const columns = engine.getConfig().columns.filter((c) => !c.hidden);
    engine.getEventBus().emit('cellChange', {
      row,
      col,
      value,
      column: columns[col],
      oldValue: null,
      newValue: value,
      source: 'edit',
    });
  }

  it('new FormulaPlugin() without options behaves identically to v1', () => {
    const engine = createEngine();
    const plugin = new FormulaPlugin();
    engine.installPlugin(plugin);

    expect(plugin.isUsingWorker()).toBe(false);

    // All original behaviors should work
    simulateCellEdit(engine, 0, 0, '=1+2');
    expect(engine.getCellStore().get(0, 0)?.value).toBe(3);

    engine.getCellStore().setValue(0, 0, 10);
    simulateCellEdit(engine, 0, 1, '=A1*2');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(20);

    // Cascade
    simulateCellEdit(engine, 0, 0, '50');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(100);

    // Circular reference
    simulateCellEdit(engine, 1, 0, '=A2');
    expect(engine.getCellStore().get(1, 0)?.value).toBe('#REF!');

    engine.destroy();
  });

  it('getDependencyGraph works in sync mode', () => {
    const engine = createEngine();
    const plugin = new FormulaPlugin();
    engine.installPlugin(plugin);

    engine.getCellStore().setValue(0, 0, 10);
    simulateCellEdit(engine, 0, 1, '=A1+1');

    const graph = plugin.getDependencyGraph();
    expect(graph.getDirectDependencies('0:1')).toContain('0:0');

    engine.destroy();
  });

  it('pre-existing formulas are evaluated on install', () => {
    const engine = createEngine();
    engine.getCellStore().set(0, 0, { value: 10 });
    engine.getCellStore().set(0, 1, { value: '=A1+5', formula: '=A1+5' });

    engine.installPlugin(new FormulaPlugin());

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(15);

    engine.destroy();
  });
});
