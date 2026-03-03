// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef, CellChangeEvent } from '@witqq/spreadsheet';
import { FormulaPlugin, FORMULA_PLUGIN_NAME } from '../formula/src/formula-plugin';

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

describe('FormulaPlugin', () => {
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
    // Set raw value via cellStore.setValue, then emit cellChange like SpreadsheetEngine does
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

  // ---- Basic Plugin Lifecycle ----

  it('has correct name and version', () => {
    const plugin = new FormulaPlugin();
    expect(plugin.name).toBe(FORMULA_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('installs and destroys without error', () => {
    const engine = createEngine();
    const plugin = new FormulaPlugin();
    engine.installPlugin(plugin);
    expect(engine.getPlugin(FORMULA_PLUGIN_NAME)).toBe(plugin);
    engine.removePlugin(FORMULA_PLUGIN_NAME);
    expect(engine.getPlugin(FORMULA_PLUGIN_NAME)).toBeUndefined();
    engine.destroy();
  });

  // ---- Formula Detection and Evaluation ----

  it('evaluates a simple number formula on cellChange', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=1+2');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe(3);
    expect(cell?.formula).toBe('=1+2');
    expect(cell?.type).toBe('formula');
    engine.destroy();
  });

  it('evaluates SUM with cell references', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // Set raw values first
    engine.getCellStore().setValue(0, 0, 10);
    engine.getCellStore().setValue(1, 0, 20);
    engine.getCellStore().setValue(2, 0, 30);

    // Enter formula in B1 referencing A1:A3
    simulateCellEdit(engine, 0, 1, '=SUM(A1:A3)');

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(60);
    expect(cell?.formula).toBe('=SUM(A1:A3)');
    engine.destroy();
  });

  it('evaluates string formulas', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=UPPER("hello")');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe('HELLO');
    engine.destroy();
  });

  it('evaluates boolean formulas', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=1>0');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe(true);
    engine.destroy();
  });

  it('evaluates IF function', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    engine.getCellStore().setValue(0, 0, 10);
    simulateCellEdit(engine, 0, 1, '=IF(A1>5,"big","small")');

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe('big');
    engine.destroy();
  });

  // ---- Error Handling ----

  it('stores #ERROR! for invalid formula syntax', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=+++');

    const cell = engine.getCellStore().get(0, 0);
    // Parser may return FormulaError (e.g. #VALUE!) or #ERROR! depending on syntax
    expect(typeof cell?.value).toBe('string');
    expect((cell?.value as string).startsWith('#')).toBe(true);
    engine.destroy();
  });

  it('stores error for division by zero', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=1/0');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe('#DIV/0!');
    engine.destroy();
  });

  it('stores #REF! for circular reference', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // A1 = =A1 (self-reference)
    simulateCellEdit(engine, 0, 0, '=A1');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe('#REF!');
    engine.destroy();
  });

  // ---- Non-formula Values ----

  it('does not process non-formula values', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, 'hello');

    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe('hello');
    expect(cell?.formula).toBeUndefined();
    expect(cell?.type).toBeUndefined();
    engine.destroy();
  });

  it('clears formula when cell changes to non-formula value', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // Set formula
    simulateCellEdit(engine, 0, 0, '=1+1');
    expect(engine.getCellStore().get(0, 0)?.formula).toBe('=1+1');

    // Overwrite with plain value
    simulateCellEdit(engine, 0, 0, 'plain');
    const cell = engine.getCellStore().get(0, 0);
    expect(cell?.value).toBe('plain');
    expect(cell?.formula).toBeUndefined();
    expect(cell?.type).toBeUndefined();
    engine.destroy();
  });

  // ---- Dependency Cascade ----

  it('recalculates dependent formulas when source cell changes', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // A1 = 10
    engine.getCellStore().setValue(0, 0, 10);
    // B1 = =A1*2
    simulateCellEdit(engine, 0, 1, '=A1*2');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(20);

    // Change A1 to 50 — B1 should update to 100
    simulateCellEdit(engine, 0, 0, '50');
    // After changing A1 to plain value, B1 should recalculate
    expect(engine.getCellStore().get(0, 1)?.value).toBe(100);

    engine.destroy();
  });

  it('cascades through multiple levels of dependencies', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // A1 = 5
    engine.getCellStore().setValue(0, 0, 5);
    // B1 = =A1+1
    simulateCellEdit(engine, 0, 1, '=A1+1');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(6);

    // C1 = =B1*10
    simulateCellEdit(engine, 0, 2, '=B1*10');
    expect(engine.getCellStore().get(0, 2)?.value).toBe(60);

    // Change A1 — both B1 and C1 should update
    simulateCellEdit(engine, 0, 0, '10');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(11);
    expect(engine.getCellStore().get(0, 2)?.value).toBe(110);

    engine.destroy();
  });

  // ---- Circular Reference Detection ----

  it('detects indirect circular reference A→B→A', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // A1 = =B1
    simulateCellEdit(engine, 0, 0, '=B1');
    expect(engine.getCellStore().get(0, 0)?.value).toBe(0); // B1 is empty → 0

    // B1 = =A1 (circular)
    simulateCellEdit(engine, 0, 1, '=A1');
    expect(engine.getCellStore().get(0, 1)?.value).toBe('#REF!');

    engine.destroy();
  });

  // ---- Undo/Redo Recalculation ----

  it('recalculates formulas on commandUndo event', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // Set A1 = 10, B1 = =A1*2
    engine.getCellStore().setValue(0, 0, 10);
    simulateCellEdit(engine, 0, 1, '=A1*2');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(20);

    // Simulate undo restoring the formula value to raw string
    engine.getCellStore().setValue(0, 1, '=A1*2');
    engine.getEventBus().emit('commandUndo', { description: 'test' });

    // Formula should be re-evaluated
    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(20);
    expect(cell?.formula).toBe('=A1*2');

    engine.destroy();
  });

  it('recalculates formulas on commandRedo event', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // Set A1 = 5
    engine.getCellStore().setValue(0, 0, 5);
    // B1 formula
    simulateCellEdit(engine, 0, 1, '=A1+10');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(15);

    // Simulate redo changing A1
    engine.getCellStore().setValue(0, 0, 100);
    engine.getEventBus().emit('commandRedo', { description: 'test' });

    expect(engine.getCellStore().get(0, 1)?.value).toBe(110);

    engine.destroy();
  });

  // ---- Init Existing Formulas ----

  it('processes formulas that exist in CellStore before plugin install', () => {
    const engine = createEngine();

    // Pre-populate with formula before plugin is installed
    engine.getCellStore().set(0, 0, { value: 10 });
    engine.getCellStore().set(0, 1, { value: '=A1+5', formula: '=A1+5' });

    engine.installPlugin(new FormulaPlugin());

    // Formula should have been evaluated on init
    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(15);
    expect(cell?.formula).toBe('=A1+5');

    engine.destroy();
  });

  it('processes formula cells with raw formula string as value', () => {
    const engine = createEngine();

    // Cell has formula string as value (no formula metadata)
    engine.getCellStore().set(0, 0, { value: 42 });
    engine.getCellStore().set(0, 1, { value: '=A1*2' });

    engine.installPlugin(new FormulaPlugin());

    const cell = engine.getCellStore().get(0, 1);
    expect(cell?.value).toBe(84);
    expect(cell?.formula).toBe('=A1*2');

    engine.destroy();
  });

  // ---- DependencyGraph Access ----

  it('exposes dependency graph for inspection', () => {
    const engine = createEngine();
    const plugin = new FormulaPlugin();
    engine.installPlugin(plugin);

    engine.getCellStore().setValue(0, 0, 10);
    simulateCellEdit(engine, 0, 1, '=A1+1');

    const graph = plugin.getDependencyGraph();
    // B1 (0:1) depends on A1 (0:0)
    expect(graph.getDirectDependencies('0:1')).toContain('0:0');
    expect(graph.getDirectDependents('0:0')).toContain('0:1');

    engine.destroy();
  });

  // ---- InlineEditor Formula Display ----

  it('InlineEditor shows formula string when editing formula cell', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // Set up formula cell
    simulateCellEdit(engine, 0, 0, '=1+2');
    expect(engine.getCellStore().get(0, 0)?.value).toBe(3);

    // Open editor on formula cell
    const editor = engine.getInlineEditor()!;
    editor.open(0, 0);

    // The editor textarea should show the formula, not the computed value
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('=1+2');

    editor.close('cancel');
    engine.destroy();
  });

  // ---- Multiple Formulas ----

  it('handles multiple independent formulas', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    simulateCellEdit(engine, 0, 0, '=1+1');
    simulateCellEdit(engine, 1, 0, '=2+2');
    simulateCellEdit(engine, 2, 0, '=3+3');

    expect(engine.getCellStore().get(0, 0)?.value).toBe(2);
    expect(engine.getCellStore().get(1, 0)?.value).toBe(4);
    expect(engine.getCellStore().get(2, 0)?.value).toBe(6);

    engine.destroy();
  });

  it('handles formula referencing another formula', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    // A1 = =10+5
    simulateCellEdit(engine, 0, 0, '=10+5');
    expect(engine.getCellStore().get(0, 0)?.value).toBe(15);

    // B1 = =A1*2
    simulateCellEdit(engine, 0, 1, '=A1*2');
    expect(engine.getCellStore().get(0, 1)?.value).toBe(30);

    engine.destroy();
  });

  // ---- AVERAGE, COUNT, MIN, MAX Functions ----

  it('evaluates AVERAGE function', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    engine.getCellStore().setValue(0, 0, 10);
    engine.getCellStore().setValue(1, 0, 20);
    engine.getCellStore().setValue(2, 0, 30);

    simulateCellEdit(engine, 0, 1, '=AVERAGE(A1:A3)');

    expect(engine.getCellStore().get(0, 1)?.value).toBe(20);
    engine.destroy();
  });

  it('evaluates MIN and MAX functions', () => {
    const engine = createEngine();
    engine.installPlugin(new FormulaPlugin());

    engine.getCellStore().setValue(0, 0, 15);
    engine.getCellStore().setValue(1, 0, 5);
    engine.getCellStore().setValue(2, 0, 25);

    simulateCellEdit(engine, 0, 1, '=MIN(A1:A3)');
    simulateCellEdit(engine, 0, 2, '=MAX(A1:A3)');

    expect(engine.getCellStore().get(0, 1)?.value).toBe(5);
    expect(engine.getCellStore().get(0, 2)?.value).toBe(25);
    engine.destroy();
  });
});
