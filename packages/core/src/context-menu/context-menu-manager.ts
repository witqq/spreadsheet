// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ContextMenuManager — manages a right-click context menu overlay.
 *
 * Subscribes to gridContextMenu events, renders a positioned DOM menu,
 * filters items by region context, and supports extensible item registration.
 * Supports recursive submenus with keyboard navigation and empty menu prevention.
 */

import type { EventBus } from '../events/event-bus';
import type { GridMouseEvent } from '../events/event-types';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { SpreadsheetEngine } from '../engine/spreadsheet-engine';
import type { ResolvedLocale } from '../locale/resolve-locale';
import { createDefaultMenuItems } from './default-items';

export type MenuContext = 'cell' | 'header' | 'row-number' | 'corner';

export interface MenuActionContext {
  readonly row: number;
  readonly col: number;
  readonly region: string;
  readonly engine: SpreadsheetEngine;
}

export interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly shortcut?: string;
  readonly separator?: boolean;
  readonly contexts: ReadonlyArray<MenuContext>;
  readonly submenu?: ReadonlyArray<ContextMenuItem>;
  action?: (ctx: MenuActionContext) => void;
  isDisabled?: (ctx: MenuActionContext) => boolean;
  isVisible?: (ctx: MenuActionContext) => boolean;
}

export interface ContextMenuManagerConfig {
  container: HTMLElement;
  engine: SpreadsheetEngine;
  eventBus: EventBus;
  theme: SpreadsheetTheme;
}

interface MenuLevel {
  element: HTMLDivElement;
  items: ContextMenuItem[];
  focusedIndex: number;
}

const SUBMENU_OPEN_DELAY = 200;
const SUBMENU_CLOSE_DELAY = 150;

/** IDs of built-in default menu items that setItems() preserves. */
export const DEFAULT_MENU_ITEM_IDS = new Set([
  'cut',
  'copy',
  'paste',
  'sort-asc',
  'sort-desc',
  'insert-row-above',
  'insert-row-below',
  'delete-row',
]);

export class ContextMenuManager {
  private readonly container: HTMLElement;
  private readonly engine: SpreadsheetEngine;
  private readonly eventBus: EventBus;
  private theme: SpreadsheetTheme;
  private readonly items: Map<string, ContextMenuItem> = new Map();
  private menuStack: MenuLevel[] = [];
  private currentContext: MenuActionContext | null = null;
  private outsideClickTimer: ReturnType<typeof setTimeout> | null = null;
  private submenuOpenTimer: ReturnType<typeof setTimeout> | null = null;
  private submenuCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ContextMenuManagerConfig) {
    this.container = config.container;
    this.engine = config.engine;
    this.eventBus = config.eventBus;
    this.theme = config.theme;

    this.eventBus.on('gridContextMenu', this.handleContextMenu);
  }

  /** Register a menu item. */
  registerItem(item: ContextMenuItem): void {
    this.items.set(item.id, item);
  }

  /** Unregister a menu item by id. */
  unregisterItem(id: string): void {
    this.items.delete(id);
  }

  /** Get all registered items. */
  getItems(): ReadonlyMap<string, ContextMenuItem> {
    return this.items;
  }

  /** Whether the context menu is currently open. */
  get isOpen(): boolean {
    return this.menuStack.length > 0;
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
  }

  /** Update locale for runtime locale switching. Replaces default items with new locale strings. */
  setLocale(locale: ResolvedLocale): void {
    // Remove old default items and re-register with new locale
    for (const id of DEFAULT_MENU_ITEM_IDS) {
      this.items.delete(id);
    }
    for (const item of createDefaultMenuItems(locale)) {
      this.items.set(item.id, item);
    }
  }

  /**
   * Atomically replace all user-registered (custom) menu items.
   *
   * Default items (cut, copy, paste, sort, row operations) are preserved
   * and not affected. Accepts an array of custom items and replaces the
   * entire custom items registry in one operation.
   */
  setItems(items: ReadonlyArray<ContextMenuItem>): void {
    // Remove all non-default items
    for (const id of this.items.keys()) {
      if (!DEFAULT_MENU_ITEM_IDS.has(id)) {
        this.items.delete(id);
      }
    }
    // Register new custom items
    for (const item of items) {
      this.items.set(item.id, item);
    }
  }

  /** Close the menu if open. */
  close(): void {
    this.clearTimers();

    if (this.menuStack.length === 0) return;

    this.menuStack[0].element.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleOutsideClick);

    for (const level of this.menuStack) {
      if (level.element.parentNode) {
        level.element.parentNode.removeChild(level.element);
      }
    }

    this.menuStack = [];
    this.currentContext = null;
  }

  /** Clean up on engine destroy. */
  destroy(): void {
    this.close();
    this.eventBus.off('gridContextMenu', this.handleContextMenu);
  }

  private clearTimers(): void {
    if (this.outsideClickTimer !== null) {
      clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }
    if (this.submenuOpenTimer !== null) {
      clearTimeout(this.submenuOpenTimer);
      this.submenuOpenTimer = null;
    }
    if (this.submenuCloseTimer !== null) {
      clearTimeout(this.submenuCloseTimer);
      this.submenuCloseTimer = null;
    }
  }

  /** Check if an item has at least one visible child (recursive). */
  private hasVisibleChildren(item: ContextMenuItem, ctx: MenuActionContext): boolean {
    if (!item.submenu || item.submenu.length === 0) return false;
    for (const child of item.submenu) {
      if (child.isVisible && !child.isVisible(ctx)) continue;
      if (child.submenu && child.submenu.length > 0) {
        if (this.hasVisibleChildren(child, ctx)) return true;
      } else {
        return true;
      }
    }
    return false;
  }

  /** Filter items for display — applies context, visibility, and empty submenu checks. */
  private filterItems(
    items: Iterable<ContextMenuItem>,
    ctx: MenuActionContext,
    menuContext?: MenuContext,
  ): ContextMenuItem[] {
    const result: ContextMenuItem[] = [];
    for (const item of items) {
      if (menuContext && !item.contexts.includes(menuContext)) continue;
      if (item.isVisible && !item.isVisible(ctx)) continue;
      if (item.submenu && item.submenu.length > 0 && !this.hasVisibleChildren(item, ctx)) continue;
      result.push(item);
    }
    return result;
  }

  private handleContextMenu = (event: GridMouseEvent): void => {
    event.originalEvent.preventDefault();

    this.close();

    const menuContext = this.regionToMenuContext(event.region);
    if (!menuContext) return;

    const ctx: MenuActionContext = {
      row: event.row,
      col: event.col,
      region: event.region,
      engine: this.engine,
    };
    this.currentContext = ctx;

    const visibleItems = this.filterItems(this.items.values(), ctx, menuContext);
    if (visibleItems.length === 0) return;

    const rootElement = this.buildMenuPanel(visibleItems, ctx, 0);
    this.container.appendChild(rootElement);

    this.menuStack.push({ element: rootElement, items: visibleItems, focusedIndex: -1 });

    this.positionMenuAtPoint(rootElement, event.originalEvent.clientX, event.originalEvent.clientY);

    rootElement.setAttribute('tabindex', '-1');
    rootElement.focus();
    rootElement.addEventListener('keydown', this.handleKeyDown);

    this.outsideClickTimer = setTimeout(() => {
      this.outsideClickTimer = null;
      document.addEventListener('mousedown', this.handleOutsideClick);
    }, 0);
  };

  private regionToMenuContext(region: string): MenuContext | null {
    switch (region) {
      case 'cell':
        return 'cell';
      case 'header':
      case 'header-sort-icon':
      case 'header-filter-icon':
        return 'header';
      case 'row-number':
        return 'row-number';
      case 'corner':
        return 'corner';
      default:
        return null;
    }
  }

  private buildMenuPanel(
    items: ContextMenuItem[],
    ctx: MenuActionContext,
    depth: number,
  ): HTMLDivElement {
    const panel = document.createElement('div');
    this.styleMenu(panel);
    panel.dataset.menuDepth = String(depth);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const disabled = item.isDisabled ? item.isDisabled(ctx) : false;
      const hasSubmenu = !!(item.submenu && item.submenu.length > 0);
      const row = this.createMenuItemElement(item, i, disabled, hasSubmenu, depth);
      panel.appendChild(row);

      if (item.separator && i < items.length - 1) {
        const sep = document.createElement('div');
        sep.style.height = '1px';
        sep.style.backgroundColor = this.theme.colors.gridLine;
        sep.style.margin = '4px 0';
        panel.appendChild(sep);
      }
    }

    return panel;
  }

  private styleMenu(el: HTMLDivElement): void {
    const s = el.style;
    s.position = 'absolute';
    s.zIndex = '100';
    s.margin = '0';
    s.backgroundColor = this.theme.colors.background;
    s.border = `1px solid ${this.theme.colors.headerBorder}`;
    s.borderRadius = '4px';
    s.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    s.padding = '4px 0';
    s.minWidth = '180px';
    s.outline = 'none';
    s.fontFamily = this.theme.fonts.cell;
    s.fontSize = `${this.theme.fonts.cellSize}px`;
    s.color = this.theme.colors.cellText;
    s.userSelect = 'none';
  }

  private createMenuItemElement(
    item: ContextMenuItem,
    index: number,
    disabled: boolean,
    hasSubmenu: boolean,
    depth: number,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.index = String(index);
    row.dataset.depth = String(depth);

    const s = row.style;
    s.display = 'flex';
    s.alignItems = 'center';
    s.padding = '6px 12px';
    s.cursor = disabled ? 'default' : 'pointer';
    s.opacity = disabled ? '0.4' : '1';
    s.gap = '8px';

    if (item.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.textContent = item.icon;
      iconSpan.style.width = '20px';
      iconSpan.style.textAlign = 'center';
      row.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = item.label;
    labelSpan.style.flex = '1';
    row.appendChild(labelSpan);

    if (hasSubmenu) {
      const chevron = document.createElement('span');
      chevron.textContent = '▸';
      chevron.style.marginLeft = '8px';
      chevron.style.opacity = '0.6';
      chevron.dataset.chevron = 'true';
      row.appendChild(chevron);
    } else if (item.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.textContent = item.shortcut;
      shortcutSpan.style.marginLeft = '24px';
      shortcutSpan.style.opacity = '0.5';
      shortcutSpan.style.fontSize = `${Math.max(this.theme.fonts.cellSize - 1, 10)}px`;
      row.appendChild(shortcutSpan);
    }

    if (!disabled) {
      row.addEventListener('mouseenter', () => {
        this.handleItemMouseEnter(depth, index, hasSubmenu);
      });
      row.addEventListener('mouseleave', () => {
        this.handleItemMouseLeave(depth, index, hasSubmenu);
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasSubmenu) {
          this.openSubmenu(depth, index);
        } else {
          this.executeItem(depth, index);
        }
      });
    }

    return row;
  }

  private handleItemMouseEnter(depth: number, index: number, hasSubmenu: boolean): void {
    if (this.submenuCloseTimer !== null) {
      clearTimeout(this.submenuCloseTimer);
      this.submenuCloseTimer = null;
    }

    this.setFocused(depth, index);

    // Close deeper submenus immediately when hovering a different item
    this.closeSubmenusFrom(depth + 1);

    if (hasSubmenu) {
      if (this.submenuOpenTimer !== null) {
        clearTimeout(this.submenuOpenTimer);
        this.submenuOpenTimer = null;
      }
      this.submenuOpenTimer = setTimeout(() => {
        this.submenuOpenTimer = null;
        this.openSubmenu(depth, index);
      }, SUBMENU_OPEN_DELAY);
    }
  }

  private handleItemMouseLeave(depth: number, _index: number, hasSubmenu: boolean): void {
    if (hasSubmenu) {
      if (this.submenuOpenTimer !== null) {
        clearTimeout(this.submenuOpenTimer);
        this.submenuOpenTimer = null;
      }
      this.submenuCloseTimer = setTimeout(() => {
        this.submenuCloseTimer = null;
        this.closeSubmenusFrom(depth + 1);
      }, SUBMENU_CLOSE_DELAY);
    }
  }

  private openSubmenu(parentDepth: number, itemIndex: number): void {
    if (!this.currentContext) return;

    const parentLevel = this.menuStack[parentDepth];
    if (!parentLevel) return;

    const parentItem = parentLevel.items[itemIndex];
    if (!parentItem?.submenu || parentItem.submenu.length === 0) return;

    // If a submenu is already open at this depth+1, close it first
    this.closeSubmenusFrom(parentDepth + 1);

    const visibleChildren = this.filterItems(parentItem.submenu, this.currentContext);
    if (visibleChildren.length === 0) return;

    const childDepth = parentDepth + 1;
    const childPanel = this.buildMenuPanel(visibleChildren, this.currentContext, childDepth);
    this.container.appendChild(childPanel);

    this.positionSubmenu(childPanel, parentLevel.element, itemIndex);

    this.menuStack.push({ element: childPanel, items: visibleChildren, focusedIndex: -1 });

    // Prevent submenu from stealing focus from root menu
    childPanel.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    childPanel.addEventListener('mouseenter', () => {
      if (this.submenuCloseTimer !== null) {
        clearTimeout(this.submenuCloseTimer);
        this.submenuCloseTimer = null;
      }
    });
    childPanel.addEventListener('mouseleave', () => {
      this.submenuCloseTimer = setTimeout(() => {
        this.submenuCloseTimer = null;
        this.closeSubmenusFrom(childDepth);
      }, SUBMENU_CLOSE_DELAY);
    });
  }

  private closeSubmenusFrom(depth: number): void {
    while (this.menuStack.length > depth) {
      const level = this.menuStack.pop()!;
      if (level.element.parentNode) {
        level.element.parentNode.removeChild(level.element);
      }
    }
  }

  private positionMenuAtPoint(menuEl: HTMLDivElement, clientX: number, clientY: number): void {
    const containerRect = this.container.getBoundingClientRect();
    let x = clientX - containerRect.left;
    let y = clientY - containerRect.top;

    const menuRect = menuEl.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;

    if (x + menuWidth > containerRect.width) {
      x = containerRect.width - menuWidth;
    }
    if (y + menuHeight > containerRect.height) {
      y = containerRect.height - menuHeight;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
  }

  private positionSubmenu(
    submenuEl: HTMLDivElement,
    parentEl: HTMLDivElement,
    itemIndex: number,
  ): void {
    const containerRect = this.container.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const itemEl = parentEl.querySelector(`[data-index="${itemIndex}"]`) as HTMLElement | null;

    const submenuRect = submenuEl.getBoundingClientRect();

    // Default: right of parent, aligned with parent item top
    let x = parentRect.right - containerRect.left;
    let y = itemEl
      ? itemEl.getBoundingClientRect().top - containerRect.top
      : parentRect.top - containerRect.top;

    // If not enough space on right, position to the left
    if (x + submenuRect.width > containerRect.width) {
      x = parentRect.left - containerRect.left - submenuRect.width;
    }

    if (y + submenuRect.height > containerRect.height) {
      y = containerRect.height - submenuRect.height;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    submenuEl.style.left = `${x}px`;
    submenuEl.style.top = `${y}px`;
  }

  private setFocused(depth: number, index: number): void {
    const level = this.menuStack[depth];
    if (!level) return;

    if (level.focusedIndex >= 0) {
      const old = level.element.querySelector(
        `[data-index="${level.focusedIndex}"]`,
      ) as HTMLElement | null;
      if (old) old.style.backgroundColor = '';
    }

    level.focusedIndex = index;

    const el = level.element.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
    if (el) {
      el.style.backgroundColor = this.theme.colors.hoverRowBackground;
    }
  }

  private executeItem(depth: number, index: number): void {
    const level = this.menuStack[depth];
    if (!level) return;

    const item = level.items[index];
    if (!item || !this.currentContext) return;
    if (item.isDisabled && item.isDisabled(this.currentContext)) return;

    if (item.submenu && item.submenu.length > 0) {
      this.openSubmenu(depth, index);
      return;
    }

    if (!item.action) return;

    const ctx = this.currentContext;
    this.close();
    item.action(ctx);
  }

  private get activeDepth(): number {
    return this.menuStack.length - 1;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const depth = this.activeDepth;
    if (depth < 0) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (depth > 0) {
          this.closeSubmenusFrom(depth);
        } else {
          this.close();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveFocus(depth, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveFocus(depth, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.handleArrowRight(depth);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.handleArrowLeft(depth);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.menuStack[depth].focusedIndex >= 0) {
          this.executeItem(depth, this.menuStack[depth].focusedIndex);
        }
        break;
    }
  };

  private handleArrowRight(depth: number): void {
    const level = this.menuStack[depth];
    if (!level || level.focusedIndex < 0) return;

    const item = level.items[level.focusedIndex];
    if (item?.submenu && item.submenu.length > 0) {
      this.openSubmenu(depth, level.focusedIndex);
      const newDepth = depth + 1;
      if (this.menuStack[newDepth]) {
        this.moveFocus(newDepth, 1);
      }
    }
  }

  private handleArrowLeft(depth: number): void {
    if (depth > 0) {
      this.closeSubmenusFrom(depth);
    }
  }

  private moveFocus(depth: number, delta: number): void {
    const level = this.menuStack[depth];
    if (!level || level.items.length === 0) return;

    let next = level.focusedIndex + delta;
    if (next < 0) next = level.items.length - 1;
    if (next >= level.items.length) next = 0;

    const startIndex = next;
    while (true) {
      const item = level.items[next];
      if (!item.isDisabled || !this.currentContext || !item.isDisabled(this.currentContext)) break;
      next += delta > 0 ? 1 : -1;
      if (next < 0) next = level.items.length - 1;
      if (next >= level.items.length) next = 0;
      if (next === startIndex) break;
    }

    this.setFocused(depth, next);
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    for (const level of this.menuStack) {
      if (level.element.contains(e.target as Node)) return;
    }
    this.close();
  };
}
