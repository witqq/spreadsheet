/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RowResizeManager } from '../src/resize/row-resize-manager';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { CommandManager } from '../src/commands/command-manager';
import { EventBus } from '../src/events/event-bus';
import type { ColumnDef } from '../src/types/interfaces';

const makeColumns = (widths: number[]): ColumnDef[] =>
  widths.map((w, i) => ({
    key: `col${i}`,
    title: `Col ${i}`,
    width: w,
  }));

function createTestSetup() {
  const columns = makeColumns([100, 200, 150]);

  const layoutEngine = new LayoutEngine({
    columns,
    rowCount: 100,
    rowHeight: 30,
    headerHeight: 40,
    rowNumberWidth: 50,
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

  const resizeManager = new RowResizeManager({
    layoutEngine,
    scrollManager,
    commandManager,
    eventBus,
    container,
    onResize,
  });

  resizeManager.attach(scrollManager.getElement());

  return {
    resizeManager,
    layoutEngine,
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

describe('RowResizeManager', () => {
  describe('getResizeRowAt', () => {
    it('detects bottom border of first row', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // row0 bottom border at content y=30, screen y = 40+30 = 70
      // offsetX must be in row-number area (< 50)
      expect(resizeManager.getResizeRowAt(25, 70)).toBe(0);
      // Slightly above border
      expect(resizeManager.getResizeRowAt(25, 67)).toBe(0);
      // Too far from border
      expect(resizeManager.getResizeRowAt(25, 55)).toBe(-1);
      cleanup();
    });

    it('detects bottom border of second row', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // row1 bottom border at content y=60, screen y = 40+60 = 100
      expect(resizeManager.getResizeRowAt(25, 100)).toBe(1);
      cleanup();
    });

    it('returns -1 outside row-number column', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // Same y position but in cell area (x >= 50)
      expect(resizeManager.getResizeRowAt(60, 70)).toBe(-1);
      expect(resizeManager.getResizeRowAt(100, 70)).toBe(-1);
      cleanup();
    });

    it('returns -1 in header area', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // In row-number column but above header (y < 40)
      expect(resizeManager.getResizeRowAt(25, 20)).toBe(-1);
      expect(resizeManager.getResizeRowAt(25, 39)).toBe(-1);
      cleanup();
    });

    it('detects border from adjacent row side', () => {
      const { resizeManager, cleanup } = createTestSetup();
      // Just past row0 bottom border (on row1 top side)
      expect(resizeManager.getResizeRowAt(25, 73)).toBe(0);
      cleanup();
    });
  });

  describe('cursor changes', () => {
    it('sets row-resize cursor on hover near border', () => {
      const { scrollContainer, cleanup } = createTestSetup();
      const moveEvent = new MouseEvent('mousemove', { bubbles: true });
      Object.defineProperty(moveEvent, 'offsetX', { value: 25 });
      Object.defineProperty(moveEvent, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(moveEvent);
      expect(scrollContainer.style.cursor).toBe('row-resize');
      cleanup();
    });

    it('clears cursor when away from border', () => {
      const { scrollContainer, cleanup } = createTestSetup();
      // First set cursor
      const nearEvent = new MouseEvent('mousemove', { bubbles: true });
      Object.defineProperty(nearEvent, 'offsetX', { value: 25 });
      Object.defineProperty(nearEvent, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(nearEvent);

      // Then move away
      const awayEvent = new MouseEvent('mousemove', { bubbles: true });
      Object.defineProperty(awayEvent, 'offsetX', { value: 25 });
      Object.defineProperty(awayEvent, 'offsetY', { value: 55 });
      scrollContainer.dispatchEvent(awayEvent);
      expect(scrollContainer.style.cursor).toBe('');
      cleanup();
    });
  });

  describe('drag interaction', () => {
    it('starts drag on mousedown near border', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();
      const event = new MouseEvent('mousedown', {
        clientX: 25,
        clientY: 70,
        bubbles: true,
      });
      Object.defineProperty(event, 'offsetX', { value: 25 });
      Object.defineProperty(event, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(event);
      expect(resizeManager.isDragging).toBe(true);
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 70 }));
      cleanup();
    });

    it('does not start drag away from border', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();
      const event = new MouseEvent('mousedown', {
        clientX: 25,
        clientY: 55,
        bubbles: true,
      });
      Object.defineProperty(event, 'offsetX', { value: 25 });
      Object.defineProperty(event, 'offsetY', { value: 55 });
      scrollContainer.dispatchEvent(event);
      expect(resizeManager.isDragging).toBe(false);
      cleanup();
    });

    it('completes resize on drag end', () => {
      const { layoutEngine, commandManager, scrollContainer, onResize, cleanup } =
        createTestSetup();

      // Start drag on row0 bottom border (screen y = 70)
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // Drag down by 20px
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 90 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 90 }));

      // Row should now be 50px tall (30 + 20)
      expect(layoutEngine.getRowHeight(0)).toBe(50);
      expect(commandManager.canUndo()).toBe(true);
      expect(onResize).toHaveBeenCalled();
      cleanup();
    });

    it('resize is undoable', () => {
      const { layoutEngine, commandManager, scrollContainer, cleanup } = createTestSetup();

      // Start drag on row0 bottom border
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // Drag down by 20px
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 90 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 90 }));

      expect(layoutEngine.getRowHeight(0)).toBe(50);

      // Undo
      commandManager.undo();
      expect(layoutEngine.getRowHeight(0)).toBe(30);

      // Redo
      commandManager.redo();
      expect(layoutEngine.getRowHeight(0)).toBe(50);
      cleanup();
    });

    it('respects min height constraint (12px)', () => {
      const { layoutEngine, scrollContainer, cleanup } = createTestSetup();

      // Start drag on row0 bottom border (screen y = 70, clientY = 70)
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // Drag up by 50px (would make height = -20, clamped to 12)
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 20 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 20 }));

      expect(layoutEngine.getRowHeight(0)).toBe(12);
      cleanup();
    });

    it('respects max height constraint (400px)', () => {
      const { layoutEngine, scrollContainer, cleanup } = createTestSetup();

      // Start drag on row0 bottom border
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // Drag down by 500px (would make height = 530, clamped to 400)
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 570 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 570 }));

      expect(layoutEngine.getRowHeight(0)).toBe(400);
      cleanup();
    });

    it('shows and removes indicator during drag', () => {
      const { container, scrollContainer, cleanup } = createTestSetup();

      // Start drag
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // Indicator should be present
      const indicator = container.querySelector('div[style*="z-index: 20"]') as HTMLElement;
      expect(indicator).toBeTruthy();
      expect(indicator.style.position).toBe('absolute');

      // End drag
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 90 }));

      // Indicator should be removed
      const indicatorAfter = container.querySelector('div[style*="z-index: 20"]');
      expect(indicatorAfter).toBeNull();
      cleanup();
    });

    it('emits rowResize events', () => {
      const { eventBus, scrollContainer, cleanup } = createTestSetup();

      const startHandler = vi.fn();
      const resizeHandler = vi.fn();
      const endHandler = vi.fn();
      eventBus.on('rowResizeStart', startHandler);
      eventBus.on('rowResize', resizeHandler);
      eventBus.on('rowResizeEnd', endHandler);

      // Start drag on row0 bottom border
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      expect(startHandler).toHaveBeenCalledWith({ rowIndex: 0 });

      // Complete drag
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 90 }));
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 90 }));

      expect(resizeHandler).toHaveBeenCalledWith({
        rowIndex: 0,
        oldHeight: 30,
        newHeight: 50,
      });
      expect(endHandler).toHaveBeenCalled();
      cleanup();
    });

    it('no command created for zero-delta drag', () => {
      const { commandManager, scrollContainer, cleanup } = createTestSetup();

      // Start drag
      const down = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(down, 'offsetX', { value: 25 });
      Object.defineProperty(down, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(down);

      // End at same position
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 25, clientY: 70 }));

      expect(commandManager.canUndo()).toBe(false);
      cleanup();
    });
  });

  describe('detach', () => {
    it('stops responding to events after detach', () => {
      const { resizeManager, scrollContainer, cleanup } = createTestSetup();

      resizeManager.detach();

      const event = new MouseEvent('mousedown', { clientX: 25, clientY: 70, bubbles: true });
      Object.defineProperty(event, 'offsetX', { value: 25 });
      Object.defineProperty(event, 'offsetY', { value: 70 });
      scrollContainer.dispatchEvent(event);

      expect(resizeManager.isDragging).toBe(false);
      cleanup();
    });
  });
});
