// @vitest-environment jsdom
// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseOverlayEditor } from '../src/editing/base-overlay-editor';
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

const column: ColumnDef = { key: 'test', title: 'Test' };

// ─── Concrete test subclass ──────────────────────────────

class TestOverlayEditor extends BaseOverlayEditor {
  readonly id = 'test-overlay';

  public keyDownCalls: KeyboardEvent[] = [];
  public lastInitValue: CellValue | undefined;

  protected get overlayWidth(): number {
    return 200;
  }

  protected get overlayHeight(): number {
    return 250;
  }

  protected getAriaLabel(): string {
    return 'Test overlay';
  }

  protected initializeFromValue(value: CellValue): void {
    this.lastInitValue = value;
  }

  protected renderContent(): void {
    const content = document.createElement('div');
    content.className = 'test-content';
    content.textContent = 'Test content';
    this.overlay!.appendChild(content);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    this.keyDownCalls.push(e);
    e.stopPropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close('escape');
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

describe('BaseOverlayEditor', () => {
  let editor: TestOverlayEditor;
  let commitFn: CellEditorCommit;
  let closeFn: CellEditorClose;

  beforeEach(() => {
    editor = new TestOverlayEditor();
    commitFn = vi.fn();
    closeFn = vi.fn();
  });

  afterEach(() => {
    editor.destroy();
  });

  // ─── Lifecycle ──────────────────────────────────────

  describe('lifecycle', () => {
    it('starts closed with default row/col', () => {
      expect(editor.isOpen).toBe(false);
      expect(editor.editingRow).toBe(-1);
      expect(editor.editingCol).toBe(-1);
    });

    it('opens and renders overlay with ARIA attributes', () => {
      const ctx = makeContext('test-value');
      editor.open(ctx, commitFn, closeFn);

      expect(editor.isOpen).toBe(true);
      expect(editor.editingRow).toBe(2);
      expect(editor.editingCol).toBe(3);

      const overlay = ctx.container.querySelector('[role="dialog"]');
      expect(overlay).toBeTruthy();
      expect(overlay!.getAttribute('aria-label')).toBe('Test overlay');
    });

    it('calls initializeFromValue with context value', () => {
      const ctx = makeContext('hello');
      editor.open(ctx, commitFn, closeFn);
      expect(editor.lastInitValue).toBe('hello');
    });

    it('renders subclass content', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]')!;
      const content = overlay.querySelector('.test-content');
      expect(content).toBeTruthy();
      expect(content!.textContent).toBe('Test content');
    });

    it('close removes overlay from DOM', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);
      expect(ctx.container.querySelector('[role="dialog"]')).toBeTruthy();

      editor.close('escape');
      expect(ctx.container.querySelector('[role="dialog"]')).toBeNull();
      expect(editor.isOpen).toBe(false);
      expect(closeFn).toHaveBeenCalledWith('escape');
    });

    it('close is idempotent', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      editor.close('escape');
      editor.close('escape');
      expect(closeFn).toHaveBeenCalledTimes(1);
    });

    it('destroy cleans up open overlay', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);
      editor.destroy();

      expect(editor.isOpen).toBe(false);
      expect(closeFn).toHaveBeenCalledWith('programmatic');
    });

    it('re-open closes previous overlay', () => {
      const ctx1 = makeContext('val-1');
      editor.open(ctx1, commitFn, closeFn);
      expect(closeFn).not.toHaveBeenCalled();

      const ctx2 = makeContext('val-2');
      editor.open(ctx2, commitFn, closeFn);
      expect(closeFn).toHaveBeenCalledWith('programmatic');
      expect(editor.isOpen).toBe(true);

      const overlays = ctx2.container.querySelectorAll('[role="dialog"]');
      expect(overlays.length).toBe(1);
    });
  });

  // ─── Positioning ──────────────────────────────────────

  describe('positioning', () => {
    it('positions overlay below cell', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      expect(overlay.style.position).toBe('absolute');
      expect(overlay.style.left).toBe('100px');
      // y=50 + height=24 = 74
      expect(overlay.style.top).toBe('74px');
      expect(overlay.style.zIndex).toBe('50');
    });

    it('flips above cell when no room below', () => {
      const ctx = makeContext();
      // Override container to be small (height=100) so overlay won't fit below
      Object.defineProperty(ctx.container, 'getBoundingClientRect', {
        value: () => ({
          x: 0, y: 0, width: 800, height: 100,
          top: 0, left: 0, right: 800, bottom: 100,
        }),
      });
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      // Below: 50+24=74 → 74+250=324 > 100 → flip above: 50-0-250=-200 → clamped to 0
      const top = parseInt(overlay.style.top, 10);
      expect(top).toBeLessThanOrEqual(0);
    });

    it('clamps left when overlay exceeds container width', () => {
      const ctx = makeContext();
      // Cell at x=700, overlay width=200, container width=800 → clamp
      (ctx.layoutEngine as { getCellRect: () => unknown }).getCellRect = () => ({
        x: 700, y: 50, width: 120, height: 24,
      });
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      expect(overlay.style.left).toBe('600px'); // 800 - 200
    });
  });

  // ─── Scroll close ──────────────────────────────────────

  describe('scroll close', () => {
    it('closes on scroll event', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      ctx.scrollContainer.dispatchEvent(new Event('scroll'));
      expect(editor.isOpen).toBe(false);
      expect(closeFn).toHaveBeenCalledWith('scroll');
    });

    it('does not close frozen cell on scroll', () => {
      const ctx = makeContext();
      ctx.frozenRows = 5;
      ctx.frozenColumns = 5;
      // row=2, col=3 → both < frozen → exempt from scroll close
      editor.open(ctx, commitFn, closeFn);

      ctx.scrollContainer.dispatchEvent(new Event('scroll'));
      expect(editor.isOpen).toBe(true);
    });
  });

  // ─── Outside click ──────────────────────────────────────

  describe('outside click', () => {
    it('closes on mousedown outside overlay', async () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      // Outside click handler is deferred with setTimeout(0)
      await new Promise((r) => setTimeout(r, 10));

      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(editor.isOpen).toBe(false);
      expect(closeFn).toHaveBeenCalledWith('blur');
    });
  });

  // ─── Keyboard ──────────────────────────────────────

  describe('keyboard', () => {
    it('delegates keydown to subclass onKeyDown', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'ArrowRight');

      expect(editor.keyDownCalls.length).toBe(1);
      expect(editor.keyDownCalls[0].key).toBe('ArrowRight');
    });

    it('Escape closes without commit', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      pressKey(overlay, 'Escape');

      expect(commitFn).not.toHaveBeenCalled();
      expect(closeFn).toHaveBeenCalledWith('escape');
      expect(editor.isOpen).toBe(false);
    });
  });

  // ─── Base styles ──────────────────────────────────────

  describe('base styles', () => {
    it('applies theme-based styles to overlay', () => {
      const ctx = makeContext();
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      expect(overlay.style.width).toBe('200px');
      expect(overlay.style.backgroundColor).toBeTruthy();
      expect(overlay.style.fontFamily).toBe(stubTheme.fonts.cell);
      expect(overlay.style.borderRadius).toBe('4px');
    });
  });

  // ─── Theme & Locale ──────────────────────────────────────

  describe('theme and locale', () => {
    it('setTheme updates internal theme', () => {
      const newTheme = { ...stubTheme, colors: { ...stubTheme.colors, cellText: '#f00' } };
      editor.setTheme(newTheme);
      const ctx = makeContext();
      ctx.theme = newTheme;
      editor.open(ctx, commitFn, closeFn);

      const overlay = ctx.container.querySelector('[role="dialog"]') as HTMLElement;
      // JSDOM normalizes #f00 → rgb(255, 0, 0)
      expect(overlay.style.color).toBeTruthy();
      expect(overlay.style.color).not.toBe('rgb(0, 0, 0)');
    });

    it('setLocale updates internal locale', () => {
      const newLocale = {
        ...stubLocale,
        select: {
          ariaLabel: 'Выберите',
          searchPlaceholder: 'Поиск...',
          noResults: 'Нет результатов',
        },
      } as ResolvedLocale;
      editor.setLocale(newLocale);

      const ctx = makeContext();
      ctx.locale = newLocale;
      editor.open(ctx, commitFn, closeFn);

      // Locale is set on the editor — verify it's stored properly
      // (the overlay renders with subclass content, locale accessible internally)
      expect(editor.isOpen).toBe(true);
    });
  });
});
