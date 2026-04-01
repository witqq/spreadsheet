// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DatePickerOverlay — a pure-DOM calendar widget for date-type cells.
 *
 * Opens below the target cell, renders a month grid with navigation,
 * and commits the selected date via the provided callback. Keyboard
 * navigation (arrows, Enter, Escape) is supported. Grid scroll or
 * outside click closes the picker.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { CellValue } from '../types/interfaces';
import type { EditorCloseReason } from './inline-editor';
import type { ResolvedLocale } from '../locale/resolve-locale';
import { formatDate, toDate } from '../utils/date-format';
import {
  DAYS_IN_WEEK,
  WEEK_LABELS,
  MONTH_NAMES,
  daysInMonth,
  firstDayOfMonth,
  isSameDay,
} from './calendar-utils';

export interface DatePickerConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
  onCommit: (row: number, col: number, oldValue: CellValue, newValue: CellValue) => void;
  onClose: (reason: EditorCloseReason) => void;
  frozenRows?: number;
  frozenColumns?: number;
  dateFormat?: string;
}

/** Parse a cell value into a Date (local time) or null. */
function parseDate(value: CellValue, dateFormat?: string): Date | null {
  return toDate(value, dateFormat);
}

export class DatePickerOverlay {
  private config: DatePickerConfig;
  private overlay: HTMLDivElement | null = null;
  private currentRow = -1;
  private currentCol = -1;
  private originalValue: CellValue = null;
  private _isOpen = false;

  // Calendar state
  private viewYear = 0;
  private viewMonth = 0; // 0-based
  private selectedDate: Date | null = null;
  private focusedDay = 1;

  // Event handler refs for cleanup
  private scrollHandler: (() => void) | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private locale: ResolvedLocale | null = null;

  constructor(config: DatePickerConfig) {
    this.config = config;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get editingRow(): number {
    return this.currentRow;
  }

  get editingCol(): number {
    return this.currentCol;
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.config = { ...this.config, theme };
  }

  /** Update locale for runtime locale switching. */
  setLocale(locale: ResolvedLocale): void {
    this.locale = locale;
  }

  /**
   * Open the date picker for a cell. If already open, closes first.
   * @param row Logical row index
   * @param col Logical column index
   * @param currentValue Current cell value (Date, string, or null)
   */
  open(row: number, col: number, currentValue: CellValue): void {
    if (this._isOpen) {
      this.close('programmatic');
    }

    this.currentRow = row;
    this.currentCol = col;
    this.originalValue = currentValue;

    const parsed = parseDate(currentValue, this.config.dateFormat);
    const today = new Date();
    this.selectedDate = parsed;
    this.viewYear = parsed ? parsed.getFullYear() : today.getFullYear();
    this.viewMonth = parsed ? parsed.getMonth() : today.getMonth();
    this.focusedDay = parsed ? parsed.getDate() : today.getDate();

    this.overlay = document.createElement('div');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', this.locale?.datePicker?.ariaLabel ?? 'Date picker');
    this.renderOverlay();
    this.positionOverlay();

    this.config.container.appendChild(this.overlay);
    this._isOpen = true;

    // Focus the grid for keyboard handling
    this.overlay.focus();

    // Scroll closes the picker
    this.scrollHandler = () => {
      if (this._isOpen) {
        const frozenRows = this.config.frozenRows ?? 0;
        const frozenCols = this.config.frozenColumns ?? 0;
        if (this.currentRow < frozenRows && this.currentCol < frozenCols) return;
        this.close('scroll');
      }
    };
    this.config.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Outside click closes
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.overlay && !this.overlay.contains(e.target as Node)) {
        this.close('blur');
      }
    };
    // Delay to avoid immediate close from the triggering click
    setTimeout(() => {
      if (this._isOpen) {
        document.addEventListener('mousedown', this.outsideClickHandler!);
      }
    }, 0);
  }

  /** Close the picker and report reason. */
  close(reason: EditorCloseReason): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    if (this.overlay) {
      this.overlay.removeEventListener('keydown', this.handleKeyDown);
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
    }

    if (this.scrollHandler) {
      this.config.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }

    this.config.onClose(reason);
  }

  /** Select a date, commit value, and close. */
  private selectDate(day: number): void {
    const date = new Date(this.viewYear, this.viewMonth, day);
    const commitStr = this.config.dateFormat
      ? formatDate(date, this.config.dateFormat)
      : `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.config.onCommit(this.currentRow, this.currentCol, this.originalValue, commitStr);
    this.close('enter');
  }

  /** Clean up on engine destroy. */
  destroy(): void {
    if (this._isOpen) {
      this.close('programmatic');
    }
  }

  // ─── Positioning ──────────────────────────────────────

  private positionOverlay(): void {
    if (!this.overlay) return;

    const le = this.config.layoutEngine;
    const sm = this.config.scrollManager;
    const frozenRows = this.config.frozenRows ?? 0;
    const frozenCols = this.config.frozenColumns ?? 0;

    const cellRect = le.getCellRect(this.currentRow, this.currentCol);
    const scrollXOffset = this.currentCol < frozenCols ? 0 : sm.scrollX;
    const scrollYOffset = this.currentRow < frozenRows ? 0 : sm.scrollY;

    const x = cellRect.x - scrollXOffset;
    const y = cellRect.y - scrollYOffset + cellRect.height; // Below cell

    const containerRect = this.config.container.getBoundingClientRect();
    const overlayWidth = 224; // Fixed width
    const overlayHeight = 260; // Approximate height

    // Clamp to container bounds
    let left = x;
    let top = y;

    if (left + overlayWidth > containerRect.width) {
      left = containerRect.width - overlayWidth;
    }
    if (left < 0) left = 0;

    // If no room below, position above the cell
    if (top + overlayHeight > containerRect.height) {
      top = cellRect.y - scrollYOffset - overlayHeight;
    }
    if (top < 0) top = 0;

    const s = this.overlay.style;
    s.position = 'absolute';
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.zIndex = '50'; // Above editor (20) but below context menu (100)
  }

  // ─── Rendering ──────────────────────────────────────

  private renderOverlay(): void {
    if (!this.overlay) return;

    const theme = this.config.theme;
    const o = this.overlay;

    // Base styles
    o.style.width = '224px';
    o.style.backgroundColor = theme.colors.cellEditBackground;
    o.style.border = `1px solid ${theme.colors.gridLine}`;
    o.style.borderRadius = '4px';
    o.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    o.style.fontFamily = theme.fonts.cell;
    o.style.fontSize = `${theme.fonts.cellSize}px`;
    o.style.color = theme.colors.cellText;
    o.style.userSelect = 'none';
    o.style.outline = 'none';
    o.tabIndex = 0;

    this.rebuildCalendar();

    // Keyboard handler
    o.addEventListener('keydown', this.handleKeyDown);
  }

  private rebuildCalendar(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = '';

    const theme = this.config.theme;

    // ── Header: < Month Year >
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '8px';
    header.style.borderBottom = `1px solid ${theme.colors.gridLine}`;

    const prevBtn = this.createNavButton('◀', () => this.navigateMonth(-1));
    const nextBtn = this.createNavButton('▶', () => this.navigateMonth(1));

    const title = document.createElement('span');
    title.style.fontWeight = 'bold';
    const monthNames = this.locale?.datePicker?.monthNames ?? MONTH_NAMES;
    title.textContent = `${monthNames[this.viewMonth]} ${this.viewYear}`;

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    this.overlay.appendChild(header);

    // ── Day-of-week labels
    const weekRow = document.createElement('div');
    weekRow.style.display = 'grid';
    weekRow.style.gridTemplateColumns = `repeat(${DAYS_IN_WEEK}, 1fr)`;
    weekRow.style.padding = '4px 4px 0';

    const weekLabels = this.locale?.datePicker?.weekLabels ?? WEEK_LABELS;
    for (const label of weekLabels) {
      const cell = document.createElement('div');
      cell.style.textAlign = 'center';
      cell.style.fontSize = '10px';
      cell.style.color = theme.colors.headerText ?? theme.colors.cellText;
      cell.style.padding = '2px 0';
      cell.textContent = label;
      weekRow.appendChild(cell);
    }
    this.overlay.appendChild(weekRow);

    // ── Day grid
    const daysGrid = document.createElement('div');
    daysGrid.style.display = 'grid';
    daysGrid.style.gridTemplateColumns = `repeat(${DAYS_IN_WEEK}, 1fr)`;
    daysGrid.style.padding = '4px';
    daysGrid.style.gap = '2px';

    const firstDay = firstDayOfMonth(this.viewYear, this.viewMonth);
    const totalDays = daysInMonth(this.viewYear, this.viewMonth);
    const today = new Date();

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      daysGrid.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      cell.textContent = String(day);
      cell.style.textAlign = 'center';
      cell.style.padding = '4px 0';
      cell.style.borderRadius = '3px';
      cell.style.cursor = 'pointer';
      cell.dataset.day = String(day);

      const cellDate = new Date(this.viewYear, this.viewMonth, day);

      // Highlight today
      if (isSameDay(cellDate, today)) {
        cell.style.border = `1px solid ${theme.colors.activeCellBorder}`;
      }

      // Highlight selected date
      if (this.selectedDate && isSameDay(cellDate, this.selectedDate)) {
        cell.style.backgroundColor = theme.colors.activeCellBorder;
        cell.style.color = '#fff';
      }

      // Highlight focused day
      if (day === this.focusedDay) {
        if (!(this.selectedDate && isSameDay(cellDate, this.selectedDate))) {
          cell.style.backgroundColor = theme.colors.selectionFill;
        }
      }

      // Hover effect
      cell.addEventListener('mouseenter', () => {
        if (!(this.selectedDate && isSameDay(cellDate, this.selectedDate))) {
          cell.style.backgroundColor = theme.colors.selectionFill;
        }
      });
      cell.addEventListener('mouseleave', () => {
        if (this.selectedDate && isSameDay(cellDate, this.selectedDate)) {
          cell.style.backgroundColor = theme.colors.activeCellBorder;
        } else if (day === this.focusedDay) {
          cell.style.backgroundColor = theme.colors.selectionFill;
        } else {
          cell.style.backgroundColor = '';
        }
      });

      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDate(day);
      });

      daysGrid.appendChild(cell);
    }

    this.overlay.appendChild(daysGrid);

    // ── Today button
    const footer = document.createElement('div');
    footer.style.padding = '4px 8px 8px';
    footer.style.borderTop = `1px solid ${theme.colors.gridLine}`;
    footer.style.textAlign = 'center';

    const todayBtn = document.createElement('button');
    todayBtn.textContent = this.locale?.datePicker?.today ?? 'Today';
    todayBtn.style.background = 'none';
    todayBtn.style.border = `1px solid ${theme.colors.gridLine}`;
    todayBtn.style.borderRadius = '3px';
    todayBtn.style.padding = '2px 12px';
    todayBtn.style.cursor = 'pointer';
    todayBtn.style.fontSize = `${theme.fonts.cellSize}px`;
    todayBtn.style.fontFamily = theme.fonts.cell;
    todayBtn.style.color = theme.colors.cellText;
    todayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = new Date();
      this.viewYear = t.getFullYear();
      this.viewMonth = t.getMonth();
      this.selectDate(t.getDate());
    });
    footer.appendChild(todayBtn);
    this.overlay.appendChild(footer);
  }

  private createNavButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '12px';
    btn.style.padding = '4px 8px';
    btn.style.color = this.config.theme.colors.cellText;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private navigateMonth(delta: number): void {
    this.viewMonth += delta;
    if (this.viewMonth < 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else if (this.viewMonth > 11) {
      this.viewMonth = 0;
      this.viewYear++;
    }
    const maxDays = daysInMonth(this.viewYear, this.viewMonth);
    if (this.focusedDay > maxDays) this.focusedDay = maxDays;
    this.rebuildCalendar();
    this.overlay?.focus();
  }

  // ─── Keyboard ──────────────────────────────────────

  private handleKeyDown = (e: KeyboardEvent): void => {
    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close('escape');
        break;
      case 'Enter':
        e.preventDefault();
        this.selectDate(this.focusedDay);
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
      case 'Tab':
        e.preventDefault();
        this.selectDate(this.focusedDay);
        break;
    }
  };

  private moveFocus(delta: number): void {
    const newDay = this.focusedDay + delta;
    const maxDays = daysInMonth(this.viewYear, this.viewMonth);

    if (newDay < 1) {
      // Move to previous month
      this.navigateMonth(-1);
      const prevMaxDays = daysInMonth(this.viewYear, this.viewMonth);
      this.focusedDay = prevMaxDays + newDay; // newDay is negative
      this.rebuildCalendar();
      this.overlay?.focus();
      return;
    }
    if (newDay > maxDays) {
      // Move to next month
      const overflow = newDay - maxDays;
      this.navigateMonth(1);
      this.focusedDay = overflow;
      this.rebuildCalendar();
      this.overlay?.focus();
      return;
    }

    this.focusedDay = newDay;
    this.rebuildCalendar();
    this.overlay?.focus();
  }
}
