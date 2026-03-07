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

  describe('submenu support', () => {
    it('should render chevron indicator for items with submenu', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: vi.fn() },
          { id: 'child-2', label: 'Child 2', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      const chevron = menuItem.querySelector('[data-chevron]') as HTMLElement;
      expect(chevron).toBeTruthy();
      expect(chevron.textContent).toBe('▸');
    });

    it('should not render chevron for items without submenu', () => {
      const item: ContextMenuItem = {
        id: 'flat',
        label: 'Flat',
        contexts: ['cell'],
        action: vi.fn(),
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const menuItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      const chevron = menuItem.querySelector('[data-chevron]');
      expect(chevron).toBeNull();
    });

    it('should open submenu on click of parent item', () => {
      const childAction = vi.fn();
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: childAction },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Click on the parent item
      const parentItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      parentItem.click();

      // Submenu should be open — a second menu panel should exist
      const panels = setup.container.querySelectorAll('[data-menu-depth]');
      expect(panels.length).toBe(2);
      expect(panels[1].getAttribute('data-menu-depth')).toBe('1');

      // Submenu should contain the child item
      const childItems = panels[1].querySelectorAll('[data-index]');
      expect(childItems.length).toBe(1);
      expect(childItems[0].textContent).toContain('Child 1');
    });

    it('should open submenu on hover with delay', () => {
      vi.useFakeTimers();

      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const parentItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;

      // Trigger mouseenter
      parentItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Before delay: no submenu
      let panels = setup.container.querySelectorAll('[data-menu-depth]');
      expect(panels.length).toBe(1);

      // After delay: submenu opens
      vi.advanceTimersByTime(200);
      panels = setup.container.querySelectorAll('[data-menu-depth]');
      expect(panels.length).toBe(2);

      vi.useRealTimers();
    });

    it('should close submenu on ArrowLeft', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // ArrowDown to focus parent item, ArrowRight to open submenu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(2);

      // ArrowLeft to close submenu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(1);
      expect(setup.manager.isOpen).toBe(true);
    });

    it('should open submenu on ArrowRight when focused on parent item', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: vi.fn() },
          { id: 'child-2', label: 'Child 2', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // ArrowDown to focus item
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      // ArrowRight to open submenu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      const panels = setup.container.querySelectorAll('[data-menu-depth]');
      expect(panels.length).toBe(2);

      // First child should be focused (has a background color set)
      const childItem = panels[1].querySelector('[data-index="0"]') as HTMLElement;
      expect(childItem.style.backgroundColor).not.toBe('');
    });

    it('should execute submenu item action on Enter', () => {
      const childAction = vi.fn();
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: childAction },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // Navigate to submenu: ArrowDown → ArrowRight → Enter
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(childAction).toHaveBeenCalledTimes(1);
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should execute submenu item action on click', () => {
      const childAction = vi.fn();
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child-1', label: 'Child 1', contexts: ['cell'], action: childAction },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Open submenu by clicking parent
      const parentItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      parentItem.click();

      // Click on child item in submenu
      const submenuPanel = setup.container.querySelectorAll('[data-menu-depth]')[1];
      const childItem = submenuPanel.querySelector('[data-index="0"]') as HTMLElement;
      childItem.click();

      expect(childAction).toHaveBeenCalledTimes(1);
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should support nested submenus (recursive)', () => {
      const leafAction = vi.fn();
      const item: ContextMenuItem = {
        id: 'l1',
        label: 'Level 1',
        contexts: ['cell'],
        submenu: [
          {
            id: 'l2',
            label: 'Level 2',
            contexts: ['cell'],
            submenu: [
              { id: 'l3', label: 'Level 3', contexts: ['cell'], action: leafAction },
            ],
          },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // Navigate: down → right (L2) → right (L3)
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      // L2 submenu should be open
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(2);

      // Navigate into L2's submenu (ArrowDown to focus L2 item, then ArrowRight)
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(3);

      // Execute L3 item
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(leafAction).toHaveBeenCalledTimes(1);
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should close only deepest submenu on Escape (not entire menu)', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child', label: 'Child', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // Open submenu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(2);

      // Escape closes submenu but menu stays open
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(1);
      expect(setup.manager.isOpen).toBe(true);

      // Another Escape closes the entire menu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should navigate within submenu using ArrowUp/ArrowDown', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'c1', label: 'Child 1', contexts: ['cell'], action: vi.fn() },
          { id: 'c2', label: 'Child 2', contexts: ['cell'], action: vi.fn() },
          { id: 'c3', label: 'Child 3', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;

      // Open submenu
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      // First child focused (has background highlight)
      const submenuPanel = setup.container.querySelectorAll('[data-menu-depth]')[1];
      expect((submenuPanel.querySelector('[data-index="0"]') as HTMLElement).style.backgroundColor).not.toBe('');

      // ArrowDown to focus second child
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect((submenuPanel.querySelector('[data-index="1"]') as HTMLElement).style.backgroundColor).not.toBe('');
      expect((submenuPanel.querySelector('[data-index="0"]') as HTMLElement).style.backgroundColor).toBe('');
    });
  });

  describe('empty menu prevention', () => {
    it('should not open menu when all items are invisible', () => {
      const item: ContextMenuItem = {
        id: 'hidden',
        label: 'Hidden',
        contexts: ['cell'],
        action: vi.fn(),
        isVisible: () => false,
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should hide parent item when all submenu children are invisible', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent with hidden children',
        contexts: ['cell'],
        submenu: [
          { id: 'c1', label: 'C1', contexts: ['cell'], action: vi.fn(), isVisible: () => false },
          { id: 'c2', label: 'C2', contexts: ['cell'], action: vi.fn(), isVisible: () => false },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Menu should not open because the only item has no visible children
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should show parent item when at least one submenu child is visible', () => {
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'c1', label: 'Hidden', contexts: ['cell'], action: vi.fn(), isVisible: () => false },
          { id: 'c2', label: 'Visible', contexts: ['cell'], action: vi.fn() },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      expect(setup.manager.isOpen).toBe(true);
      const menuItems = setup.container.querySelectorAll('[data-index]');
      expect(menuItems.length).toBe(1);
      expect(menuItems[0].textContent).toContain('Parent');
    });

    it('should recursively check visibility for nested submenus', () => {
      const item: ContextMenuItem = {
        id: 'l1',
        label: 'Level 1',
        contexts: ['cell'],
        submenu: [
          {
            id: 'l2',
            label: 'Level 2',
            contexts: ['cell'],
            submenu: [
              { id: 'l3', label: 'L3', contexts: ['cell'], action: vi.fn(), isVisible: () => false },
            ],
          },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // L3 is hidden → L2 has no visible children → L1 has no visible children → menu doesn't open
      expect(setup.manager.isOpen).toBe(false);
    });

    it('should filter invisible children when opening submenu', () => {
      const visibleAction = vi.fn();
      const item: ContextMenuItem = {
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'hidden', label: 'Hidden', contexts: ['cell'], action: vi.fn(), isVisible: () => false },
          { id: 'visible', label: 'Visible', contexts: ['cell'], action: visibleAction },
        ],
      };

      setup.manager.registerItem(item);
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      // Open submenu
      const parentItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      parentItem.click();

      const submenuPanel = setup.container.querySelectorAll('[data-menu-depth]')[1];
      const childItems = submenuPanel.querySelectorAll('[data-index]');
      // Only the visible child should be shown
      expect(childItems.length).toBe(1);
      expect(childItems[0].textContent).toContain('Visible');
    });
  });

  describe('submenu with mixed items', () => {
    it('should show both flat items and submenu items together', () => {
      const flatAction = vi.fn();
      setup.manager.registerItem({
        id: 'flat',
        label: 'Flat Item',
        contexts: ['cell'],
        action: flatAction,
      });
      setup.manager.registerItem({
        id: 'parent',
        label: 'Parent Item',
        contexts: ['cell'],
        submenu: [
          { id: 'child', label: 'Child', contexts: ['cell'], action: vi.fn() },
        ],
      });

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      expect(setup.manager.isOpen).toBe(true);

      const menuItems = setup.container.querySelectorAll('[data-index]');
      expect(menuItems.length).toBe(2);

      // First item is flat (no chevron)
      expect(menuItems[0].querySelector('[data-chevron]')).toBeNull();
      // Second item has chevron
      expect(menuItems[1].querySelector('[data-chevron]')).toBeTruthy();
    });

    it('should execute flat item action while submenu items open submenu', () => {
      const flatAction = vi.fn();
      setup.manager.registerItem({
        id: 'flat',
        label: 'Flat',
        contexts: ['cell'],
        action: flatAction,
      });
      setup.manager.registerItem({
        id: 'parent',
        label: 'Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'child', label: 'Child', contexts: ['cell'], action: vi.fn() },
        ],
      });

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      // Click flat item → executes action, closes menu
      const flatItem = setup.container.querySelector('[data-index="0"]') as HTMLElement;
      flatItem.click();
      expect(flatAction).toHaveBeenCalledTimes(1);
      expect(setup.manager.isOpen).toBe(false);

      // Re-open and click parent → opens submenu, menu stays open
      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));
      const parentItem = setup.container.querySelectorAll('[data-index]')[1] as HTMLElement;
      parentItem.click();
      expect(setup.manager.isOpen).toBe(true);
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(2);
    });

    it('should not crash on ArrowRight when focused item has no submenu', () => {
      setup.manager.registerItem({
        id: 'flat',
        label: 'Flat',
        contexts: ['cell'],
        action: vi.fn(),
      });

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      // ArrowRight on a flat item should be a no-op
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(setup.manager.isOpen).toBe(true);
      expect(setup.container.querySelectorAll('[data-menu-depth]').length).toBe(1);
    });

    it('should not crash on ArrowLeft at root level', () => {
      setup.manager.registerItem({
        id: 'flat',
        label: 'Flat',
        contexts: ['cell'],
        action: vi.fn(),
      });

      setup.eventBus.emit('gridContextMenu', createGridMouseEvent('cell', 0, 0));

      const rootMenu = setup.container.querySelector('[tabindex="-1"]') as HTMLElement;
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      // ArrowLeft at root should be a no-op
      rootMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(setup.manager.isOpen).toBe(true);
    });
  });
});
