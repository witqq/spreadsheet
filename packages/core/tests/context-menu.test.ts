// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextMenuManager } from '../src/context-menu/context-menu-manager';
import type { ContextMenuItem, MenuActionContext } from '../src/context-menu/context-menu-manager';
import { createDefaultMenuItems } from '../src/context-menu/default-items';
import { EventBus } from '../src/events/event-bus';
import { lightTheme } from '../src/themes/built-in-themes';
import type { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import type { GridMouseEvent } from '../src/events/event-types';

function createMockEngine(): SpreadsheetEngine {
  return {} as SpreadsheetEngine;
}

function createTestSetup() {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);

  // Mock getBoundingClientRect for positioning
  container.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 800, height: 600,
    top: 0, left: 0, right: 800, bottom: 600,
    toJSON: () => ({}),
  });

  const eventBus = new EventBus();
  const engine = createMockEngine();

  const manager = new ContextMenuManager({
    container,
    engine,
    eventBus,
    theme: lightTheme,
  });

  return {
    container,
    eventBus,
    engine,
    manager,
    cleanup() {
      manager.destroy();
      document.body.removeChild(container);
    },
  };
}

function createGridMouseEvent(region: string, row: number, col: number): GridMouseEvent {
  const mouseEvent = new MouseEvent('contextmenu', {
    clientX: 100,
    clientY: 100,
    bubbles: true,
    cancelable: true,
  });
  return {
    region: region as GridMouseEvent['region'],
    row,
    col,
    originalEvent: mouseEvent,
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('ContextMenuManager', () => {
  let setup: ReturnType<typeof createTestSetup>;

  beforeEach(() => {
    setup = createTestSetup();
  });

  afterEach(() => {
    setup.cleanup();
  });

  describe('item registration', () => {
    it('should register and retrieve items', () => {
      const item: ContextMenuItem = {
        id: 'test-item',
        label: 'Test Item',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      expect(setup.manager.getItems().has('test-item')).toBe(true);
      expect(setup.manager.getItems().get('test-item')?.label).toBe('Test Item');
    });

    it('should unregister items', () => {
      const item: ContextMenuItem = {
        id: 'test-item',
        label: 'Test Item',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      expect(setup.manager.getItems().has('test-item')).toBe(true);

      setup.manager.unregisterItem('test-item');
      expect(setup.manager.getItems().has('test-item')).toBe(false);
    });

    it('should replace item with same id', () => {
      const item1: ContextMenuItem = {
        id: 'test',
        label: 'First',
        contexts: ['cell'],
        action: vi.fn(),
      };
      const item2: ContextMenuItem = {
        id: 'test',
        label: 'Second',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item1);
      setup.manager.registerItem(item2);
      expect(setup.manager.getItems().get('test')?.label).toBe('Second');
    });
  });

  describe('context filtering', () => {
    it('should show cell items only in cell context', () => {
      const cellItem: ContextMenuItem = {
        id: 'cell-only',
        label: 'Cell Only',
        contexts: ['cell'],
        action: vi.fn(),
      };
      const headerItem: ContextMenuItem = {
        id: 'header-only',
        label: 'Header Only',
        contexts: ['header'],
        action: vi.fn(),
      };

      setup.manager.registerItem(cellItem);
      setup.manager.registerItem(headerItem);

      // Trigger context menu on cell
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Menu should be open with only cell items
      expect(setup.manager.isOpen).toBe(true);
      const menuItems = setup.container.querySelectorAll('[data-index]');
      expect(menuItems.length).toBe(1);
      expect(menuItems[0].textContent).toContain('Cell Only');
    });

    it('should show header items only in header context', () => {
      const cellItem: ContextMenuItem = {
        id: 'cell-only',
        label: 'Cell Only',
        contexts: ['cell'],
        action: vi.fn(),
      };
      const headerItem: ContextMenuItem = {
        id: 'header-only',
        label: 'Header Only',
        contexts: ['header'],
        action: vi.fn(),
      };

      setup.manager.registerItem(cellItem);
      setup.manager.registerItem(headerItem);

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('header', -1, 2));

      expect(setup.manager.isOpen).toBe(true);
      const menuItems = setup.container.querySelectorAll('[data-index]');
      expect(menuItems.length).toBe(1);
      expect(menuItems[0].textContent).toContain('Header Only');
    });

    it('should show row-number items in row-number context', () => {
      const rowItem: ContextMenuItem = {
        id: 'row-only',
        label: 'Row Only',
        contexts: ['row-number'],
        action: vi.fn(),
      };

      setup.manager.registerItem(rowItem);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('row-number', 5, -1));

      expect(setup.manager.isOpen).toBe(true);
      const menuItems = setup.container.querySelectorAll('[data-index]');
      expect(menuItems.length).toBe(1);
    });

    it('should show items matching multiple contexts', () => {
      const multiItem: ContextMenuItem = {
        id: 'multi',
        label: 'Multi Context',
        contexts: ['cell', 'header'],
        action: vi.fn(),
      };

      setup.manager.registerItem(multiItem);

      // Should show in cell context
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);
      setup.manager.close();

      // Should show in header context
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('header', -1, 0));
      expect(setup.manager.isOpen).toBe(true);
    });

    it('should not open for outside region', () => {
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('outside', -1, -1));
      expect(setup.manager.isOpen).toBe(false);
    });
  });

  describe('isVisible / isDisabled', () => {
    it('should hide items when isVisible returns false', () => {
      const item: ContextMenuItem = {
        id: 'conditional',
        label: 'Conditional',
        contexts: ['cell'],
        action: vi.fn(),
        isVisible: () => false,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      // Menu doesn't open because no visible items
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should show disabled items with reduced opacity', () => {
      const item: ContextMenuItem = {
        id: 'disabled-item',
        label: 'Disabled',
        contexts: ['cell'],
        action: vi.fn(),
        isDisabled: () => true,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      expect(menuItem.style.opacity).toBe('0.4');
    });
  });

  describe('menu lifecycle', () => {
    it('should open on gridContextMenu event', () => {
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      expect(setup.manager.isOpen).toBe(false);

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);
    });

    it('should close when close() is called', () => {
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      setup.manager.close();
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should close on Escape key', () => {
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      // Simulate Escape key on the menu element
      const menu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;
      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      menu.dispatchEvent(keyEvent);
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should close on item click', () => {
      const action = vi.fn();
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      // Click on the item
      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      menuItem.click();

      expect(setup.manager.isOpen).toBe(false);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should execute item action with correct context', () => {
      const action = vi.fn();
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 3, 5));

      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      menuItem.click();

      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          row: 3,
          col: 5,
          region: 'cell',
          engine: setup.engine,
        }),
      );
    });

    it('should not execute disabled item on click', () => {
      const action = vi.fn();
      const item: ContextMenuItem = {
        id: 'disabled',
        label: 'Disabled',
        contexts: ['cell'],
        action,
        isDisabled: () => true,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      menuItem.click();

      // Disabled items don't have click handlers
      expect(action).not.toHaveBeenCalled();
    });

    it('should close previous menu when opening new one', () => {
      const item: ContextMenuItem = {
        id: 'test',
        label: 'Test',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);

      // Open first menu
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      // Open second menu at different location
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 2, 3));
      expect(setup.manager.isOpen).toBe(true);

      // Only one menu should exist in DOM
      const menus = setup.container.querySelectorAll('[tabindex="-1"]');
      expect(menus.length).toBe(1);
    });
  });

  describe('default items', () => {
    it('should create all default items', () => {
      const items = createDefaultMenuItems();
      const ids = items.map((i) => i.id);

      expect(ids).toContain('cut');
      expect(ids).toContain('copy');
      expect(ids).toContain('paste');
      expect(ids).toContain('sort-asc');
      expect(ids).toContain('sort-desc');
      expect(ids).toContain('insert-row-above');
      expect(ids).toContain('insert-row-below');
      expect(ids).toContain('delete-row');
    });

    it('should have correct contexts for clipboard items', () => {
      const items = createDefaultMenuItems();
      const cut = items.find((i) => i.id === 'cut')!;
      const copy = items.find((i) => i.id === 'copy')!;
      const paste = items.find((i) => i.id === 'paste')!;

      expect(cut.contexts).toContain('cell');
      expect(copy.contexts).toContain('cell');
      expect(paste.contexts).toContain('cell');
    });

    it('should have correct contexts for sort items', () => {
      const items = createDefaultMenuItems();
      const sortAsc = items.find((i) => i.id === 'sort-asc')!;
      const sortDesc = items.find((i) => i.id === 'sort-desc')!;

      expect(sortAsc.contexts).toEqual(['header']);
      expect(sortDesc.contexts).toEqual(['header']);
    });

    it('should have correct contexts for row items', () => {
      const items = createDefaultMenuItems();
      const insertAbove = items.find((i) => i.id === 'insert-row-above')!;
      const insertBelow = items.find((i) => i.id === 'insert-row-below')!;
      const deleteRow = items.find((i) => i.id === 'delete-row')!;

      expect(insertAbove.contexts).toEqual(['row-number']);
      expect(insertBelow.contexts).toEqual(['row-number']);
      expect(deleteRow.contexts).toEqual(['row-number']);
    });
  });

  describe('separator rendering', () => {
    it('should render separator after item with separator flag', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'first',
          label: 'First',
          contexts: ['cell'],
          separator: true,
          action: vi.fn(),
        },
        {
          id: 'second',
          label: 'Second',
          contexts: ['cell'],
          action: vi.fn(),
        },
      ];

      for (const item of items) {
        setup.manager.registerItem(item);
      }

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Check there's a separator element (div with 1px height)
      const menu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;
      const children = Array.from(menu.children);
      // Should be 3 children: item, separator, item
      expect(children.length).toBe(3);
    });
  });
});
