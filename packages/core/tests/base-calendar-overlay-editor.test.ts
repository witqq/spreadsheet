// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseCalendarOverlayEditor } from '../src/editing/base-calendar-overlay-editor';
import type {
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
} from '../src/editing/cell-editor';
import type { SpreadsheetTheme } from '../src/themes/theme-types';
import type { ResolvedLocale } from '../src/locale/resolve-locale';
import type { ColumnDef, CellValue } from '../src/types/interfaces';

// ─── Stubs ──────────────────────────────────────

const stubTheme: SpreadsheetTheme = {
  colors: {
    cellBackground: '#fff',
    cellText: '#000',
    cellEditBackground: '#fff',
    gridLine: '#ccc',
    headerBackground: '#f5f5f5',
    headerText: '#333',
    selectionBorder: 'blue',
    selectionFill: 'rgba(0,0,255,0.1)',
    activeCellBorder: '#4a90d9',
    frozenLineBorder: '#aaa',
    scrollbarThumb: '#bbb',
    scrollbarTrack: '#eee',
  },
  fonts: {
    cell: 'Arial',
    cellSize: 12,
    header: 'Arial',
    headerSize: 12,
  },
};

const stubLocale: ResolvedLocale = {
  formatLocale: 'en-US',
  datePicker: {
    weekLabels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthNames: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    today: 'Today',
    ariaLabel: 'Date picker',
  },
  dateTimePicker: {
    hour: 'Hour',
    minute: 'Minute',
    now: 'Now',
    ariaLabel: 'Date and time picker',
  },
  select: {
    ariaLabel: 'Select option',
    searchPlaceholder: 'Search...',
    noResults: 'No results',
  },
  contextMenu: {
    cut: 'Cut', copy: 'Copy', paste: 'Paste',
    sortAscending: 'Sort Ascending', sortDescending: 'Sort Descending',
    insertRowAbove: 'Insert Row Above', insertRowBelow: 'Insert Row Below',
    deleteRow: 'Delete Row',
  },
  filter: {
    equals: 'Equals', notEquals: 'Not equals', contains: 'Contains',
    startsWith: 'Starts with', endsWith: 'Ends with',
    greaterThan: 'Greater than', lessThan: 'Less than',
    greaterOrEqual: 'Greater or equal', lessOrEqual: 'Less or equal',
    between: 'Between', isEmpty: 'Is empty', isNotEmpty: 'Is not empty',
    valuePlaceholder: '', toValuePlaceholder: '', apply: 'Apply', clear: 'Clear',
  },
  grouping: { sum: 'Sum', count: 'Count', avg: 'Avg', min: 'Min', max: 'Max' },
  emptyState: { noData: 'No data' },
  print: { showingRows: '' },
  aria: {
    cellAnnouncement: '', cellEmpty: '', sortCleared: '',
    sortAscending: '', sortDescending: '', sortedBy: '',
    filterCleared: '', filterActive: '',
  },
};

const column: ColumnDef = { key: 'date', title: 'Date', type: 'date' };

// ─── Concrete test subclass ──────────────────────────────

class TestCalendarEditor extends BaseCalendarOverlayEditor {
  readonly id = 'test-calendar';

  public dayClicks: number[] = [];
  public keyDownCalls: KeyboardEvent[] = [];

  protected get overlayWidth(): number {
    return 200;
  }

  protected get overlayHeight(): number {
    return 250;
  }

  protected parseValue(value: CellValue): Date | null {
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  protected getAriaLabel(): string {
    return 'Test calendar';
  }

  protected initializeState(): void {
    // no extra state
  }

  protected renderContent(): void {
    this.renderCalendarGrid((day) => {
      this.dayClicks.push(day);
    });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    this.keyDownCalls.push(e);
    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close('escape');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.moveFocus(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveFocus(-7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.moveFocus(7);
        break;
    }
  }
}

// ─── Helpers ──────────────────────────────────────

function makeContext(value: unknown = null): CellEditorContext {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      x: 0, y: 0, width: 800, height: 600,
      top: 0, left: 0, right: 800, bottom: 600,
    }),
    configurable: true,
  });
  const scrollContainer = document.createElement('div');

  return {
    row: 2,
    col: 3,
    value: value as never,
    column,
    container,
    scrollContainer,
    layoutEngine: {
      getCellRect: () => ({ x: 100, y: 50, width: 120, height: 24 }),
    } as never,
    scrollManager: { scrollX: 0, scrollY: 0 } as never,
    cellStore: {} as never,
    dataView: {} as never,
    theme: stubTheme,
    locale: stubLocale,
    mergeManager: null,
    frozenRows: 0,
    frozenColumns: 0,
  };
}

function pressKey(overlay: HTMLElement, key: string): void {
  overlay.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ─── Tests ──────────────────────────────────────

describe('BaseCalendarOverlayEditor', () => {
  let editor: TestCalendarEditor;
  let commitFn: CellEditorCommit;
  let closeFn: CellEditorClose;

  beforeEach(() => {
    editor = new TestCalendarEditor();
    commitFn = vi.fn();
    closeFn = vi.fn();
  });

  afterEach(() => {
    editor.destroy();
  });

  // ─── Calendar rendering ──────────────────────────────

  describe('calendar rendering', () => {
    it('renders calendar grid with month header and day cells', () => {
      const ctx = makeContext('2025-03-15');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]')!;
      const spans = overlay.querySelectorAll('span');
      const titleSpan = Array.from(spans).find((s) => s.textContent?.includes('March'));
      expect(titleSpan).toBeTruthy();
      expect(titleSpan!.textContent).toBe('March 2025');

      // Should have day cells (March has 31 days)
      const dayCells = overlay.querySelectorAll('[data-day]');
      expect(dayCells.length).toBe(31);
    });
  });

  // ─── Calendar navigation ──────────────────────────────

  describe('calendar navigation', () => {
    it('ArrowRight moves focus by 1 day', () => {
      const ctx = makeContext('2025-03-15');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'ArrowRight');

      const day16 = overlay.querySelector('[data-day="16"]') as HTMLElement;
      expect(day16.style.backgroundColor).toBeTruthy();
      expect(day16.style.backgroundColor).not.toBe('');
    });

    it('ArrowDown moves focus by 7 days', () => {
      const ctx = makeContext('2025-03-15');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'ArrowDown');

      const day22 = overlay.querySelector('[data-day="22"]') as HTMLElement;
      expect(day22.style.backgroundColor).toBeTruthy();
      expect(day22.style.backgroundColor).not.toBe('');
    });

    it('navigates to previous month when focus goes before day 1', () => {
      const ctx = makeContext('2025-03-02');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'ArrowLeft');
      pressKey(overlay, 'ArrowLeft');

      const spans = overlay.querySelectorAll('span');
      const titleSpan = Array.from(spans).find((s) => s.textContent?.includes('February'));
      expect(titleSpan).toBeTruthy();
    });

    it('navigates to next month when focus exceeds last day', () => {
      const ctx = makeContext('2025-03-31');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'ArrowRight');

      const spans = overlay.querySelectorAll('span');
      const titleSpan = Array.from(spans).find((s) => s.textContent?.includes('April'));
      expect(titleSpan).toBeTruthy();
    });
  });

  // ─── Day click ──────────────────────────────────────

  describe('day click', () => {
    it('dispatches day click to subclass callback', () => {
      const ctx = makeContext('2025-03-15');
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      const day20 = overlay.querySelector('[data-day="20"]') as HTMLElement;
      day20.click();

      expect(editor.dayClicks).toEqual([20]);
    });
  });

  // ─── Locale ──────────────────────────────────────

  describe('locale', () => {
    it('uses locale month names', () => {
      const newLocale = {
        ...stubLocale,
        datePicker: {
          ...stubLocale.datePicker!,
          monthNames: [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
          ],
        },
      } as ResolvedLocale;
      editor.setLocale(newLocale);

      const ctx = makeContext('2025-03-15');
      ctx.locale = newLocale;
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]')!;
      const spans = overlay.querySelectorAll('span');
      const titleSpan = Array.from(spans).find((s) => s.textContent?.includes('Март'));
      expect(titleSpan).toBeTruthy();
    });
  });
});
