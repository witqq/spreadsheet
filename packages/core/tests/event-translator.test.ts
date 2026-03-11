// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventTranslator } from '../src/events/event-translator';
import { EventBus } from '../src/events/event-bus';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { CellTypeRenderer, HitZone } from '../src/types/cell-type-registry';
import type { ColumnDef } from '../src/types/interfaces';
import type { CellEvent } from '../src/events/event-types';

function makeColumns(): ColumnDef[] {
  return [
    { key: 'name', title: 'Name', width: 120 },
    { key: 'age', title: 'Age', width: 80, type: 'number' },
    { key: 'city', title: 'City', width: 100 },
  ];
}

/** Create a MouseEvent with specific offsetX/offsetY. */
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
  // jsdom doesn't compute offsetX/offsetY from clientX/Y,
  // so we override them via defineProperty
  Object.defineProperty(e, 'offsetX', { value: offsetX });
  Object.defineProperty(e, 'offsetY', { value: offsetY });
  return e;
}

describe('EventTranslator', () => {
  const headerHeight = 32;
  const rowHeight = 28;
  const rowNumberWidth = 50;
  let container: HTMLDivElement;
  let scrollContainer: HTMLDivElement;
  let layoutEngine: LayoutEngine;
  let scrollManager: ScrollManager;
  let eventBus: EventBus;
  let cellStore: CellStore;
  let translator: EventTranslator;
  const columns = makeColumns();

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

    layoutEngine = new LayoutEngine({
      columns,
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

    eventBus = new EventBus();
    cellStore = new CellStore();
    cellStore.bulkLoad([{ name: 'Alice', age: 30, city: 'NYC' }], ['name', 'age', 'city']);

    translator = new EventTranslator({
      scrollContainer,
      layoutEngine,
      scrollManager,
      eventBus,
      cellStore,
      dataView: new DataView({ totalRowCount: 1 }),
      columns,
    });
  });

  afterEach(() => {
    translator.detach();
    scrollManager.destroy();
    document.body.removeChild(container);
  });

  describe('hitTest', () => {
    it('identifies corner region (top-left before header and row numbers)', () => {
      const result = translator.hitTest(10, 10);
      expect(result.region).toBe('corner');
      expect(result.row).toBe(-1);
      expect(result.col).toBe(-1);
    });

    it('identifies header region (in header, past row number gutter)', () => {
      const result = translator.hitTest(rowNumberWidth + 10, 10);
      expect(result.region).toBe('header');
      expect(result.row).toBe(-1);
      expect(result.col).toBe(0); // first column
    });

    it('identifies correct column in header click', () => {
      // Column 0 = 120px wide, starts at rowNumberWidth
      // Column 1 starts at rowNumberWidth + 120
      const result = translator.hitTest(rowNumberWidth + 130, 10);
      expect(result.region).toBe('header');
      expect(result.col).toBe(1); // second column
    });

    it('identifies row-number region', () => {
      const result = translator.hitTest(10, headerHeight + 5);
      expect(result.region).toBe('row-number');
      expect(result.row).toBe(0); // first row
      expect(result.col).toBe(-1);
    });

    it('identifies correct row in row-number click', () => {
      const result = translator.hitTest(10, headerHeight + rowHeight + 5);
      expect(result.region).toBe('row-number');
      expect(result.row).toBe(1); // second row
    });

    it('identifies cell region with correct row and column', () => {
      const result = translator.hitTest(rowNumberWidth + 10, headerHeight + 5);
      expect(result.region).toBe('cell');
      expect(result.row).toBe(0);
      expect(result.col).toBe(0);
    });

    it('identifies cell in second column, third row', () => {
      const result = translator.hitTest(
        rowNumberWidth + 130, // past first column (120px)
        headerHeight + 2 * rowHeight + 5, // third row
      );
      expect(result.region).toBe('cell');
      expect(result.row).toBe(2);
      expect(result.col).toBe(1);
    });

    it('accounts for scroll offset in cell hit-test', () => {
      // jsdom doesn't implement scrollTop, so mock the scroll position
      Object.defineProperty(scrollManager, 'scrollY', { value: 5 * rowHeight, configurable: true });

      const result = translator.hitTest(
        rowNumberWidth + 10,
        headerHeight + 5, // visually at top of cell area
      );
      expect(result.region).toBe('cell');
      expect(result.row).toBe(5); // scrolled by 5 rows
      expect(result.col).toBe(0);
    });

    it('accounts for horizontal scroll in cell hit-test', () => {
      // jsdom doesn't implement scrollLeft, so mock the scroll position
      Object.defineProperty(scrollManager, 'scrollX', { value: 100, configurable: true });

      // Column 0 is 120px wide. After scrolling 100px right,
      // clicking at rowNumberWidth + 25 → contentX = 25 + 100 = 125 → column 1
      const result = translator.hitTest(rowNumberWidth + 25, headerHeight + 5);
      expect(result.region).toBe('cell');
      expect(result.col).toBe(1);
    });

    it('returns outside for clicks beyond data bounds', () => {
      const result = translator.hitTest(
        rowNumberWidth + 500, // beyond all column widths (120+80+100=300)
        headerHeight + 5,
      );
      expect(result.region).toBe('outside');
    });

    it('identifies header-sort-icon region (rightmost 14px of header cell)', () => {
      // Column 0: 120px wide, starts at rowNumberWidth(50)
      // Sort icon zone: right 14px of rightmost 28px → x from (50+120-14) to (50+120)
      // Click at right edge of first column in header
      const result = translator.hitTest(rowNumberWidth + 120 - 5, 10);
      expect(result.region).toBe('header-sort-icon');
      expect(result.col).toBe(0);
    });

    it('identifies header-filter-icon region (14-28px from right of header cell)', () => {
      // Filter icon zone: left 14px of rightmost 28px → x from (50+120-28) to (50+120-14)
      const result = translator.hitTest(rowNumberWidth + 120 - 20, 10);
      expect(result.region).toBe('header-filter-icon');
      expect(result.col).toBe(0);
    });

    it('header click outside icon zone returns plain header', () => {
      // Click in the middle of column 0 (far from rightmost 28px)
      const result = translator.hitTest(rowNumberWidth + 30, 10);
      expect(result.region).toBe('header');
      expect(result.col).toBe(0);
    });
  });

  describe('DOM event dispatching', () => {
    it('dispatches gridMouseDown on mousedown', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      scrollContainer.dispatchEvent(mouseEvent('mousedown', rowNumberWidth + 10, headerHeight + 5));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].region).toBe('cell');
      expect(handler.mock.calls[0][0].row).toBe(0);
      expect(handler.mock.calls[0][0].col).toBe(0);
    });

    it('dispatches cellClick on mousedown in cell region', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('cellClick', handler);

      scrollContainer.dispatchEvent(mouseEvent('mousedown', rowNumberWidth + 10, headerHeight + 5));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].row).toBe(0);
      expect(handler.mock.calls[0][0].col).toBe(0);
      expect(handler.mock.calls[0][0].value).toBe('Alice');
      expect(handler.mock.calls[0][0].column.key).toBe('name');
    });

    it('dispatches cellDoubleClick on dblclick in cell region', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('cellDoubleClick', handler);

      scrollContainer.dispatchEvent(mouseEvent('dblclick', rowNumberWidth + 10, headerHeight + 5));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].row).toBe(0);
      expect(handler.mock.calls[0][0].col).toBe(0);
    });

    it('does not dispatch cellClick for header clicks', () => {
      translator.attach();
      const cellHandler = vi.fn();
      const mouseHandler = vi.fn();
      eventBus.on('cellClick', cellHandler);
      eventBus.on('gridMouseDown', mouseHandler);

      scrollContainer.dispatchEvent(
        mouseEvent('mousedown', rowNumberWidth + 10, 10), // header area
      );

      expect(cellHandler).not.toHaveBeenCalled();
      expect(mouseHandler).toHaveBeenCalledOnce();
      expect(mouseHandler.mock.calls[0][0].region).toBe('header');
    });

    it('does not dispatch cellClick for row-number clicks', () => {
      translator.attach();
      const cellHandler = vi.fn();
      const mouseHandler = vi.fn();
      eventBus.on('cellClick', cellHandler);
      eventBus.on('gridMouseDown', mouseHandler);

      scrollContainer.dispatchEvent(
        mouseEvent('mousedown', 10, headerHeight + 5), // row number area
      );

      expect(cellHandler).not.toHaveBeenCalled();
      expect(mouseHandler).toHaveBeenCalledOnce();
      expect(mouseHandler.mock.calls[0][0].region).toBe('row-number');
    });

    it('dispatches gridKeyDown on keydown', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('gridKeyDown', handler);

      scrollContainer.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].key).toBe('ArrowDown');
    });

    it('passes modifier keys in grid events', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      scrollContainer.dispatchEvent(
        mouseEvent('mousedown', rowNumberWidth + 10, headerHeight + 5, {
          shiftKey: true,
          ctrlKey: true,
        }),
      );

      expect(handler.mock.calls[0][0].shiftKey).toBe(true);
      expect(handler.mock.calls[0][0].ctrlKey).toBe(true);
    });

    it('does not dispatch after detach()', () => {
      translator.attach();
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      translator.detach();

      scrollContainer.dispatchEvent(mouseEvent('mousedown', rowNumberWidth + 10, headerHeight + 5));

      expect(handler).not.toHaveBeenCalled();
    });

    it('sets tabindex on scroll container for keyboard focus', () => {
      translator.attach();
      expect(scrollContainer.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('frozen pane hit-testing', () => {
    // Columns: [120, 80, 100] → col0 x=0..120, col1 x=120..200, col2 x=200..300
    // Rows: 28px each → row0 y=0..28, row1 y=28..56, row2 y=56..84
    // headerHeight=32, rowNumberWidth=50

    it('returns correct row for frozen row cell click when scrolled', () => {
      translator.setFrozenConfig(2, 0);
      // Frozen rows = 2 → frozenRowsHeight = 56 (2×28)
      // Frozen row zone: y in [32, 88) on screen
      vi.spyOn(scrollManager, 'scrollY', 'get').mockReturnValue(280);

      // Cell at x=60 (col0), y=40 (headerHeight+8, inside frozen row zone)
      const hit = translator.hitTest(60, 40);
      // In frozen row zone, scrollY=0, so contentY = 40-32 = 8 → row 0
      expect(hit.row).toBe(0);
    });

    it('returns correct col for frozen col cell click when scrolled', () => {
      translator.setFrozenConfig(0, 1);
      // Frozen cols = 1 → frozenColsWidth = 120 (col0 width)
      vi.spyOn(scrollManager, 'scrollX', 'get').mockReturnValue(300);

      // Cell at x=100 (inside frozen col zone), y=60 (headerHeight+28)
      const hit = translator.hitTest(100, 60);
      // In frozen col zone, scrollX=0, so contentX = 100-50 = 50 → col 0
      expect(hit.col).toBe(0);
    });

    it('returns correct cell in corner frozen region', () => {
      translator.setFrozenConfig(2, 1);
      vi.spyOn(scrollManager, 'scrollY', 'get').mockReturnValue(500);
      vi.spyOn(scrollManager, 'scrollX', 'get').mockReturnValue(400);

      // Click at (80, 45): x in frozen col zone [50,170), y in frozen row zone [32,88)
      const hit = translator.hitTest(80, 45);
      expect(hit.row).toBe(0); // contentY = 45-32 = 13 → row 0
      expect(hit.col).toBe(0); // contentX = 80-50 = 30 → col 0
    });

    it('uses full scroll offsets in main area', () => {
      translator.setFrozenConfig(2, 1);
      // frozenRowsHeight = 56, frozenColsWidth = 120
      // Main area: y >= 32+56=88, x >= 50+120=170
      vi.spyOn(scrollManager, 'scrollY', 'get').mockReturnValue(280);
      vi.spyOn(scrollManager, 'scrollX', 'get').mockReturnValue(0);

      // Click at (200, 100): x=200 > 170 (main), y=100 > 88 (main)
      const hit = translator.hitTest(200, 100);
      // contentX = 200-50+0 = 150 → col 1 (120..200)
      expect(hit.col).toBe(1);
      // contentY = 100-32+280 = 348 → row 12 (12×28=336, 13×28=364)
      expect(hit.row).toBe(12);
    });

    it('returns correct header col for frozen col header click', () => {
      translator.setFrozenConfig(0, 1);
      vi.spyOn(scrollManager, 'scrollX', 'get').mockReturnValue(300);

      // Click on header at x=80 (inside frozen col zone), y=10 (header)
      const hit = translator.hitTest(80, 10);
      expect(hit.region).toBe('header');
      // scrollX=0 for frozen col → contentX = 80-50 = 30 → col 0
      expect(hit.col).toBe(0);
    });
  });

  describe('touch event handling', () => {
    function touchEvent(
      type: 'touchstart' | 'touchmove' | 'touchend',
      clientX: number,
      clientY: number,
    ): TouchEvent {
      const touch = {
        clientX,
        clientY,
        identifier: 0,
        target: scrollContainer,
        pageX: clientX,
        pageY: clientY,
        screenX: clientX,
        screenY: clientY,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 0,
      } as Touch;
      const touches = type === 'touchend' ? [] : [touch];
      return new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches,
        changedTouches: [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
      });
    }

    beforeEach(() => {
      translator.attach();
      // Mock getBoundingClientRect so touch offsets compute correctly
      Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
        value: () => ({
          top: 0,
          left: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => {},
        }),
        configurable: true,
      });
    });

    it('sets touch-action CSS on attach', () => {
      expect(scrollContainer.style.touchAction).toBe('pan-x pan-y');
    });

    it('touch tap emits gridMouseDown and cellClick', () => {
      const mouseDownHandler = vi.fn();
      const cellClickHandler = vi.fn();
      eventBus.on('gridMouseDown', mouseDownHandler);
      eventBus.on('cellClick', cellClickHandler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      expect(mouseDownHandler).toHaveBeenCalledOnce();
      expect(mouseDownHandler.mock.calls[0][0].region).toBe('cell');
      expect(mouseDownHandler.mock.calls[0][0].row).toBe(0);
      expect(mouseDownHandler.mock.calls[0][0].col).toBe(0);
      expect(cellClickHandler).toHaveBeenCalledOnce();
    });

    it('touch tap also emits gridMouseUp', () => {
      const mouseUpHandler = vi.fn();
      eventBus.on('gridMouseUp', mouseUpHandler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      expect(mouseUpHandler).toHaveBeenCalledOnce();
    });

    it('touch scroll (movement > threshold) does not emit events', () => {
      const mouseDownHandler = vi.fn();
      eventBus.on('gridMouseDown', mouseDownHandler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchmove', x, y + 15)); // > 10px
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y + 15));

      expect(mouseDownHandler).not.toHaveBeenCalled();
    });

    it('touch tap on header emits gridMouseDown with header region', () => {
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      const x = rowNumberWidth + 10;
      const y = 10; // header area
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].region).toBe('header');
    });

    it('double-tap emits cellDoubleClick', async () => {
      const dblClickHandler = vi.fn();
      eventBus.on('cellDoubleClick', dblClickHandler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;

      // First tap
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      // Second tap quickly (within 300ms, same location)
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      expect(dblClickHandler).toHaveBeenCalledOnce();
      expect(dblClickHandler.mock.calls[0][0].row).toBe(0);
      expect(dblClickHandler.mock.calls[0][0].col).toBe(0);
    });

    it('multi-touch is ignored', () => {
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      // Create multi-touch event
      const multiTouchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [
          { clientX: 60, clientY: 40, identifier: 0, target: scrollContainer } as Touch,
          { clientX: 100, clientY: 80, identifier: 1, target: scrollContainer } as Touch,
        ],
      });
      scrollContainer.dispatchEvent(multiTouchEvent);
      scrollContainer.dispatchEvent(touchEvent('touchend', 60, 40));

      expect(handler).not.toHaveBeenCalled();
    });

    it('long press does not emit tap', () => {
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;

      // Use fake timers to control Date.now()
      vi.useFakeTimers({ now: 1000 });
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));

      // Advance past TAP_MAX_DURATION (300ms)
      vi.advanceTimersByTime(350);

      // Fire touchend — elapsed time exceeds threshold, so no tap should emit
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));
      vi.useRealTimers();

      expect(handler).not.toHaveBeenCalled();
    });

    it('touch events not dispatched after detach', () => {
      translator.detach();
      const handler = vi.fn();
      eventBus.on('gridMouseDown', handler);

      const x = rowNumberWidth + 10;
      const y = headerHeight + 5;
      scrollContainer.dispatchEvent(touchEvent('touchstart', x, y));
      scrollContainer.dispatchEvent(touchEvent('touchend', x, y));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('sub-cell hit zone resolution', () => {
    const booleanWithZones: CellTypeRenderer = {
      format: (v) => String(v),
      align: 'center',
      getHitZones: (_cellData, width, height) => {
        const size = Math.min(14, height - 6);
        const zoneX = (width - size) / 2;
        const zoneY = (height - size) / 2;
        return [
          { id: 'checkbox', x: zoneX, y: zoneY, width: size, height: size, cursor: 'pointer' },
        ];
      },
    };

    // Columns with a boolean type for hit zone testing
    const hitZoneColumns: ColumnDef[] = [
      { key: 'name', title: 'Name', width: 120 },
      { key: 'active', title: 'Active', width: 80, type: 'boolean' },
      { key: 'city', title: 'City', width: 100 },
    ];

    let registryTranslator: EventTranslator;
    let registry: CellTypeRegistry;
    let hitZoneLayout: LayoutEngine;

    beforeEach(() => {
      registry = new CellTypeRegistry();
      registry.register('boolean', booleanWithZones);

      hitZoneLayout = new LayoutEngine({
        columns: hitZoneColumns,
        rowCount: 100,
        rowHeight,
        headerHeight,
        rowNumberWidth,
      });

      registryTranslator = new EventTranslator({
        scrollContainer,
        layoutEngine: hitZoneLayout,
        scrollManager,
        eventBus,
        cellStore,
        dataView: new DataView({ totalRowCount: 1 }),
        columns: hitZoneColumns,
        cellTypeRegistry: registry,
      });
    });

    afterEach(() => {
      registryTranslator.detach();
    });

    it('resolves hit zone when click is inside zone bounds', () => {
      // Column 1 (age) is boolean type, width=80, starts at x=120
      // Row 0, height=28
      // Checkbox zone: size=14, x=(80-14)/2=33, y=(28-14)/2=7
      // Cell origin: contentX=120, contentY=0
      // Target: contentX = 120 + 33 + 5 = 158, contentY = 0 + 7 + 5 = 12
      // offsetX = contentX + rowNumberWidth = 158 + 50 = 208
      // offsetY = contentY + headerHeight = 12 + 32 = 44
      cellStore.set(0, 1, { value: true });
      const result = registryTranslator.hitTest(208, 44);

      expect(result.region).toBe('cell');
      expect(result.row).toBe(0);
      expect(result.col).toBe(1);
      expect(result.hitZone).toBe('checkbox');
      expect(result.hitZoneCursor).toBe('pointer');
    });

    it('returns undefined hitZone when click is outside zone bounds', () => {
      // Click at left edge of age column (far from checkbox center)
      cellStore.set(0, 1, { value: true });
      const result = registryTranslator.hitTest(rowNumberWidth + 121, headerHeight + 1);

      expect(result.region).toBe('cell');
      expect(result.row).toBe(0);
      expect(result.col).toBe(1);
      expect(result.hitZone).toBeUndefined();
      expect(result.hitZoneCursor).toBeUndefined();
    });

    it('returns undefined hitZone for cell types without getHitZones', () => {
      // Column 0 (name) is string type — no getHitZones
      const result = registryTranslator.hitTest(rowNumberWidth + 10, headerHeight + 5);
      expect(result.region).toBe('cell');
      expect(result.hitZone).toBeUndefined();
    });

    it('carries hitZone in cellClick event', () => {
      cellStore.set(0, 1, { value: true });
      registryTranslator.attach();
      const handler = vi.fn<[CellEvent]>();
      eventBus.on('cellClick', handler);

      // Click inside checkbox zone
      scrollContainer.dispatchEvent(mouseEvent('mousedown', 208, 44));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].hitZone).toBe('checkbox');
    });

    it('carries hitZone in cellDoubleClick event', () => {
      cellStore.set(0, 1, { value: true });
      registryTranslator.attach();
      const handler = vi.fn<[CellEvent]>();
      eventBus.on('cellDoubleClick', handler);

      scrollContainer.dispatchEvent(mouseEvent('dblclick', 208, 44));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].hitZone).toBe('checkbox');
    });

    it('emits cellHover on mousemove with no buttons pressed', () => {
      cellStore.set(0, 1, { value: true });
      registryTranslator.attach();
      const handler = vi.fn<[CellEvent]>();
      eventBus.on('cellHover', handler);

      // mousemove with buttons=0 (hover, not drag)
      const e = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 208,
        clientY: 44,
      });
      Object.defineProperty(e, 'offsetX', { value: 208 });
      Object.defineProperty(e, 'offsetY', { value: 44 });
      Object.defineProperty(e, 'buttons', { value: 0 });
      scrollContainer.dispatchEvent(e);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].hitZone).toBe('checkbox');
      expect(handler.mock.calls[0][0].row).toBe(0);
      expect(handler.mock.calls[0][0].col).toBe(1);
    });

    it('cellHover has no hitZone when not over a zone', () => {
      registryTranslator.attach();
      const handler = vi.fn<[CellEvent]>();
      eventBus.on('cellHover', handler);

      // Hover over string column (no zones)
      const e = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: rowNumberWidth + 10,
        clientY: headerHeight + 5,
      });
      Object.defineProperty(e, 'offsetX', { value: rowNumberWidth + 10 });
      Object.defineProperty(e, 'offsetY', { value: headerHeight + 5 });
      Object.defineProperty(e, 'buttons', { value: 0 });
      scrollContainer.dispatchEvent(e);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].hitZone).toBeUndefined();
    });

    it('gridMouseHover carries hitZoneCursor for cursor management', () => {
      cellStore.set(0, 1, { value: true });
      registryTranslator.attach();
      const handler = vi.fn();
      eventBus.on('gridMouseHover', handler);

      const e = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 208,
        clientY: 44,
      });
      Object.defineProperty(e, 'offsetX', { value: 208 });
      Object.defineProperty(e, 'offsetY', { value: 44 });
      Object.defineProperty(e, 'buttons', { value: 0 });
      scrollContainer.dispatchEvent(e);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].hitZoneCursor).toBe('pointer');
    });

    it('does not crash when cellTypeRegistry is not provided', () => {
      // Original translator without registry
      const result = translator.hitTest(rowNumberWidth + 130, headerHeight + 5);
      expect(result.region).toBe('cell');
      expect(result.hitZone).toBeUndefined();
    });

    it('handles renderer returning empty zones array', () => {
      const emptyRenderer: CellTypeRenderer = {
        format: (v) => String(v),
        align: 'center',
        getHitZones: () => [],
      };
      const customRegistry = new CellTypeRegistry();
      customRegistry.register('number', emptyRenderer);

      const customTranslator = new EventTranslator({
        scrollContainer,
        layoutEngine,
        scrollManager,
        eventBus,
        cellStore,
        dataView: new DataView({ totalRowCount: 1 }),
        columns,
        cellTypeRegistry: customRegistry,
      });

      cellStore.set(0, 1, { value: 42 });
      const result = customTranslator.hitTest(rowNumberWidth + 130, headerHeight + 5);
      expect(result.hitZone).toBeUndefined();
      customTranslator.detach();
    });
  });
});
