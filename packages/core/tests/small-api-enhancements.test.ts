// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventTranslator } from '../src/events/event-translator';
import { EventBus } from '../src/events/event-bus';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import { ClipboardManager } from '../src/clipboard/clipboard-manager';
import { SelectionManager } from '../src/selection/selection-manager';
import { CommandManager } from '../src/commands/command-manager';
import type { CellTypeRenderer, HitZone } from '../src/types/cell-type-registry';
import type { ColumnDef } from '../src/types/interfaces';
import type { ClipboardPasteEvent, CellEvent } from '../src/events/event-types';

// =============================================================================
// Helpers
// =============================================================================

function makeColumns(): ColumnDef[] {
  return [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'age', title: 'Age', width: 80, type: 'number' },
    { key: 'city', title: 'City', width: 100 },
  ];
}

function mouseEvent(
  type: string,
  offsetX: number,
  offsetY: number,
  opts?: { shiftKey?: boolean; ctrlKey?: boolean },
): MouseEvent {
  const e = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: offsetX,
    clientY: offsetY,
    shiftKey: opts?.shiftKey,
    ctrlKey: opts?.ctrlKey,
  });
  Object.defineProperty(e, 'offsetX', { value: offsetX });
  Object.defineProperty(e, 'offsetY', { value: offsetY });
  return e;
}

function createClipboardEvent(
  type: 'copy' | 'cut' | 'paste',
  data?: Record<string, string>,
): ClipboardEvent {
  const clipboardData: DataTransfer = {
    data: {} as Record<string, string>,
    setData(format: string, value: string) {
      this.data[format] = value;
    },
    getData(format: string) {
      return this.data[format] ?? '';
    },
  } as unknown as DataTransfer;

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      clipboardData.setData(key, value);
    }
  }

  const event = new Event(type, { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  return event;
}

// =============================================================================
// 1. HitZone Padding
// =============================================================================

describe('HitZone Padding', () => {
  const headerHeight = 32;
  const rowHeight = 28;
  const rowNumberWidth = 50;
  let container: HTMLDivElement;
  let scrollContainer: HTMLDivElement;
  let layoutEngine: LayoutEngine;
  let scrollManager: ScrollManager;
  let eventBus: EventBus;
  let cellStore: CellStore;
  let cellTypeRegistry: CellTypeRegistry;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);

    eventBus = new EventBus();
    cellStore = new CellStore();
    cellTypeRegistry = new CellTypeRegistry();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function createTranslator(zones: HitZone[]): EventTranslator {
    const cols: ColumnDef[] = [
      { key: 'action', title: 'Action', width: 120, type: 'custom' },
    ];

    const renderer: CellTypeRenderer = {
      format: (v) => String(v ?? ''),
      render: () => {},
      getHitZones: () => zones,
    };
    cellTypeRegistry.register('custom', renderer);

    layoutEngine = new LayoutEngine({
      columns: cols,
      rowCount: 100,
      rowHeight,
      headerHeight,
      rowNumberWidth,
    });

    scrollManager = new ScrollManager({
      container,
      totalWidth: layoutEngine.totalWidth,
      totalHeight: layoutEngine.totalHeight,
      onScroll: () => {},
    });
    scrollContainer = scrollManager.getElement();

    cellStore.setValue(0, 0, 'test');

    const translator = new EventTranslator({
      scrollContainer,
      layoutEngine,
      scrollManager,
      eventBus,
      cellStore,
      dataView: new DataView({ totalRowCount: 100 }),
      columns: cols,
      cellTypeRegistry,
    });

    return translator;
  }

  it('detects hit inside zone without padding', () => {
    // Zone at (10, 5) size 20x20 in cell (0,0)
    const translator = createTranslator([{ id: 'btn', x: 10, y: 5, width: 20, height: 20 }]);
    // Cell (0,0): x starts at rowNumberWidth(50), y at headerHeight(32)
    // relX = offsetX - rowNumberWidth - cellX = offsetX - 50 - 0
    // relY = offsetY - headerHeight - cellY = offsetY - 32 - 0
    // For relX=15, relY=10 → offsetX=65, offsetY=42
    const result = translator.hitTest(65, 42);
    expect(result.region).toBe('cell');
    expect(result.hitZone).toBe('btn');
    translator.detach();
    scrollManager.destroy();
  });

  it('misses zone without padding', () => {
    const translator = createTranslator([{ id: 'btn', x: 10, y: 5, width: 20, height: 20 }]);
    // relX=5 (before zone.x=10) → offsetX=55
    const result = translator.hitTest(55, 42);
    expect(result.region).toBe('cell');
    expect(result.hitZone).toBeUndefined();
    translator.detach();
    scrollManager.destroy();
  });

  it('detects hit in padding area with uniform padding', () => {
    const translator = createTranslator([
      { id: 'btn', x: 10, y: 5, width: 20, height: 20, padding: 8 },
    ]);
    // Zone x range: 10..30, with padding=8 → effective: 2..38
    // relX=5 is inside effective range (>= 2)
    // offsetX = 50 + 5 = 55
    const result = translator.hitTest(55, 42);
    expect(result.region).toBe('cell');
    expect(result.hitZone).toBe('btn');
    translator.detach();
    scrollManager.destroy();
  });

  it('detects hit in padding area with per-side padding', () => {
    const translator = createTranslator([
      {
        id: 'btn',
        x: 10,
        y: 5,
        width: 20,
        height: 20,
        padding: { top: 0, right: 0, bottom: 0, left: 15 },
      },
    ]);
    // Zone x range: 10..30, with left padding=15 → effective left starts at -5
    // relX=0 is inside effective range (>= -5)
    // offsetX = 50 + 0 = 50
    const result = translator.hitTest(50, 42);
    expect(result.region).toBe('cell');
    expect(result.hitZone).toBe('btn');
    translator.detach();
    scrollManager.destroy();
  });

  it('misses zone even with padding when far outside', () => {
    const translator = createTranslator([
      { id: 'btn', x: 50, y: 5, width: 20, height: 20, padding: 5 },
    ]);
    // Zone effective x range: 45..75
    // relX=10 is well outside (< 45)
    // offsetX = 50 + 10 = 60
    const result = translator.hitTest(60, 42);
    expect(result.region).toBe('cell');
    expect(result.hitZone).toBeUndefined();
    translator.detach();
    scrollManager.destroy();
  });

  it('carries padded hit zone in cellClick event', () => {
    const translator = createTranslator([
      { id: 'btn', x: 10, y: 5, width: 20, height: 20, padding: 8 },
    ]);
    translator.attach();

    const handler = vi.fn<[CellEvent]>();
    eventBus.on('cellClick', handler);

    // Click in padding area: relX=5 → offsetX=55
    scrollContainer.dispatchEvent(mouseEvent('mousedown', 55, 42));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].hitZone).toBe('btn');

    translator.detach();
    scrollManager.destroy();
  });

  it('padding does not change zone visual dimensions', () => {
    const zone: HitZone = { id: 'btn', x: 10, y: 5, width: 20, height: 20, padding: 100 };
    // Padding only affects hit-testing, not the zone's reported visual dimensions
    expect(zone.width).toBe(20);
    expect(zone.height).toBe(20);
    expect(zone.x).toBe(10);
    expect(zone.y).toBe(5);
  });
});

// =============================================================================
// 2. Paste Event Coordinates
// =============================================================================

describe('ClipboardPasteEvent coordinates', () => {
  let setup: ReturnType<typeof createPasteSetup>;

  function createPasteSetup() {
    const cellStore = new CellStore();
    cellStore.setValue(0, 0, 'Alice');
    cellStore.setValue(1, 0, 'Bob');

    const selectionManager = new SelectionManager({
      rowCount: 10,
      colCount: 5,
    });

    const commandManager = new CommandManager({ historyLimit: 100 });
    const eventBus = new EventBus();
    const onDataChange = vi.fn();
    const isEditing = vi.fn(() => false);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const clipboardManager = new ClipboardManager({
      cellStore,
      dataView: new DataView({ totalRowCount: 10 }),
      selectionManager,
      commandManager,
      eventBus,
      isEditing,
      isCellEditable: () => true,
      onDataChange,
    });
    clipboardManager.attach(container);

    return {
      cellStore,
      selectionManager,
      commandManager,
      eventBus,
      onDataChange,
      container,
      clipboardManager,
      cleanup() {
        clipboardManager.detach();
        document.body.removeChild(container);
      },
    };
  }

  beforeEach(() => {
    setup = createPasteSetup();
  });

  afterEach(() => {
    setup.cleanup();
  });

  it('includes startRow and startCol in clipboardPaste event', () => {
    const handler = vi.fn();
    setup.eventBus.on('clipboardPaste', handler);
    setup.selectionManager.selectCell(2, 3);
    setup.container.dispatchEvent(
      createClipboardEvent('paste', { 'text/plain': 'X\tY\nZ\tW' }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const event: ClipboardPasteEvent = handler.mock.calls[0][0];
    expect(event.startRow).toBe(2);
    expect(event.startCol).toBe(3);
    expect(event.rowCount).toBe(2);
    expect(event.colCount).toBe(2);
  });

  it('reports coordinates from active cell at paste time', () => {
    const handler = vi.fn();
    setup.eventBus.on('clipboardPaste', handler);
    setup.selectionManager.selectCell(5, 2);
    setup.container.dispatchEvent(
      createClipboardEvent('paste', { 'text/plain': 'val' }),
    );

    const event: ClipboardPasteEvent = handler.mock.calls[0][0];
    expect(event.startRow).toBe(5);
    expect(event.startCol).toBe(2);
  });

  it('reports (0,0) when pasting at origin', () => {
    const handler = vi.fn();
    setup.eventBus.on('clipboardPaste', handler);
    setup.selectionManager.selectCell(0, 0);
    setup.container.dispatchEvent(
      createClipboardEvent('paste', { 'text/plain': 'A' }),
    );

    const event: ClipboardPasteEvent = handler.mock.calls[0][0];
    expect(event.startRow).toBe(0);
    expect(event.startCol).toBe(0);
  });
});

// =============================================================================
// 3. getScrollContainer Convenience
// =============================================================================

describe('SpreadsheetEngine.getScrollContainer()', () => {
  it('returns null before mount', async () => {
    const { SpreadsheetEngine } = await import('../src/engine/spreadsheet-engine');
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: [{ name: 'A', age: 1, city: 'B' }],
    });
    expect(engine.getScrollContainer()).toBeNull();
    engine.destroy();
  });
});
