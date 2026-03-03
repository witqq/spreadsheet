/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColumnResizeManager } from '../src/resize/column-resize-manager';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { CommandManager } from '../src/commands/command-manager';
import { EventBus } from '../src/events/event-bus';
import type { ColumnDef } from '../src/types/interfaces';
import { lightTheme } from '../src/themes/built-in-themes';

const makeColumns = (widths: number[], opts?: Partial<ColumnDef>[]): ColumnDef[] =>
  widths.map((w, i) => ({
    key: `col${i}`,
    title: `Col ${i}`,
    width: w,
    ...(opts?.[i] ?? {}),
  }));

function createTestSetup(columnOpts?: Partial<ColumnDef>[]) {
  const columns = makeColumns(
    [100, 200, 150],
    columnOpts,
  );

  const layoutEngine = new LayoutEngine({
    columns,
    rowCount: 100,
    rowHeight: 30,
    headerHeight: 40,
    rowNumberWidth: 50,
  });

  const gridGeometry = new GridGeometry({
    columns,
    theme: lightTheme,
    showRowNumbers: true,
  });

  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  container.style.position = 'relative';
  document.body.appendChild(container);

  const scrollManager = new ScrollManager({
    container,
    totalWidth: layoutEngine.totalWidth,
    totalHeight: layoutEngine.totalHeight,
    onScroll: () => {},
  });

  const commandManager = new CommandManager();
  const eventBus = new EventBus();
  const onResize = vi.fn();

  const resizeManager = new ColumnResizeManager({
    layoutEngine,
    gridGeometry,
    scrollManager,
    commandManager,
    eventBus,
    columns,
    container,
    onResize,
  });

  resizeManager.attach(scrollManager.getElement());

  return {
    resizeManager,
    layoutEngine,
    gridGeometry,
    scrollManager,
    commandManager,
    eventBus,
    container,
    onResize,
    scrollContainer: scrollManager.getElement(),
    cleanup: () => {
      resizeManager.detach();
      scrollManager.destroy();
      document.body.removeChild(container);
    },
  };
}

describe('ColumnResizeManager', () => {
  describe('getResizeColumnAt', () => {
    it('detects right border of first column', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // col0 right border at content x=100, screen x = 50+100 = 150
      expect(resizeManager.getResizeColumnAt(150, 20)).toBe(0);
      // Slightly left of border
      expect(resizeManager.getResizeColumnAt(147, 20)).toBe(0);
      // Too far from border
      expect(resizeManager.getResizeColumnAt(140, 20)).toBe(-1);
      cleanup();
    });

    it('detects right border of middle column', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // col1 right border at content x=300, screen x = 50+300 = 350
      expect(resizeManager.getResizeColumnAt(350, 10)).toBe(1);
      cleanup();
    });

    it('returns -1 below header', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // Same x position but below header (y >= 40)
      expect(resizeManager.getResizeColumnAt(150, 40)).toBe(-1);
      expect(resizeManager.getResizeColumnAt(150, 50)).toBe(-1);
      cleanup();
    });

    it('returns -1 in row number area', () => {
      const { resizeManager, cleanup } = createTestSetup();
      expect(resizeManager.getResizeColumnAt(30, 20)).toBe(-1);
      cleanup();
    });

    it('returns -1 for non-resizable column', () => {
      const { resizeManager, cleanup } = createTestSetup([
        { resizable: false },
        {},
        {},
      ]);
      // col0 border at x=150 should not be resizable
      expect(resizeManager.getResizeColumnAt(150, 20)).toBe(-1);
      // col1 border should still work
      expect(resizeManager.getResizeColumnAt(350, 20)).toBe(1);
      cleanup();
    });

    it('detects border from adjacent column side', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // Just past col0 right border (on col1 left side)
      expect(resizeManager.getResizeColumnAt(153, 20)).toBe(0);
      cleanup();
    });
  });

  describe('cursor changes', () => {
    it('sets col-resize cursor on hover near border', () => {
      const { scrollContainer, cleanup } = createTestSetup();
      // Hover near col0 right border
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 20,
        bubbles: true,
      });
      Object.defineProperty(moveEvent, 'offsetX', { value: 150 });
      Object.defineProperty(moveEvent, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(moveEvent);
      expect(scrollContainer.style.cursor).toBe('col-resize');
      cleanup();
    });

    it('clears cursor when away from border', () => {
      const { scrollContainer, cleanup } = createTestSetup();
      // First set cursor
      const nearEvent = new MouseEvent('mousemove', { bubbles: true });
      Object.defineProperty(nearEvent, 'offsetX', { value: 150 });
      Object.defineProperty(nearEvent, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(nearEvent);

      // Then move away
      const awayEvent = new MouseEvent('mousemove', { bubbles: true });
      Object.defineProperty(awayEvent, 'offsetX', { value: 200 });
      Object.defineProperty(awayEvent, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(awayEvent);
      expect(scrollContainer.style.cursor).toBe('');
      cleanup();
    });
  });

  describe('drag interaction', () => {
    it('starts drag on mousedown near border', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();
      const event = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 20,
        bubbles: true,
      });
      Object.defineProperty(event, 'offsetX', { value: 150 });
      Object.defineProperty(event, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(event);
      expect(resizeManager.isDragging).toBe(true);
      // Clean up drag
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 20 }));
      cleanup();
    });

    it('does not start drag away from border', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();
      const event = new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 20,
        bubbles: true,
      });
      Object.defineProperty(event, 'offsetX', { value: 200 });
      Object.defineProperty(event, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(event);
      expect(resizeManager.isDragging).toBe(false);
      cleanup();
    });

    it('completes resize on drag end', () => {
      const { layoutEngine, commandManager, scrollContainer, onResize, cleanup } =
        createTestSetup();

      // Start drag on col0 border (screen x = 150)
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // Drag right by 50px
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 20 }));

      // Column should now be 150px wide
      expect(layoutEngine.getColumnWidth(0)).toBe(150);
      expect(commandManager.canUndo()).toBe(true);
      expect(onResize).toHaveBeenCalled();
      cleanup();
    });

    it('resize is undoable', () => {
      const { layoutEngine, commandManager, scrollContainer, cleanup } = createTestSetup();

      // Start drag on col0 border
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // Drag right by 50px
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 20 }));

      expect(layoutEngine.getColumnWidth(0)).toBe(150);

      // Undo
      commandManager.undo();
      expect(layoutEngine.getColumnWidth(0)).toBe(100);

      // Redo
      commandManager.redo();
      expect(layoutEngine.getColumnWidth(0)).toBe(150);
      cleanup();
    });

    it('respects minWidth constraint', () => {
      const { layoutEngine, scrollContainer, cleanup } = createTestSetup([
        { minWidth: 50 },
        {},
        {},
      ]);

      // Start drag on col0 border
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // Drag left by 80px (would make width = 20, below minWidth)
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 70, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 70, clientY: 20 }));

      expect(layoutEngine.getColumnWidth(0)).toBe(50);
      cleanup();
    });

    it('respects maxWidth constraint', () => {
      const { layoutEngine, scrollContainer, cleanup } = createTestSetup([
        { maxWidth: 200 },
        {},
        {},
      ]);

      // Start drag on col0 border
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // Drag right by 200px (would make width = 300, above maxWidth)
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 20 }));

      expect(layoutEngine.getColumnWidth(0)).toBe(200);
      cleanup();
    });

    it('shows and removes indicator during drag', () => {
      const { container, scrollContainer, cleanup } = createTestSetup();

      // Start drag
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // Indicator should be present
      const indicator = container.querySelector('div[style*="z-index: 20"]') as HTMLElement;
      expect(indicator).toBeTruthy();
      expect(indicator.style.position).toBe('absolute');

      // End drag
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 20 }));

      // Indicator should be removed
      const indicatorAfter = container.querySelector('div[style*="z-index: 20"]');
      expect(indicatorAfter).toBeNull();
      cleanup();
    });

    it('emits columnResize events', () => {
      const { eventBus, scrollContainer, cleanup } = createTestSetup();

      const startHandler = vi.fn();
      const resizeHandler = vi.fn();
      const endHandler = vi.fn();
      eventBus.on('columnResizeStart', startHandler);
      eventBus.on('columnResize', resizeHandler);
      eventBus.on('columnResizeEnd', endHandler);

      // Start drag on col0 border
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      expect(startHandler).toHaveBeenCalledWith({ colIndex: 0 });

      // Complete drag
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 20 }));

      expect(resizeHandler).toHaveBeenCalledWith({
        colIndex: 0,
        oldWidth: 100,
        newWidth: 150,
      });
      expect(endHandler).toHaveBeenCalled();
      cleanup();
    });

    it('no command created for zero-delta drag', () => {
      const { commandManager, scrollContainer, cleanup } = createTestSetup();

      // Start drag
      const down = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 150 });
      Object.defineProperty(down, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(down);

      // End at same position
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150, clientY: 20 }));

      expect(commandManager.canUndo()).toBe(false);
      cleanup();
    });
  });

  describe('detach', () => {
    it('stops responding to events after detach', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();

      resizeManager.detach();

      const event = new MouseEvent('mousedown', { clientX: 150, clientY: 20, bubbles: true });
      Object.defineProperty(event, 'offsetX', { value: 150 });
      Object.defineProperty(event, 'offsetY', { value: 20 });
      scrollContainer.dispatchEvent(event);

      expect(resizeManager.isDragging).toBe(false);
      cleanup();
    });
  });
});
