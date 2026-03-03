// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ContextMenuManager — manages a right-click context menu overlay.
 *
 * Subscribes to gridContextMenu events, renders a positioned DOM menu,
 * filters items by region context, and supports extensible item registration.
 */

import type { EventBus } from '../events/event-bus';
import type { GridMouseEvent } from '../events/event-types';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { SpreadsheetEngine } from '../engine/spreadsheet-engine';

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
  action: (ctx: MenuActionContext) => void;
  isDisabled?: (ctx: MenuActionContext) => boolean;
  isVisible?: (ctx: MenuActionContext) => boolean;
}

export interface ContextMenuManagerConfig {
  container: HTMLElement;
  engine: SpreadsheetEngine;
  eventBus: EventBus;
  theme: SpreadsheetTheme;
}

export class ContextMenuManager {
  private readonly container: HTMLElement;
  private readonly engine: SpreadsheetEngine;
  private readonly eventBus: EventBus;
  private theme: SpreadsheetTheme;
  private readonly items: Map<string, ContextMenuItem> = new Map();
  private menuElement: HTMLDivElement | null = null;
  private focusedIndex = -1;
  private visibleItems: ContextMenuItem[] = [];
  private currentContext: MenuActionContext | null = null;
  private outsideClickTimer: ReturnType<typeof setTimeout> | null = null;

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
    return this.menuElement !== null;
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
  }

  /** Close the menu if open. */
  close(): void {
    if (this.outsideClickTimer !== null) {
      clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }

    if (!this.menuElement) return;

    this.menuElement.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleOutsideClick);

    if (this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
    this.menuElement = null;
    this.focusedIndex = -1;
    this.visibleItems = [];
    this.currentContext = null;
  }

  /** Clean up on engine destroy. */
  destroy(): void {
    this.close();
    this.eventBus.off('gridContextMenu', this.handleContextMenu);
  }

  private handleContextMenu = (event: GridMouseEvent): void => {
    event.originalEvent.preventDefault();

    // Close any existing menu
    this.close();

    // Map the hit region to a MenuContext
    const menuContext = this.regionToMenuContext(event.region);
    if (!menuContext) return;

    const ctx: MenuActionContext = {
      row: event.row,
      col: event.col,
      region: event.region,
      engine: this.engine,
    };
    this.currentContext = ctx;

    // Filter items for this context
    this.visibleItems = [];
    for (const item of this.items.values()) {
      if (!item.contexts.includes(menuContext)) continue;
      if (item.isVisible && !item.isVisible(ctx)) continue;
      this.visibleItems.push(item);
    }

    if (this.visibleItems.length === 0) return;

    // Create menu DOM
    this.menuElement = document.createElement('div');
    this.styleMenu(this.menuElement);

    for (let i = 0; i < this.visibleItems.length; i++) {
      const item = this.visibleItems[i];
      const disabled = item.isDisabled ? item.isDisabled(ctx) : false;
      const row = this.createMenuItemElement(item, i, disabled);
      this.menuElement.appendChild(row);

      if (item.separator && i < this.visibleItems.length - 1) {
        const sep = document.createElement('div');
        sep.style.height = '1px';
        sep.style.backgroundColor = this.theme.colors.gridLine;
        sep.style.margin = '4px 0';
        this.menuElement.appendChild(sep);
      }
    }

    this.container.appendChild(this.menuElement);

    // Position at mouse coordinates, clamped to container
    this.positionMenu(event.originalEvent.clientX, event.originalEvent.clientY);

    // Focus for keyboard navigation
    this.menuElement.setAttribute('tabindex', '-1');
    this.menuElement.focus();
    this.menuElement.addEventListener('keydown', this.handleKeyDown);

    // Dismiss on outside click (use setTimeout so the current event doesn't trigger it)
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

  private createMenuItemElement(item: ContextMenuItem, index: number, disabled: boolean): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.index = String(index);

    const s = row.style;
    s.display = 'flex';
    s.alignItems = 'center';
    s.padding = '6px 12px';
    s.cursor = disabled ? 'default' : 'pointer';
    s.opacity = disabled ? '0.4' : '1';
    s.gap = '8px';

    // Icon
    if (item.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.textContent = item.icon;
      iconSpan.style.width = '20px';
      iconSpan.style.textAlign = 'center';
      row.appendChild(iconSpan);
    }

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.textContent = item.label;
    labelSpan.style.flex = '1';
    row.appendChild(labelSpan);

    // Shortcut
    if (item.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.textContent = item.shortcut;
      shortcutSpan.style.marginLeft = '24px';
      shortcutSpan.style.opacity = '0.5';
      shortcutSpan.style.fontSize = `${Math.max(this.theme.fonts.cellSize - 1, 10)}px`;
      row.appendChild(shortcutSpan);
    }

    if (!disabled) {
      row.addEventListener('mouseenter', () => {
        this.setFocused(index);
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.executeItem(index);
      });
    }

    return row;
  }

  private positionMenu(clientX: number, clientY: number): void {
    if (!this.menuElement) return;

    const containerRect = this.container.getBoundingClientRect();
    let x = clientX - containerRect.left;
    let y = clientY - containerRect.top;

    // Measure menu size
    const menuRect = this.menuElement.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;

    // Clamp to container
    if (x + menuWidth > containerRect.width) {
      x = containerRect.width - menuWidth;
    }
    if (y + menuHeight > containerRect.height) {
      y = containerRect.height - menuHeight;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
  }

  private setFocused(index: number): void {
    if (!this.menuElement) return;

    // Remove old highlight
    if (this.focusedIndex >= 0) {
      const old = this.menuElement.querySelector(`[data-index="${this.focusedIndex}"]`) as HTMLElement | null;
      if (old) old.style.backgroundColor = '';
    }

    this.focusedIndex = index;

    // Apply highlight
    const el = this.menuElement.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
    if (el) {
      el.style.backgroundColor = this.theme.colors.hoverRowBackground;
    }
  }

  private executeItem(index: number): void {
    const item = this.visibleItems[index];
    if (!item || !this.currentContext) return;
    if (item.isDisabled && item.isDisabled(this.currentContext)) return;

    const ctx = this.currentContext;
    this.close();
    item.action(ctx);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.focusedIndex >= 0) {
          this.executeItem(this.focusedIndex);
        }
        break;
    }
  };

  private moveFocus(delta: number): void {
    if (this.visibleItems.length === 0) return;

    let next = this.focusedIndex + delta;
    if (next < 0) next = this.visibleItems.length - 1;
    if (next >= this.visibleItems.length) next = 0;

    // Skip disabled items
    const startIndex = next;
    while (true) {
      const item = this.visibleItems[next];
      if (!item.isDisabled || !this.currentContext || !item.isDisabled(this.currentContext)) break;
      next += delta > 0 ? 1 : -1;
      if (next < 0) next = this.visibleItems.length - 1;
      if (next >= this.visibleItems.length) next = 0;
      if (next === startIndex) break; // all disabled
    }

    this.setFocused(next);
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
      this.close();
    }
  };
}
