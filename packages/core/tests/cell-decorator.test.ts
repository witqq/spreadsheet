// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { CellDecorator, HitZone } from '../src/types/cell-type-registry';
import { EventTranslator } from '../src/events/event-translator';
import { EventBus } from '../src/events/event-bus';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { CellTextLayer } from '../src/renderer/layers/cell-text-layer';
import { TextMeasureCache } from '../src/renderer/text-measure-cache';
import type { ColumnDef } from '../src/types/interfaces';

// --- Helpers ---

function makeColumns(): ColumnDef[] {
  return [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'value', title: 'Value', width: 100 },
  ];
}

/** Create a left-position decorator with a fixed width and optional hit zone. */
function leftDecorator(id: string, width: number, hitZones?: HitZone[]): CellDecorator {
  return {
    id,
    position: 'left',
    getWidth: () => width,
    render: vi.fn(),
    ...(hitZones ? { getHitZones: () => hitZones } : {}),
  };
}

/** Create a right-position decorator. */
function rightDecorator(id: string, width: number, hitZones?: HitZone[]): CellDecorator {
  return {
    id,
    position: 'right',
    getWidth: () => width,
    render: vi.fn(),
    ...(hitZones ? { getHitZones: () => hitZones } : {}),
  };
}

/** Create an overlay decorator. */
function overlayDecorator(id: string, hitZones?: HitZone[]): CellDecorator {
  return {
    id,
    position: 'overlay',
    render: vi.fn(),
    ...(hitZones ? { getHitZones: () => hitZones } : {}),
  };
}

describe('Cell Decorator API', () => {
  describe('CellTypeRegistry — decorator registration', () => {
    let registry: CellTypeRegistry;

    beforeEach(() => {
      registry = new CellTypeRegistry();
    });

    it('registers and retrieves decorators for matching cells', () => {
      const dec = leftDecorator('icon', 20);
      registry.addDecorator({
        decorator: dec,
        appliesTo: () => true,
      });

      const result = registry.getDecorators(0, 0, { value: 'hello' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('icon');
    });

    it('filters decorators by applicability predicate', () => {
      const dec1 = leftDecorator('numbers-only', 20);
      const dec2 = leftDecorator('strings-only', 20);

      registry.addDecorator({
        decorator: dec1,
        appliesTo: (_row, _col, cellData) => typeof cellData.value === 'number',
      });
      registry.addDecorator({
        decorator: dec2,
        appliesTo: (_row, _col, cellData) => typeof cellData.value === 'string',
      });

      const forNumber = registry.getDecorators(0, 0, { value: 42 });
      expect(forNumber).toHaveLength(1);
      expect(forNumber[0].id).toBe('numbers-only');

      const forString = registry.getDecorators(0, 0, { value: 'text' });
      expect(forString).toHaveLength(1);
      expect(forString[0].id).toBe('strings-only');
    });

    it('returns empty array when no decorators match', () => {
      registry.addDecorator({
        decorator: leftDecorator('conditional', 20),
        appliesTo: () => false,
      });

      expect(registry.getDecorators(0, 0, { value: 'x' })).toHaveLength(0);
    });

    it('removes decorator by ID', () => {
      registry.addDecorator({
        decorator: leftDecorator('removable', 20),
        appliesTo: () => true,
      });

      expect(registry.getDecorators(0, 0, { value: 'x' })).toHaveLength(1);
      registry.removeDecorator('removable');
      expect(registry.getDecorators(0, 0, { value: 'x' })).toHaveLength(0);
    });

    it('removeDecorator is no-op for unknown ID', () => {
      registry.addDecorator({
        decorator: leftDecorator('keep', 20),
        appliesTo: () => true,
      });

      registry.removeDecorator('nonexistent');
      expect(registry.getDecorators(0, 0, { value: 'x' })).toHaveLength(1);
    });

    it('returns multiple decorators for the same cell', () => {
      registry.addDecorator({
        decorator: leftDecorator('icon1', 16),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: rightDecorator('icon2', 16),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: overlayDecorator('badge'),
        appliesTo: () => true,
      });

      expect(registry.getDecorators(0, 0, { value: 'x' })).toHaveLength(3);
    });

    it('passes row and col to applicability predicate', () => {
      const predicate = vi.fn(() => true);
      registry.addDecorator({
        decorator: leftDecorator('test', 10),
        appliesTo: predicate,
      });

      registry.getDecorators(5, 3, { value: 'value' });
      expect(predicate).toHaveBeenCalledWith(5, 3, { value: 'value' });
    });
  });

  describe('CellTextLayer — decorator rendering integration', () => {
    let registry: CellTypeRegistry;
    let cellStore: CellStore;
    let dataView: DataView;
    let measureCache: TextMeasureCache;

    // Track render calls for decorators
    let renderCalls: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;

    // Mock CanvasRenderingContext2D
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      registry = new CellTypeRegistry();
      const columns = makeColumns();
      cellStore = new CellStore();
      dataView = new DataView({ cellStore, columns });
      measureCache = new TextMeasureCache();
      renderCalls = [];

      // Create mock canvas context with all required methods
      ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 40 })),
        font: '',
        fillStyle: '',
        textBaseline: '',
        textAlign: '',
      } as unknown as CanvasRenderingContext2D;
    });

    function makeRenderContext() {
      const columns = makeColumns();

      const geometry = {
        getVisibleColumns: () => columns,
        computeColumnRects: () =>
          columns.map((col, i) => ({
            x: 50 + columns.slice(0, i).reduce((s, c) => s + c.width, 0),
            width: col.width,
          })),
        getRowY: (r: number) => r * 28,
        getRowHeight: () => 28,
        headerHeight: 32,
        cellPadding: 6,
        rowNumberWidth: 50,
      };

      return {
        ctx,
        geometry,
        theme: {
          fonts: { cell: 'Arial', cellSize: 13 },
          colors: { cellText: '#000' },
        },
        viewport: { startRow: 0, endRow: 2, startCol: 0, endCol: 1 },
        scrollX: 0,
        scrollY: 0,
        canvasWidth: 400,
        canvasHeight: 200,
        mergeManager: undefined,
      } as never;
    }

    function trackingDecorator(
      id: string,
      position: 'left' | 'right' | 'overlay' | 'underlay',
      width?: number,
    ): CellDecorator {
      return {
        id,
        position,
        ...(width !== undefined ? { getWidth: () => width } : {}),
        render: (_ctx, _cellData, x, y, w, h) => {
          renderCalls.push({ id, x, y, width: w, height: h });
        },
      };
    }

    it('renders left decorator in reserved area', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = trackingDecorator('left-icon', 'left', 24);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      const call = renderCalls.find((c) => c.id === 'left-icon');
      expect(call).toBeDefined();
      expect(call!.width).toBe(24);
      // Left decorator starts at cellX
      expect(call!.x).toBe(50);
    });

    it('renders right decorator in reserved area at right edge', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = trackingDecorator('right-icon', 'right', 20);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      const call = renderCalls.find((c) => c.id === 'right-icon');
      expect(call).toBeDefined();
      expect(call!.width).toBe(20);
      // Right decorator at cellX + cellWidth - decoratorWidth = 50 + 120 - 20
      expect(call!.x).toBe(150);
    });

    it('renders underlay decorator before text (full cell area)', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = trackingDecorator('bg-highlight', 'underlay');
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      const call = renderCalls.find((c) => c.id === 'bg-highlight');
      expect(call).toBeDefined();
      expect(call!.width).toBe(120); // full cell width
    });

    it('renders overlay decorator after text (full cell area)', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = trackingDecorator('badge', 'overlay');
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      const call = renderCalls.find((c) => c.id === 'badge');
      expect(call).toBeDefined();
      expect(call!.width).toBe(120); // full cell width
    });

    it('renders multiple decorators composed on the same cell', () => {
      cellStore.set(0, 0, { value: 'hello' });

      registry.addDecorator({
        decorator: trackingDecorator('left1', 'left', 16),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: trackingDecorator('left2', 'left', 12),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: trackingDecorator('right1', 'right', 20),
        appliesTo: () => true,
      });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      // Both left decorators rendered sequentially
      const left1 = renderCalls.find((c) => c.id === 'left1');
      const left2 = renderCalls.find((c) => c.id === 'left2');
      const right1 = renderCalls.find((c) => c.id === 'right1');

      expect(left1).toBeDefined();
      expect(left2).toBeDefined();
      expect(right1).toBeDefined();

      // left1 starts at cellX, left2 starts after left1
      expect(left1!.x).toBe(50);
      expect(left2!.x).toBe(50 + 16);

      // right1 at cellX + cellWidth - rightWidth = 50 + 120 - 20
      expect(right1!.x).toBe(150);
    });

    it('decorators reduce text available width (left shifts text x)', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const fillTextCalls: Array<[string, number, number]> = [];
      (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation(
        (text: string, x: number, y: number) => {
          fillTextCalls.push([text, x, y]);
        },
      );

      // Without decorators
      const layerNoDecorators = new CellTextLayer(
        cellStore,
        dataView,
        measureCache,
        new CellTypeRegistry(),
      );
      layerNoDecorators.render(makeRenderContext());
      const baseX = fillTextCalls[0]?.[1];
      fillTextCalls.length = 0;

      // With left decorator (24px)
      registry.addDecorator({
        decorator: trackingDecorator('spacer', 'left', 24),
        appliesTo: () => true,
      });

      const layerWithDecorator = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layerWithDecorator.render(makeRenderContext());
      const shiftedX = fillTextCalls[0]?.[1];

      // Text x should shift right by decorator width
      expect(shiftedX).toBe(baseX + 24);
    });

    it('render order: underlay → left/right → text → overlay', () => {
      cellStore.set(0, 0, { value: 'hello' });
      const callOrder: string[] = [];

      const makeDec = (
        id: string,
        pos: 'left' | 'right' | 'overlay' | 'underlay',
        w?: number,
      ): CellDecorator => ({
        id,
        position: pos,
        ...(w ? { getWidth: () => w } : {}),
        render: () => {
          callOrder.push(id);
        },
      });

      registry.addDecorator({
        decorator: makeDec('underlay1', 'underlay'),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: makeDec('left1', 'left', 10),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: makeDec('right1', 'right', 10),
        appliesTo: () => true,
      });
      registry.addDecorator({
        decorator: makeDec('overlay1', 'overlay'),
        appliesTo: () => true,
      });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      layer.render(makeRenderContext());

      // underlay before left/right, overlay after text
      expect(callOrder.indexOf('underlay1')).toBeLessThan(callOrder.indexOf('left1'));
      expect(callOrder.indexOf('left1')).toBeLessThan(callOrder.indexOf('overlay1'));
      expect(callOrder.indexOf('right1')).toBeLessThan(callOrder.indexOf('overlay1'));
    });

    it('survives a throwing render() callback without crashing the pipeline', () => {
      cellStore.set(0, 0, { value: 'test' });

      const throwingDecorator: CellDecorator = {
        id: 'broken',
        position: 'left',
        getWidth: () => 20,
        render: () => {
          throw new Error('decorator crash');
        },
      };

      const goodDecorator: CellDecorator = {
        id: 'good',
        position: 'overlay',
        render: vi.fn(),
      };

      registry.addDecorator({ decorator: throwingDecorator, appliesTo: () => true });
      registry.addDecorator({ decorator: goodDecorator, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      // Should not throw — broken decorator is caught and skipped
      expect(() => layer.render(makeRenderContext())).not.toThrow();
      // Good decorator still renders
      expect(goodDecorator.render).toHaveBeenCalled();
    });

    it('survives a throwing getWidth() callback without crashing the pipeline', () => {
      cellStore.set(0, 0, { value: 'test' });

      const throwingDecorator: CellDecorator = {
        id: 'broken-width',
        position: 'left',
        getWidth: () => {
          throw new Error('getWidth crash');
        },
        render: vi.fn(),
      };

      registry.addDecorator({ decorator: throwingDecorator, appliesTo: () => true });

      const layer = new CellTextLayer(cellStore, dataView, measureCache, registry);
      expect(() => layer.render(makeRenderContext())).not.toThrow();
    });
  });

  describe('EventTranslator — decorator hit zone resolution', () => {
    const headerHeight = 32;
    const rowHeight = 28;
    const rowNumberWidth = 50;
    let container: HTMLDivElement;
    let layoutEngine: LayoutEngine;
    let scrollManager: ScrollManager;
    let eventBus: EventBus;
    let cellStore: CellStore;
    let dataView: DataView;
    let registry: CellTypeRegistry;

    function createTranslator(columns: ColumnDef[]): EventTranslator {
      return new EventTranslator({
        scrollContainer: scrollManager.getElement(),
        layoutEngine,
        scrollManager,
        eventBus,
        columns,
        dataView,
        cellStore,
        cellTypeRegistry: registry,
      });
    }

    beforeEach(() => {
      const columns = makeColumns();
      container = document.createElement('div');
      document.body.appendChild(container);
      eventBus = new EventBus();
      cellStore = new CellStore();
      registry = new CellTypeRegistry();

      layoutEngine = new LayoutEngine({
        columns,
        rowHeight,
        rowCount: 10,
        headerHeight,
        rowNumberWidth,
      });

      scrollManager = new ScrollManager({
        container,
        totalWidth: layoutEngine.totalWidth,
        totalHeight: layoutEngine.totalHeight,
        onScroll: () => {},
      });

      dataView = new DataView({ cellStore, columns });
    });

    afterEach(() => {
      container.remove();
    });

    it('resolves left decorator hit zone with correct cell-relative offset', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = leftDecorator('edit-btn', 24, [
        { id: 'edit', x: 4, y: 4, width: 16, height: 20, cursor: 'pointer' },
      ]);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const translator = createTranslator(makeColumns());
      // Cell 0,0 in content coords: x=0, y=0, w=120, h=28
      // Left decorator zone: x=4..20, y=4..24
      // contentX=10 → relX=10 (inside 4..20), contentY=8 → relY=8 (inside 4..24)
      const result = translator.resolveHitZone(0, 0, 10, 8);
      expect(result).toEqual({ id: 'edit', cursor: 'pointer' });
    });

    it('resolves right decorator hit zone at correct position', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = rightDecorator('delete-btn', 20, [
        { id: 'delete', x: 2, y: 4, width: 16, height: 20 },
      ]);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const translator = createTranslator(makeColumns());
      // Cell 0,0: content x=0, width=120
      // Right decorator: rightOffset=20, zone starts at cellW-20+2=102, ends at 102+16=118
      // contentX=105 → relX=105 (inside 102..118), contentY=8 → relY=8 (inside 4..24)
      const result = translator.resolveHitZone(0, 0, 105, 8);
      expect(result).toEqual({ id: 'delete', cursor: undefined });
    });

    it('resolves overlay decorator hit zone', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = overlayDecorator('tooltip-trigger', [
        { id: 'info', x: 50, y: 5, width: 20, height: 18 },
      ]);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const translator = createTranslator(makeColumns());
      // Overlay zone: x=50..70, y=5..23
      // contentX=55 → relX=55 (inside 50..70), contentY=10 → relY=10 (inside 5..23)
      const result = translator.resolveHitZone(0, 0, 55, 10);
      expect(result).toEqual({ id: 'info', cursor: undefined });
    });

    it('cell type renderer zones take priority over decorator zones', () => {
      cellStore.set(0, 0, { value: true, type: 'boolean' });

      // Register a boolean renderer with hit zones
      registry.register('boolean', {
        format: (v) => String(v),
        align: 'center',
        getHitZones: (_value, _w, _h) => [{ id: 'checkbox', x: 0, y: 0, width: 120, height: 28 }],
      });

      // Also register a decorator with overlapping zone
      registry.addDecorator({
        decorator: overlayDecorator('overlay-zone', [
          { id: 'overlay-hit', x: 0, y: 0, width: 120, height: 28 },
        ]),
        appliesTo: () => true,
      });

      const columns = makeColumns();
      columns[0].type = 'boolean';
      const translator = createTranslator(columns);
      // contentX=30 → relX=30 (inside checkbox 0..120), contentY=10 → relY=10 (inside 0..28)
      const result = translator.resolveHitZone(0, 0, 30, 10);
      // Cell type renderer zones checked first
      expect(result?.id).toBe('checkbox');
    });

    it('returns undefined for click outside all decorator zones', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = leftDecorator('narrow', 10, [{ id: 'btn', x: 0, y: 0, width: 10, height: 10 }]);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const translator = createTranslator(makeColumns());
      // Decorator zone: x=0..10, y=0..10
      // contentX=60 → relX=60 (outside), contentY=20 → relY=20 (outside)
      const result = translator.resolveHitZone(0, 0, 60, 20);
      expect(result).toBeUndefined();
    });

    it('decorator hit zones carry through to cellClick event', () => {
      cellStore.set(0, 0, { value: 'hello' });

      const dec = leftDecorator('action', 30, [
        { id: 'act', x: 0, y: 0, width: 30, height: 28, cursor: 'pointer' },
      ]);
      registry.addDecorator({ decorator: dec, appliesTo: () => true });

      const translator = createTranslator(makeColumns());

      // hitTest with offsetX=60 (50 rowNumberWidth + 10), offsetY=42 (32 headerHeight + 10)
      // → contentX=10, contentY=10 → row=0, col=0 → relX=10, relY=10 (inside zone 0..30, 0..28)
      const hitResult = translator.hitTest(60, 42);
      expect(hitResult.region).toBe('cell');
      expect(hitResult.row).toBe(0);
      expect(hitResult.col).toBe(0);
      expect(hitResult.hitZone).toBe('act');
      expect(hitResult.hitZoneCursor).toBe('pointer');
    });

    it('survives a throwing getHitZones() callback without crashing hit testing', () => {
      cellStore.set(0, 0, { value: 'test' });
      const columns = makeColumns();

      const throwingDecorator: CellDecorator = {
        id: 'broken-zones',
        position: 'left',
        getWidth: () => 20,
        render: vi.fn(),
        getHitZones: () => {
          throw new Error('getHitZones crash');
        },
      };

      registry.addDecorator({ decorator: throwingDecorator, appliesTo: () => true });

      const translator = createTranslator(columns);
      // Should not throw — broken getHitZones is caught
      const result = translator.hitTest(60, 42);
      expect(result.region).toBe('cell');
      expect(result.row).toBe(0);
      // hitZone should be undefined since the only decorator threw
      expect(result.hitZone).toBeUndefined();
    });
  });
});
