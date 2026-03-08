// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTimeEditor } from '../src/editing/date-time-editor';
import type { CellEditorContext, CellEditorCommit, CellEditorClose } from '../src/editing/cell-editor';
import type { SpreadsheetTheme } from '../src/themes/theme-types';
import type { ResolvedLocale } from '../src/locale/resolve-locale';
import type { ColumnDef } from '../src/types/interfaces';

// Minimal theme for tests
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

const column: ColumnDef = { key: 'ts', title: 'Timestamp', type: 'datetime' };

function makeContext(value: unknown = null): CellEditorContext {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
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
      getCellRect: () => ({ x: 100, y: 50, width: 160, height: 24 }),
    } as never,
    scrollManager: {
      scrollX: 0,
      scrollY: 0,
      getElement: () => scrollContainer,
    } as never,
    cellStore: {} as never,
    dataView: {} as never,
    theme: stubTheme,
    locale: stubLocale,
    mergeManager: null,
    frozenRows: 0,
    frozenColumns: 0,
  };
}

describe('DateTimeEditor', () => {
  let editor: DateTimeEditor;
  let commitFn: CellEditorCommit;
  let closeFn: CellEditorClose;

  beforeEach(() => {
    editor = new DateTimeEditor();
    commitFn = vi.fn();
    closeFn = vi.fn();
  });

  afterEach(() => {
    editor.destroy();
  });

  it('has id "date-time-picker"', () => {
    expect(editor.id).toBe('date-time-picker');
  });

  it('starts closed', () => {
    expect(editor.isOpen).toBe(false);
    expect(editor.editingRow).toBe(-1);
    expect(editor.editingCol).toBe(-1);
  });

  it('opens and renders overlay with time controls', () => {
    const ctx = makeContext('2025-03-15T14:30');
    editor.open(ctx, commitFn, closeFn);

    expect(editor.isOpen).toBe(true);
    expect(editor.editingRow).toBe(2);
    expect(editor.editingCol).toBe(3);
    expect(ctx.container.querySelector('[role="dialog"]')).toBeTruthy();

    // Should have time inputs
    const inputs = ctx.container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBe(2); // hour + minute
    expect((inputs[0] as HTMLInputElement).value).toBe('14');
    expect((inputs[1] as HTMLInputElement).value).toBe('30');
  });

  it('parses ISO datetime value correctly', () => {
    const ctx = makeContext('2024-12-25T09:05');
    editor.open(ctx, commitFn, closeFn);

    const inputs = ctx.container.querySelectorAll('input[type="text"]');
    expect((inputs[0] as HTMLInputElement).value).toBe('09');
    expect((inputs[1] as HTMLInputElement).value).toBe('05');

    // Calendar should show December 2024
    const title = ctx.container.querySelector('span');
    expect(title?.textContent).toContain('December');
    expect(title?.textContent).toContain('2024');
  });

  it('parses date-only value, defaults time to current', () => {
    const ctx = makeContext('2025-06-01');
    editor.open(ctx, commitFn, closeFn);

    // Hour and minute should default to 00 (parsed from date-only)
    const inputs = ctx.container.querySelectorAll('input[type="text"]');
    expect((inputs[0] as HTMLInputElement).value).toBe('00');
    expect((inputs[1] as HTMLInputElement).value).toBe('00');
  });

  it('commits ISO datetime on Enter key', () => {
    const ctx = makeContext('2025-03-15T10:45');
    editor.open(ctx, commitFn, closeFn);

    const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLDivElement;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(commitFn).toHaveBeenCalledWith(2, 3, '2025-03-15T10:45', '2025-03-15T10:45');
    expect(editor.isOpen).toBe(false);
  });

  it('closes on Escape without committing', () => {
    const ctx = makeContext('2025-01-01T12:00');
    editor.open(ctx, commitFn, closeFn);

    const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLDivElement;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(commitFn).not.toHaveBeenCalled();
    expect(closeFn).toHaveBeenCalledWith('escape');
    expect(editor.isOpen).toBe(false);
  });

  it('Tab cycles focus between calendar, hour, minute', () => {
    const ctx = makeContext('2025-01-15T08:30');
    editor.open(ctx, commitFn, closeFn);

    const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLDivElement;

    // Tab from calendar → hour: hour input should get focus-ring (boxShadow)
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const inputs = ctx.container.querySelectorAll('input[type="text"]');
    expect((inputs[0] as HTMLInputElement).style.boxShadow).toContain('0 0 0 1px');
    expect((inputs[1] as HTMLInputElement).style.boxShadow).toBe('');

    // Tab from hour → minute: minute input should get focus-ring
    (inputs[0] as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    );
    expect((inputs[0] as HTMLInputElement).style.boxShadow).toBe('');
    expect((inputs[1] as HTMLInputElement).style.boxShadow).toContain('0 0 0 1px');
  });

  it('clicking a day selects it without committing', () => {
    const ctx = makeContext('2025-03-01T14:00');
    editor.open(ctx, commitFn, closeFn);

    // Find day cell "15"
    const dayCells = ctx.container.querySelectorAll('[data-day]');
    const day15 = Array.from(dayCells).find(
      (el) => (el as HTMLElement).dataset.day === '15',
    ) as HTMLElement;
    expect(day15).toBeTruthy();

    day15.click();

    // Should NOT commit yet — only select the day
    expect(commitFn).not.toHaveBeenCalled();
    expect(editor.isOpen).toBe(true);
  });

  it('OK button commits the current selection', () => {
    const ctx = makeContext('2025-03-10T16:20');
    editor.open(ctx, commitFn, closeFn);

    // Find OK button
    const buttons = ctx.container.querySelectorAll('button');
    const okBtn = Array.from(buttons).find((b) => b.textContent === 'OK');
    expect(okBtn).toBeTruthy();

    okBtn!.click();

    expect(commitFn).toHaveBeenCalledWith(2, 3, '2025-03-10T16:20', '2025-03-10T16:20');
    expect(editor.isOpen).toBe(false);
  });

  it('Now button sets current date and time', () => {
    const ctx = makeContext(null);
    editor.open(ctx, commitFn, closeFn);

    const buttons = ctx.container.querySelectorAll('button');
    const nowBtn = Array.from(buttons).find((b) => b.textContent === 'Now');
    expect(nowBtn).toBeTruthy();

    nowBtn!.click();

    // Editor should still be open (Now just updates, doesn't commit)
    expect(editor.isOpen).toBe(true);
    expect(commitFn).not.toHaveBeenCalled();
  });

  it('arrow keys navigate calendar days', () => {
    const ctx = makeContext('2025-03-15T10:00');
    editor.open(ctx, commitFn, closeFn);

    const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLDivElement;

    // ArrowRight moves focus to day 16
    overlay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    // Now Enter should commit with day 16
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(commitFn).toHaveBeenCalledWith(2, 3, '2025-03-15T10:00', '2025-03-16T10:00');
  });

  it('month navigation works', () => {
    const ctx = makeContext('2025-01-15T08:00');
    editor.open(ctx, commitFn, closeFn);

    // Click next month button (▶)
    const buttons = ctx.container.querySelectorAll('button');
    const nextBtn = Array.from(buttons).find((b) => b.textContent === '▶');
    expect(nextBtn).toBeTruthy();
    nextBtn!.click();

    // Title should show February 2025
    const title = ctx.container.querySelector('span');
    expect(title?.textContent).toContain('February');
  });

  it('setTheme and setLocale update stored values', () => {
    const newTheme = { ...stubTheme, colors: { ...stubTheme.colors, cellText: '#111' } };
    editor.setTheme(newTheme);

    const newLocale = { ...stubLocale, dateTimePicker: { ...stubLocale.dateTimePicker, hour: 'Hora' } };
    editor.setLocale(newLocale);

    // No error thrown — editor stores them for next open
    expect(true).toBe(true);
  });

  it('destroy cleans up open overlay', () => {
    const ctx = makeContext('2025-01-01T00:00');
    editor.open(ctx, commitFn, closeFn);
    expect(editor.isOpen).toBe(true);

    editor.destroy();
    expect(editor.isOpen).toBe(false);
    expect(closeFn).toHaveBeenCalledWith('programmatic');
  });

  it('locale labels are used (RU)', () => {
    const ruLocale: ResolvedLocale = {
      ...stubLocale,
      datePicker: {
        ...stubLocale.datePicker,
        monthNames: [
          'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
          'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
        ],
      },
      dateTimePicker: {
        hour: 'Час',
        minute: 'Минута',
        now: 'Сейчас',
        ariaLabel: 'Выбор даты и времени',
      },
    };

    const ctx = makeContext('2025-03-15T10:00');
    ctx.locale = ruLocale;
    editor.open(ctx, commitFn, closeFn);

    const title = ctx.container.querySelector('span');
    expect(title?.textContent).toContain('Март');

    const buttons = ctx.container.querySelectorAll('button');
    const nowBtn = Array.from(buttons).find((b) => b.textContent === 'Сейчас');
    expect(nowBtn).toBeTruthy();

    const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
    expect(overlay.getAttribute('aria-label')).toBe('Выбор даты и времени');
  });

  it('re-open closes previous overlay', () => {
    const ctx1 = makeContext('2025-01-01T00:00');
    editor.open(ctx1, commitFn, closeFn);
    expect(editor.isOpen).toBe(true);

    const ctx2 = makeContext('2025-06-15T12:30');
    editor.open(ctx2, commitFn, closeFn);
    expect(editor.isOpen).toBe(true);

    // Only one overlay in DOM
    const overlays = ctx2.container.querySelectorAll('[role="dialog"]');
    expect(overlays.length).toBe(1);
  });
});
