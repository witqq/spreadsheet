// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TooltipManager } from '../src/tooltip/tooltip-manager';
import { EventBus } from '../src/events/event-bus';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { lightTheme } from '../src/themes/built-in-themes';
import type { GridMouseEvent } from '../src/events/event-types';

function makeLayoutEngine() {
  return {
    headerHeight: 32,
    rowNumberWidth: 50,
    getColumnX: vi.fn().mockReturnValue(100),
    getRowY: vi.fn().mockReturnValue(0),
    getRowHeight: vi.fn().mockReturnValue(28),
  } as any;
}

function makeScrollManager() {
  return {
    scrollX: 0,
    scrollY: 0,
  } as any;
}

function makeHoverEvent(row: number, col: number, region = 'cell' as const): GridMouseEvent {
  return {
    row,
    col,
    region,
    originalEvent: new MouseEvent('mousemove'),
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('TooltipManager', () => {
  let container: HTMLDivElement;
  let eventBus: EventBus;
  let cellStore: CellStore;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    cellStore = new CellStore();
  });

  function createManager() {
    return new TooltipManager({
      container,
      eventBus,
      cellStore,
      dataView: new DataView({ totalRowCount: 100 }),
      layoutEngine: makeLayoutEngine(),
      scrollManager: makeScrollManager(),
      theme: lightTheme,
    });
  }

  it('creates tooltip element on first hover over error cell', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Required field' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toBe('Required field');
    expect(tooltip.style.display).toBe('block');

    manager.destroy();
  });

  it('hides tooltip when hovering over non-error cell', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    cellStore.setValue(0, 1, 'good');
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    expect(tooltip.style.display).toBe('block');

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 1));
    expect(tooltip.style.display).toBe('none');

    manager.destroy();
  });

  it('hides tooltip when hovering outside cell region', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    eventBus.emit('gridMouseHover', makeHoverEvent(-1, -1, 'header'));

    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    expect(tooltip.style.display).toBe('none');

    manager.destroy();
  });

  it('does not show tooltip for changed cells', () => {
    cellStore.setValue(0, 0, 'modified');
    cellStore.setMetadata(0, 0, { status: 'changed' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    const tooltip = container.querySelector('[data-wit-tooltip]');
    expect(tooltip).toBeNull(); // Never created

    manager.destroy();
  });

  it('does not show tooltip for error without message', () => {
    cellStore.setValue(0, 0, 'err');
    cellStore.setMetadata(0, 0, { status: 'error' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    const tooltip = container.querySelector('[data-wit-tooltip]');
    expect(tooltip).toBeNull();

    manager.destroy();
  });

  it('does not re-process same cell hover', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    // Only one tooltip element created
    const tooltips = container.querySelectorAll('[data-wit-tooltip]');
    expect(tooltips.length).toBe(1);

    manager.destroy();
  });

  it('updates tooltip text when moving to different error cell', () => {
    cellStore.setValue(0, 0, 'bad1');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error A' });
    cellStore.setValue(0, 1, 'bad2');
    cellStore.setMetadata(0, 1, { status: 'error', errorMessage: 'Error B' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    expect(tooltip.textContent).toBe('Error A');

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 1));
    expect(tooltip.textContent).toBe('Error B');

    manager.destroy();
  });

  it('positions tooltip below the cell', () => {
    const layoutEngine = makeLayoutEngine();
    layoutEngine.getColumnX.mockReturnValue(200);
    layoutEngine.getRowY.mockReturnValue(56);
    layoutEngine.getRowHeight.mockReturnValue(28);

    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });

    const manager = new TooltipManager({
      container,
      eventBus,
      cellStore,
      dataView: new DataView({ totalRowCount: 100 }),
      layoutEngine,
      scrollManager: makeScrollManager(),
      theme: lightTheme,
    });

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    // left = columnX(200) - scrollX(0) + rowNumberWidth(50) = 250
    expect(tooltip.style.left).toBe('250px');
    // top = rowY(56) - scrollY(0) + headerHeight(32) + rowHeight(28) + 2 = 118
    expect(tooltip.style.top).toBe('118px');

    manager.destroy();
  });

  it('removes tooltip element on destroy', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    expect(container.querySelector('[data-wit-tooltip]')).not.toBeNull();

    manager.destroy();
    expect(container.querySelector('[data-wit-tooltip]')).toBeNull();
  });

  it('unsubscribes from events on destroy', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    const manager = createManager();

    manager.destroy();

    // Emitting after destroy should not throw or create elements
    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));
    expect(container.querySelector('[data-wit-tooltip]')).toBeNull();
  });

  it('tooltip has pointer-events none', () => {
    cellStore.setValue(0, 0, 'bad');
    cellStore.setMetadata(0, 0, { status: 'error', errorMessage: 'Error' });
    const manager = createManager();

    eventBus.emit('gridMouseHover', makeHoverEvent(0, 0));

    const tooltip = container.querySelector('[data-wit-tooltip]') as HTMLDivElement;
    expect(tooltip.style.pointerEvents).toBe('none');

    manager.destroy();
  });
});
