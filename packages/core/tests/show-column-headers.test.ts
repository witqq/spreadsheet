// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { EventTranslator } from '../src/events/event-translator';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { EventBus } from '../src/events/event-bus';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { lightTheme } from '../src/themes/built-in-themes';
import type { ColumnDef } from '../src/types/interfaces';

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
    strokeRect: vi.fn(),
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const columns: ColumnDef[] = [
  { key: 'a', title: 'A', width: 100 },
  { key: 'b', title: 'B', width: 120 },
  { key: 'c', title: 'C', width: 80 },
];

function makeData(): Record<string, unknown>[] {
  return [
    { a: 'A0', b: 'B0', c: 'C0' },
    { a: 'A1', b: 'B1', c: 'C1' },
    { a: 'A2', b: 'B2', c: 'C2' },
  ];
}

function createEngine(config: Partial<ConstructorParameters<typeof SpreadsheetEngine>[0]> = {}) {
  return new SpreadsheetEngine({
    columns,
    data: makeData(),
    ...config,
  });
}

describe('showColumnHeaders', () => {
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
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  describe('default behavior (showColumnHeaders=true)', () => {
    it('shows headers by default', () => {
      const engine = createEngine();
      engine.mount(container);

      const le = engine.getLayoutEngine();
      expect(le.headerHeight).toBe(lightTheme.dimensions.headerHeight);
      expect(le.headerHeight).toBeGreaterThan(0);
      engine.destroy();
    });

    it('cell y-positions are offset by header height', () => {
      const engine = createEngine();
      engine.mount(container);

      const le = engine.getLayoutEngine();
      const rect = le.getCellRect(0, 0);
      expect(rect.y).toBe(lightTheme.dimensions.headerHeight);
      engine.destroy();
    });
  });

  describe('showColumnHeaders=false', () => {
    it('sets header height to zero in LayoutEngine', () => {
      const engine = createEngine({ showColumnHeaders: false });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      expect(le.headerHeight).toBe(0);
      engine.destroy();
    });

    it('data renders from y=0', () => {
      const engine = createEngine({ showColumnHeaders: false });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      const rect = le.getCellRect(0, 0);
      expect(rect.y).toBe(0);
      engine.destroy();
    });

    it('total height excludes header height', () => {
      const engine = createEngine({ showColumnHeaders: false });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      const totalWithout = le.totalHeight;

      engine.destroy();

      const engine2 = createEngine({ showColumnHeaders: true });
      engine2.mount(container);

      const le2 = engine2.getLayoutEngine();
      const totalWith = le2.totalHeight;

      expect(totalWithout).toBe(totalWith - lightTheme.dimensions.headerHeight);
      engine2.destroy();
    });

    it('selection still works without headers', () => {
      const engine = createEngine({ showColumnHeaders: false, editable: true });
      engine.mount(container);

      const sm = engine.getSelectionManager();
      sm.selectCell(1, 1);
      const sel = sm.getSelection();
      expect(sel.activeCell).toEqual({ row: 1, col: 1 });
      expect(sel.type).toBe('cell');
      engine.destroy();
    });

    it('frozen rows position from y=0', () => {
      const engine = createEngine({
        showColumnHeaders: false,
        frozenRows: 1,
      });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      const rect = le.getCellRect(0, 0);
      expect(rect.y).toBe(0);
      engine.destroy();
    });

    it('second row y = first row height when headers hidden', () => {
      const engine = createEngine({ showColumnHeaders: false });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      const rect0 = le.getCellRect(0, 0);
      const rect1 = le.getCellRect(1, 0);
      expect(rect1.y).toBe(rect0.y + rect0.height);
      engine.destroy();
    });

    it('mounts and renders without error', () => {
      const engine = createEngine({ showColumnHeaders: false });
      expect(() => engine.mount(container)).not.toThrow();
      engine.destroy();
    });
  });

  describe('GridGeometry integration', () => {
    it('returns headerHeight=0 when showColumnHeaders=false', () => {
      const geo = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
        showColumnHeaders: false,
      });
      expect(geo.headerHeight).toBe(0);
    });

    it('returns theme headerHeight when showColumnHeaders=true', () => {
      const geo = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
        showColumnHeaders: true,
      });
      expect(geo.headerHeight).toBe(lightTheme.dimensions.headerHeight);
    });

    it('defaults to showing headers', () => {
      const geo = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
      });
      expect(geo.headerHeight).toBe(lightTheme.dimensions.headerHeight);
    });

    it('cell rects start at y=0 without headers', () => {
      const geo = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
        showColumnHeaders: false,
      });
      const rect = geo.computeCellRect(0, 0);
      expect(rect.y).toBe(0);
    });

    it('column header rects have height 0 without headers', () => {
      const geo = new GridGeometry({
        columns,
        theme: lightTheme,
        showRowNumbers: false,
        showColumnHeaders: false,
      });
      const colRects = geo.computeColumnRects();
      expect(colRects[0].height).toBe(0);
    });
  });

  describe('event translation', () => {
    it('click at y=0 hits data area when headers hidden (via LayoutEngine)', () => {
      const engine = createEngine({ showColumnHeaders: false });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      expect(le!.headerHeight).toBe(0);
      const rect = le!.getCellRect(0, 0);
      expect(rect.y).toBe(0);
      engine.destroy();
    });

    it('header area has positive height when headers shown', () => {
      const engine = createEngine({ showColumnHeaders: true });
      engine.mount(container);

      const le = engine.getLayoutEngine();
      expect(le!.headerHeight).toBeGreaterThan(0);
      const rect = le!.getCellRect(0, 0);
      expect(rect.y).toBe(le!.headerHeight);
      engine.destroy();
    });
  });

  describe('EventTranslator with hidden headers', () => {
    it('hitTest returns cell region at y=5 when headerHeight=0', () => {
      const le = new LayoutEngine({
        columns,
        rowCount: 10,
        rowHeight: 28,
        headerHeight: 0,
        rowNumberWidth: 0,
      });

      const scrollMgr = new ScrollManager({
        container,
        totalWidth: le.totalWidth,
        totalHeight: le.totalHeight,
        onScroll: () => {},
      });

      const eventBus = new EventBus();
      const cellStore = new CellStore();
      cellStore.bulkLoad([{ a: 'x', b: 'y', c: 'z' }], ['a', 'b', 'c']);

      const translator = new EventTranslator({
        scrollContainer: scrollMgr.getElement(),
        layoutEngine: le,
        scrollManager: scrollMgr,
        eventBus,
        cellStore,
        dataView: new DataView({ totalRowCount: 1 }),
        columns,
      });

      const hit = translator.hitTest(50, 5, 0, 0);
      expect(hit.region).toBe('cell');
      expect(hit.row).toBe(0);
      expect(hit.col).toBe(0);

      translator.detach();
      scrollMgr.destroy();
    });

    it('hitTest never returns header region when headerHeight=0', () => {
      const le = new LayoutEngine({
        columns,
        rowCount: 10,
        rowHeight: 28,
        headerHeight: 0,
        rowNumberWidth: 0,
      });

      const scrollMgr = new ScrollManager({
        container,
        totalWidth: le.totalWidth,
        totalHeight: le.totalHeight,
        onScroll: () => {},
      });

      const eventBus = new EventBus();
      const cellStore = new CellStore();

      const translator = new EventTranslator({
        scrollContainer: scrollMgr.getElement(),
        layoutEngine: le,
        scrollManager: scrollMgr,
        eventBus,
        cellStore,
        dataView: new DataView({ totalRowCount: 10 }),
        columns,
      });

      // Test various y positions — none should return header
      for (const y of [0, 1, 10, 28, 100]) {
        const hit = translator.hitTest(50, y, 0, 0);
        expect(hit.region).not.toBe('header');
        expect(hit.region).not.toBe('header-sort-icon');
        expect(hit.region).not.toBe('header-filter-icon');
      }

      translator.detach();
      scrollMgr.destroy();
    });

    it('hitTest returns header region for normal headerHeight=32', () => {
      const le = new LayoutEngine({
        columns,
        rowCount: 10,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 0,
      });

      const scrollMgr = new ScrollManager({
        container,
        totalWidth: le.totalWidth,
        totalHeight: le.totalHeight,
        onScroll: () => {},
      });

      const eventBus = new EventBus();
      const cellStore = new CellStore();

      const translator = new EventTranslator({
        scrollContainer: scrollMgr.getElement(),
        layoutEngine: le,
        scrollManager: scrollMgr,
        eventBus,
        cellStore,
        dataView: new DataView({ totalRowCount: 10 }),
        columns,
      });

      const hit = translator.hitTest(50, 10, 0, 0);
      expect(hit.region).toBe('header');

      translator.detach();
      scrollMgr.destroy();
    });
  });
});
