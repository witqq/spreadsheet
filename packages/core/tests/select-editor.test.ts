// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SelectEditor } from '../src/editing/select-editor';
import type {
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
} from '../src/editing/cell-editor';
import type { SpreadsheetTheme } from '../src/themes/theme-types';
import type { ResolvedLocale } from '../src/locale/resolve-locale';
import type { ColumnDef, SelectOption } from '../src/types/interfaces';

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

const sampleOptions: SelectOption[] = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'purple', label: 'Purple' },
];

function makeColumn(options: SelectOption[] = sampleOptions): ColumnDef {
  return { key: 'color', title: 'Color', type: 'select', selectOptions: options };
}

// ─── Helpers ──────────────────────────────────────

function makeContext(value: unknown = null, options?: SelectOption[]): CellEditorContext {
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
    row: 1,
    col: 2,
    value: value as never,
    column: makeColumn(options),
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

function pressKey(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function getOverlay(ctx: CellEditorContext): HTMLElement {
  return ctx.container.querySelector('[role="dialog"]') as HTMLElement;
}

function getOptions(overlay: HTMLElement): NodeListOf<HTMLElement> {
  return overlay.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>;
}

function getSearchInput(overlay: HTMLElement): HTMLInputElement {
  return overlay.querySelector('input[type="text"]') as HTMLInputElement;
}

// ─── Tests ──────────────────────────────────────

describe('SelectEditor', () => {
  let editor: SelectEditor;
  let commitFn: CellEditorCommit;
  let closeFn: CellEditorClose;

  beforeEach(() => {
    editor = new SelectEditor();
    editor.setTheme(stubTheme);
    editor.setLocale(stubLocale);
    commitFn = vi.fn();
    closeFn = vi.fn();
  });

  afterEach(() => {
    editor.destroy();
  });

  // ─── Rendering ──────────────────────────────────────

  describe('rendering', () => {
    it('renders overlay with listbox and options', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      expect(overlay).toBeTruthy();
      expect(overlay.getAttribute('aria-label')).toBe('Select option');

      const listbox = overlay.querySelector('[role="listbox"]');
      expect(listbox).toBeTruthy();

      const options = getOptions(overlay);
      expect(options.length).toBe(5);
      expect(options[0].textContent).toBe('Red');
      expect(options[4].textContent).toBe('Purple');
    });

    it('renders search input with placeholder', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const input = getSearchInput(overlay);
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('Search...');
    });

    it('uses label-less options showing value', () => {
      const opts: SelectOption[] = [
        { value: 'a' },
        { value: 'b' },
      ];
      const ctx = makeContext(null, opts);
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);
      expect(options[0].textContent).toBe('a');
      expect(options[1].textContent).toBe('b');
    });
  });

  // ─── Pre-selection ──────────────────────────────────────

  describe('pre-selection', () => {
    it('highlights current cell value', () => {
      const ctx = makeContext('green');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);

      // "green" is index 1
      expect(options[1].getAttribute('aria-selected')).toBe('true');
      expect(options[1].style.backgroundColor).toBeTruthy();
    });

    it('bolds current value option', () => {
      const ctx = makeContext('blue');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);

      // "blue" is index 2
      expect(options[2].style.fontWeight).toBe('bold');
    });

    it('defaults to first option when value not found', () => {
      const ctx = makeContext('unknown');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);
      expect(options[0].getAttribute('aria-selected')).toBe('true');
    });
  });

  // ─── Keyboard navigation ──────────────────────────────

  describe('keyboard navigation', () => {
    it('ArrowDown moves highlight forward', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'ArrowDown');

      const options = getOptions(overlay);
      expect(options[0].getAttribute('aria-selected')).toBe('false');
      expect(options[1].getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowUp moves highlight backward', () => {
      const ctx = makeContext('green');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'ArrowUp');

      const options = getOptions(overlay);
      expect(options[0].getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowDown wraps to first option', () => {
      const ctx = makeContext('purple');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'ArrowDown');

      const options = getOptions(overlay);
      expect(options[0].getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowUp wraps to last option', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'ArrowUp');

      const options = getOptions(overlay);
      expect(options[4].getAttribute('aria-selected')).toBe('true');
    });

    it('Enter commits highlighted option', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'ArrowDown');
      pressKey(overlay, 'Enter');

      expect(commitFn).toHaveBeenCalledWith(1, 2, 'red', 'green');
      expect(closeFn).toHaveBeenCalledWith('enter');
    });

    it('Tab commits highlighted option', () => {
      const ctx = makeContext(null);
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'Tab');

      expect(commitFn).toHaveBeenCalledWith(1, 2, null, 'red');
      expect(closeFn).toHaveBeenCalledWith('enter');
    });

    it('Escape closes without commit', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      pressKey(overlay, 'Escape');

      expect(commitFn).not.toHaveBeenCalled();
      expect(closeFn).toHaveBeenCalledWith('escape');
    });
  });

  // ─── Type-ahead filtering ──────────────────────────────

  describe('type-ahead filtering', () => {
    it('filters options on input', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const input = getSearchInput(overlay);

      // Simulate typing "gre"
      input.value = 'gre';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const options = getOptions(overlay);
      expect(options.length).toBe(1);
      expect(options[0].textContent).toBe('Green');
    });

    it('shows empty state when no match', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const input = getSearchInput(overlay);

      input.value = 'xyz';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const options = getOptions(overlay);
      expect(options.length).toBe(0);

      const noResults = overlay.querySelector('[role="listbox"]')!;
      expect(noResults.textContent).toContain('No results');
    });

    it('case-insensitive filter', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const input = getSearchInput(overlay);

      input.value = 'BLU';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      const options = getOptions(overlay);
      expect(options.length).toBe(1);
      expect(options[0].textContent).toBe('Blue');
    });

    it('restores full list when search cleared', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const input = getSearchInput(overlay);

      input.value = 'red';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(getOptions(overlay).length).toBe(1);

      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(getOptions(overlay).length).toBe(5);
    });
  });

  // ─── Mouse interaction ──────────────────────────────

  describe('mouse interaction', () => {
    it('click on option commits value', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);

      options[2].click(); // Click "Blue"

      expect(commitFn).toHaveBeenCalledWith(1, 2, 'red', 'blue');
      expect(closeFn).toHaveBeenCalledWith('enter');
    });

    it('mouseenter highlights option', () => {
      const ctx = makeContext('red');
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);

      options[3].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      expect(options[3].getAttribute('aria-selected')).toBe('true');
      expect(options[0].getAttribute('aria-selected')).toBe('false');
    });
  });

  // ─── Empty options ──────────────────────────────────

  describe('empty options', () => {
    it('handles column with no selectOptions', () => {
      const ctx = makeContext(null, []);
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      const options = getOptions(overlay);
      expect(options.length).toBe(0);
    });
  });

  // ─── Locale ──────────────────────────────────

  describe('locale', () => {
    it('uses locale strings', () => {
      const ruLocale = {
        ...stubLocale,
        select: {
          ariaLabel: 'Выберите значение',
          searchPlaceholder: 'Поиск...',
          noResults: 'Нет результатов',
        },
      } as ResolvedLocale;
      editor.setLocale(ruLocale);

      const ctx = makeContext();
      ctx.locale = ruLocale;
      editor.open(ctx, commitFn, closeFn);

      const overlay = getOverlay(ctx);
      expect(overlay.getAttribute('aria-label')).toBe('Выберите значение');

      const input = getSearchInput(overlay);
      expect(input.placeholder).toBe('Поиск...');
    });
  });
});
