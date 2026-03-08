// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatePickerOverlay } from '../src/editing/date-picker-overlay';
import type { DatePickerConfig } from '../src/editing/date-picker-overlay';
import type { LayoutEngine } from '../src/renderer/layout-engine';
import type { ScrollManager } from '../src/renderer/scroll-manager';
import type { SpreadsheetTheme } from '../src/themes/theme-types';
import { lightTheme } from '../src/themes/built-in-themes';

function createMockContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {} }),
  });
  return el;
}

function createMockScrollContainer(): HTMLElement {
  const el = document.createElement('div');
  el.tabIndex = 0;
  return el;
}

function createMockLayoutEngine(): LayoutEngine {
  return {
    getCellRect: vi.fn().mockReturnValue({ x: 100, y: 50, width: 120, height: 28 }),
    headerHeight: 28,
    rowHeight: 28,
  } as unknown as LayoutEngine;
}

function createMockScrollManager(): ScrollManager {
  return {
    scrollX: 0,
    scrollY: 0,
    getElement: vi.fn().mockReturnValue(createMockScrollContainer()),
  } as unknown as ScrollManager;
}

function createConfig(overrides?: Partial<DatePickerConfig>): DatePickerConfig {
  return {
    container: createMockContainer(),
    scrollContainer: createMockScrollContainer(),
    layoutEngine: createMockLayoutEngine(),
    scrollManager: createMockScrollManager(),
    theme: lightTheme as SpreadsheetTheme,
    onCommit: vi.fn(),
    onClose: vi.fn(),
    frozenRows: 0,
    frozenColumns: 0,
    ...overrides,
  };
}

describe('DatePickerOverlay', () => {
  let config: DatePickerConfig;
  let picker: DatePickerOverlay;

  beforeEach(() => {
    config = createConfig();
    picker = new DatePickerOverlay(config);
  });

  describe('lifecycle', () => {
    it('starts closed', () => {
      expect(picker.isOpen).toBe(false);
    });

    it('opens with a date value', () => {
      picker.open(0, 0, '2025-03-15');
      expect(picker.isOpen).toBe(true);
      expect(picker.editingRow).toBe(0);
      expect(picker.editingCol).toBe(0);
    });

    it('opens with null value (shows current month)', () => {
      picker.open(2, 3, null);
      expect(picker.isOpen).toBe(true);
    });

    it('opens with Date object', () => {
      picker.open(0, 0, new Date(2024, 5, 15));
      expect(picker.isOpen).toBe(true);
    });

    it('closes with reason', () => {
      picker.open(0, 0, null);
      picker.close('escape');
      expect(picker.isOpen).toBe(false);
      expect(config.onClose).toHaveBeenCalledWith('escape');
    });

    it('appends overlay to container on open', () => {
      picker.open(0, 0, null);
      expect(config.container.children.length).toBe(1);
    });

    it('removes overlay from container on close', () => {
      picker.open(0, 0, null);
      picker.close('escape');
      expect(config.container.children.length).toBe(0);
    });

    it('commits previous if open when re-opened', () => {
      const onClose = vi.fn();
      const cfg = createConfig({ onClose });
      const p = new DatePickerOverlay(cfg);
      p.open(0, 0, null);
      p.open(1, 1, null);
      expect(onClose).toHaveBeenCalledWith('programmatic');
      expect(p.isOpen).toBe(true);
      expect(p.editingRow).toBe(1);
    });

    it('destroy closes if open', () => {
      picker.open(0, 0, null);
      picker.destroy();
      expect(picker.isOpen).toBe(false);
      expect(config.onClose).toHaveBeenCalledWith('programmatic');
    });
  });

  describe('positioning', () => {
    it('positions overlay below the cell', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.style.position).toBe('absolute');
      // y = 50 (cell top) + 28 (cell height) = 78
      expect(overlay.style.top).toBe('78px');
      expect(overlay.style.left).toBe('100px');
    });

    it('uses z-index 50', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.style.zIndex).toBe('50');
    });
  });

  describe('calendar rendering', () => {
    it('renders month name and year in header', () => {
      picker.open(0, 0, '2025-01-15');
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.textContent).toContain('January');
      expect(overlay.textContent).toContain('2025');
    });

    it('renders day-of-week labels', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.textContent).toContain('Su');
      expect(overlay.textContent).toContain('Mo');
      expect(overlay.textContent).toContain('Sa');
    });

    it('renders correct number of day cells', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      const dayCells = overlay.querySelectorAll('[data-day]');
      expect(dayCells.length).toBe(31); // March has 31 days
    });

    it('renders 28 days for February (non-leap year)', () => {
      picker.open(0, 0, '2025-02-15');
      const overlay = config.container.children[0] as HTMLElement;
      const dayCells = overlay.querySelectorAll('[data-day]');
      expect(dayCells.length).toBe(28);
    });

    it('renders Today button', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      const buttons = overlay.querySelectorAll('button');
      const todayBtn = Array.from(buttons).find(b => b.textContent === 'Today');
      expect(todayBtn).toBeDefined();
    });

    it('renders navigation buttons', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      const buttons = overlay.querySelectorAll('button');
      const prevBtn = Array.from(buttons).find(b => b.textContent === '◀');
      const nextBtn = Array.from(buttons).find(b => b.textContent === '▶');
      expect(prevBtn).toBeDefined();
      expect(nextBtn).toBeDefined();
    });
  });

  describe('date selection', () => {
    it('commits date on day click', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      const day20 = overlay.querySelector('[data-day="20"]') as HTMLElement;
      day20.click();
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-20');
      expect(picker.isOpen).toBe(false);
    });

    it('commits date in YYYY-MM-DD format', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      const day1 = overlay.querySelector('[data-day="1"]') as HTMLElement;
      day1.click();
      const call = (config.onCommit as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('closes picker after selection', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      const day10 = overlay.querySelector('[data-day="10"]') as HTMLElement;
      day10.click();
      expect(picker.isOpen).toBe(false);
      expect(config.onClose).toHaveBeenCalledWith('enter');
    });
  });

  describe('keyboard navigation', () => {
    function pressKey(overlay: HTMLElement, key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      overlay.dispatchEvent(event);
    }

    it('Escape closes without commit', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'Escape');
      expect(picker.isOpen).toBe(false);
      expect(config.onCommit).not.toHaveBeenCalled();
      expect(config.onClose).toHaveBeenCalledWith('escape');
    });

    it('Enter selects focused day', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'Enter');
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-15');
    });

    it('ArrowRight moves focus by 1 day', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'ArrowRight');
      pressKey(overlay, 'Enter');
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-16');
    });

    it('ArrowLeft moves focus by -1 day', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'ArrowLeft');
      pressKey(overlay, 'Enter');
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-14');
    });

    it('ArrowDown moves focus by 7 days', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'ArrowDown');
      pressKey(overlay, 'Enter');
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-22');
    });

    it('ArrowUp moves focus by -7 days', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'ArrowUp');
      pressKey(overlay, 'Enter');
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-15', '2025-03-08');
    });

    it('Tab selects focused day', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      pressKey(overlay, 'Tab');
      expect(config.onCommit).toHaveBeenCalled();
    });
  });

  describe('month navigation', () => {
    it('prev button navigates to previous month', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      const prevBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === '◀')!;
      prevBtn.click();
      expect(overlay.textContent).toContain('February');
    });

    it('next button navigates to next month', () => {
      picker.open(0, 0, '2025-03-15');
      const overlay = config.container.children[0] as HTMLElement;
      const nextBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === '▶')!;
      nextBtn.click();
      expect(overlay.textContent).toContain('April');
    });

    it('navigating past December wraps to next year January', () => {
      picker.open(0, 0, '2025-12-15');
      const overlay = config.container.children[0] as HTMLElement;
      const nextBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === '▶')!;
      nextBtn.click();
      expect(overlay.textContent).toContain('January');
      expect(overlay.textContent).toContain('2026');
    });

    it('navigating before January wraps to previous year December', () => {
      picker.open(0, 0, '2025-01-15');
      const overlay = config.container.children[0] as HTMLElement;
      const prevBtn = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent === '◀')!;
      prevBtn.click();
      expect(overlay.textContent).toContain('December');
      expect(overlay.textContent).toContain('2024');
    });

    it('arrow key past month end navigates to next month', () => {
      picker.open(0, 0, '2025-03-31');
      const overlay = config.container.children[0] as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      overlay.dispatchEvent(event);
      // Should now be April 1
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      overlay.dispatchEvent(enterEvent);
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-31', '2025-04-01');
    });

    it('arrow key before month start navigates to previous month', () => {
      picker.open(0, 0, '2025-03-01');
      const overlay = config.container.children[0] as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      overlay.dispatchEvent(event);
      // Should now be Feb 28
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      overlay.dispatchEvent(enterEvent);
      expect(config.onCommit).toHaveBeenCalledWith(0, 0, '2025-03-01', '2025-02-28');
    });
  });

  describe('scroll handling', () => {
    it('scroll event closes picker', () => {
      picker.open(0, 0, null);
      config.scrollContainer.dispatchEvent(new Event('scroll'));
      expect(picker.isOpen).toBe(false);
      expect(config.onClose).toHaveBeenCalledWith('scroll');
    });

    it('scroll does not close for frozen corner cells', () => {
      const cfg = createConfig({ frozenRows: 1, frozenColumns: 1 });
      const p = new DatePickerOverlay(cfg);
      p.open(0, 0, null); // row 0 < frozenRows, col 0 < frozenCols
      cfg.scrollContainer.dispatchEvent(new Event('scroll'));
      expect(p.isOpen).toBe(true);
    });
  });

  describe('setTheme', () => {
    it('updates theme without error', () => {
      const newTheme = { ...lightTheme } as SpreadsheetTheme;
      expect(() => picker.setTheme(newTheme)).not.toThrow();
    });
  });

  describe('aria attributes', () => {
    it('has role=dialog', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.getAttribute('role')).toBe('dialog');
    });

    it('has aria-label', () => {
      picker.open(0, 0, null);
      const overlay = config.container.children[0] as HTMLElement;
      expect(overlay.getAttribute('aria-label')).toBe('Date picker');
    });
  });
});
