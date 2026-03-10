// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DateTimeEditor — CellEditor for 'datetime' columns.
 *
 * Renders a combined date+time picker: calendar grid on top, hour/minute
 * spin controls below. Commits an ISO datetime string (YYYY-MM-DDTHH:mm).
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { CellValue } from '../types/interfaces';
import type { EditorCloseReason } from './inline-editor';
import type {
  CellEditor,
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
} from './cell-editor';
import type { ResolvedLocale } from '../locale/resolve-locale';

const DAYS_IN_WEEK = 7;
const WEEK_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Parse a cell value into a Date (local time) or null. */
function parseDateTime(value: CellValue): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    // ISO datetime: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (isoMatch) {
      return new Date(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3]),
        Number(isoMatch[4]),
        Number(isoMatch[5]),
        isoMatch[6] ? Number(isoMatch[6]) : 0,
      );
    }
    // Date-only: YYYY-MM-DD (default time to 00:00)
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Clamp value between min and max. */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Focus section identifier for keyboard Tab cycling.
 * calendar → hour → minute → calendar → ...
 */
type FocusSection = 'calendar' | 'hour' | 'minute';

export class DateTimeEditor implements CellEditor {
  readonly id = 'date-time-picker';

  private overlay: HTMLDivElement | null = null;
  private _isOpen = false;
  private _editingRow = -1;
  private _editingCol = -1;
  private closeFn: CellEditorClose | null = null;
  private commitFn: CellEditorCommit | null = null;
  private originalValue: CellValue = null;

  // Calendar state
  private viewYear = 0;
  private viewMonth = 0;
  private selectedDate: Date | null = null;
  private focusedDay = 1;

  // Time state
  private hour = 0;
  private minute = 0;

  // Focus tracking
  private focusSection: FocusSection = 'calendar';
  private hourInput: HTMLInputElement | null = null;
  private minuteInput: HTMLInputElement | null = null;

  // Event handler refs
  private scrollHandler: (() => void) | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private scrollContainer: HTMLElement | null = null;

  // Layout refs (for positioning)
  private layoutEngine: LayoutEngine | null = null;
  private scrollManager: ScrollManager | null = null;
  private container: HTMLElement | null = null;
  private frozenRows = 0;
  private frozenColumns = 0;

  private theme: SpreadsheetTheme | null = null;
  private locale: ResolvedLocale | null = null;

  get isOpen(): boolean {
    return this._isOpen;
  }

  get editingRow(): number {
    return this._editingRow;
  }

  get editingCol(): number {
    return this._editingCol;
  }

  open(context: CellEditorContext, commitFn: CellEditorCommit, closeFn: CellEditorClose): void {
    if (this._isOpen) {
      this.close('programmatic');
    }

    this.closeFn = closeFn;
    this.commitFn = commitFn;
    this._editingRow = context.row;
    this._editingCol = context.col;
    this.originalValue = context.value;
    this.theme = context.theme;
    this.locale = context.locale;
    this.layoutEngine = context.layoutEngine;
    this.scrollManager = context.scrollManager;
    this.container = context.container;
    this.frozenRows = context.frozenRows;
    this.frozenColumns = context.frozenColumns;

    const parsed = parseDateTime(context.value);
    const now = new Date();
    this.selectedDate = parsed;
    this.viewYear = parsed ? parsed.getFullYear() : now.getFullYear();
    this.viewMonth = parsed ? parsed.getMonth() : now.getMonth();
    this.focusedDay = parsed ? parsed.getDate() : now.getDate();
    this.hour = parsed ? parsed.getHours() : now.getHours();
    this.minute = parsed ? parsed.getMinutes() : now.getMinutes();
    this.focusSection = 'calendar';

    this.overlay = document.createElement('div');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute(
      'aria-label',
      this.locale?.dateTimePicker?.ariaLabel ?? 'Date and time picker',
    );
    this.renderOverlay();
    this.positionOverlay();

    context.container.appendChild(this.overlay);
    this._isOpen = true;

    this.overlay.focus();

    // Scroll closes the picker (unless frozen cell)
    this.scrollHandler = () => {
      if (this._isOpen) {
        if (this._editingRow < this.frozenRows && this._editingCol < this.frozenColumns) return;
        this.close('scroll');
      }
    };
    this.scrollContainer = context.scrollContainer;
    this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.overlay && !this.overlay.contains(e.target as Node)) {
        this.close('blur');
      }
    };
    setTimeout(() => {
      if (this._isOpen) {
        document.addEventListener('mousedown', this.outsideClickHandler!);
      }
    }, 0);
  }

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

    this.hourInput = null;
    this.minuteInput = null;

    if (this.scrollHandler && this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      this.scrollContainer = null;
    }

    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }

    this.closeFn?.(reason);
  }

  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
  }

  setLocale(locale: ResolvedLocale): void {
    this.locale = locale;
  }

  destroy(): void {
    if (this._isOpen) {
      this.close('programmatic');
    }
    this.overlay = null;
    this.closeFn = null;
    this.commitFn = null;
  }

  // ─── Commit ──────────────────────────────────────

  private commitValue(): void {
    const mm = pad2(this.viewMonth + 1);
    const dd = pad2(this.focusedDay);
    const hh = pad2(this.hour);
    const mi = pad2(this.minute);
    const isoStr = `${this.viewYear}-${mm}-${dd}T${hh}:${mi}`;
    this.commitFn?.(this._editingRow, this._editingCol, this.originalValue, isoStr);
    this.close('enter');
  }

  // ─── Positioning ──────────────────────────────────────

  private positionOverlay(): void {
    if (!this.overlay || !this.layoutEngine || !this.scrollManager) return;

    const le = this.layoutEngine;
    const sm = this.scrollManager;

    const cellRect = le.getCellRect(this._editingRow, this._editingCol);
    const scrollXOffset = this._editingCol < this.frozenColumns ? 0 : sm.scrollX;
    const scrollYOffset = this._editingRow < this.frozenRows ? 0 : sm.scrollY;

    const x = cellRect.x - scrollXOffset;
    const y = cellRect.y - scrollYOffset + cellRect.height;

    const containerEl = this.container;
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const overlayWidth = 240;
    const overlayHeight = 320;

    let left = x;
    let top = y;

    if (left + overlayWidth > containerRect.width) {
      left = containerRect.width - overlayWidth;
    }
    if (left < 0) left = 0;

    if (top + overlayHeight > containerRect.height) {
      top = cellRect.y - scrollYOffset - overlayHeight;
    }
    if (top < 0) top = 0;

    const s = this.overlay.style;
    s.position = 'absolute';
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.zIndex = '50';
  }

  // ─── Rendering ──────────────────────────────────────

  private renderOverlay(): void {
    if (!this.overlay || !this.theme) return;

    const o = this.overlay;
    o.style.width = '240px';
    o.style.backgroundColor = this.theme.colors.cellEditBackground;
    o.style.border = `1px solid ${this.theme.colors.gridLine}`;
    o.style.borderRadius = '4px';
    o.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    o.style.fontFamily = this.theme.fonts.cell;
    o.style.fontSize = `${this.theme.fonts.cellSize}px`;
    o.style.color = this.theme.colors.cellText;
    o.style.userSelect = 'none';
    o.style.outline = 'none';
    o.tabIndex = 0;

    this.rebuildCalendar();

    o.addEventListener('keydown', this.handleKeyDown);
  }

  private rebuildCalendar(): void {
    if (!this.overlay || !this.theme) return;
    this.overlay.innerHTML = '';

    const theme = this.theme;

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

    for (let i = 0; i < firstDay; i++) {
      daysGrid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= totalDays; day++) {
      const cell = document.createElement('div');
      cell.textContent = String(day);
      cell.style.textAlign = 'center';
      cell.style.padding = '4px 0';
      cell.style.borderRadius = '3px';
      cell.style.cursor = 'pointer';
      cell.dataset.day = String(day);

      const cellDate = new Date(this.viewYear, this.viewMonth, day);

      if (isSameDay(cellDate, today)) {
        cell.style.border = `1px solid ${theme.colors.activeCellBorder}`;
      }

      if (this.selectedDate && isSameDay(cellDate, this.selectedDate)) {
        cell.style.backgroundColor = theme.colors.activeCellBorder;
        cell.style.color = '#fff';
      }

      if (day === this.focusedDay) {
        if (!(this.selectedDate && isSameDay(cellDate, this.selectedDate))) {
          cell.style.backgroundColor = theme.colors.selectionFill;
        }
      }

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
        this.focusedDay = day;
        this.selectedDate = new Date(this.viewYear, this.viewMonth, day, this.hour, this.minute);
        this.rebuildCalendar();
        this.overlay?.focus();
      });

      daysGrid.appendChild(cell);
    }

    this.overlay.appendChild(daysGrid);

    // ── Time controls
    const timeRow = document.createElement('div');
    timeRow.style.display = 'flex';
    timeRow.style.alignItems = 'center';
    timeRow.style.justifyContent = 'center';
    timeRow.style.gap = '6px';
    timeRow.style.padding = '6px 8px';
    timeRow.style.borderTop = `1px solid ${theme.colors.gridLine}`;

    const hourLabel = this.locale?.dateTimePicker?.hour ?? 'Hour';
    const minuteLabel = this.locale?.dateTimePicker?.minute ?? 'Minute';

    // Hour spin
    const hourGroup = this.createSpinGroup(hourLabel, this.hour, 0, 23, (val) => {
      this.hour = val;
    });
    this.hourInput = hourGroup.input;

    // Separator
    const sep = document.createElement('span');
    sep.textContent = ':';
    sep.style.fontWeight = 'bold';
    sep.style.fontSize = '14px';

    // Minute spin
    const minuteGroup = this.createSpinGroup(minuteLabel, this.minute, 0, 59, (val) => {
      this.minute = val;
    });
    this.minuteInput = minuteGroup.input;

    timeRow.appendChild(hourGroup.el);
    timeRow.appendChild(sep);
    timeRow.appendChild(minuteGroup.el);
    this.overlay.appendChild(timeRow);

    // ── Footer: Now + Commit
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.padding = '4px 8px 8px';
    footer.style.borderTop = `1px solid ${theme.colors.gridLine}`;

    const nowBtn = this.createFooterButton(this.locale?.dateTimePicker?.now ?? 'Now', () => {
      const n = new Date();
      this.viewYear = n.getFullYear();
      this.viewMonth = n.getMonth();
      this.focusedDay = n.getDate();
      this.hour = n.getHours();
      this.minute = n.getMinutes();
      this.selectedDate = n;
      this.rebuildCalendar();
      this.overlay?.focus();
    });

    const okBtn = this.createFooterButton('OK', () => {
      this.commitValue();
    });
    okBtn.style.fontWeight = 'bold';

    footer.appendChild(nowBtn);
    footer.appendChild(okBtn);
    this.overlay.appendChild(footer);

    // Apply focus highlight
    this.applyFocusSectionStyle();
  }

  private createSpinGroup(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (val: number) => void,
  ): { el: HTMLDivElement; input: HTMLInputElement } {
    const theme = this.theme!;
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.flexDirection = 'column';
    group.style.alignItems = 'center';
    group.style.gap = '2px';

    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.fontSize = '9px';
    lbl.style.color = theme.colors.headerText ?? theme.colors.cellText;
    group.appendChild(lbl);

    const upBtn = this.createSpinButton('▲', () => {
      const next = value >= max ? min : value + 1;
      onChange(next);
      this.rebuildCalendar();
      this.overlay?.focus();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = pad2(value);
    input.style.width = '32px';
    input.style.textAlign = 'center';
    input.style.border = `1px solid ${theme.colors.gridLine}`;
    input.style.borderRadius = '3px';
    input.style.padding = '2px 0';
    input.style.fontSize = `${theme.fonts.cellSize}px`;
    input.style.fontFamily = theme.fonts.cell;
    input.style.color = theme.colors.cellText;
    input.style.backgroundColor = theme.colors.cellEditBackground;
    input.style.outline = 'none';

    input.addEventListener('focus', (e) => {
      (e.target as HTMLInputElement).select();
    });
    input.addEventListener('change', () => {
      const parsed = parseInt(input.value, 10);
      if (!isNaN(parsed)) {
        const clamped = clamp(parsed, min, max);
        onChange(clamped);
        input.value = pad2(clamped);
      } else {
        input.value = pad2(value);
      }
    });
    // Allow arrow keys on the input to increment/decrement
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const next = value >= max ? min : value + 1;
        onChange(next);
        this.rebuildCalendar();
        // Re-focus the corresponding input after rebuild
        if (this.focusSection === 'hour') this.hourInput?.focus();
        else if (this.focusSection === 'minute') this.minuteInput?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const next = value <= min ? max : value - 1;
        onChange(next);
        this.rebuildCalendar();
        if (this.focusSection === 'hour') this.hourInput?.focus();
        else if (this.focusSection === 'minute') this.minuteInput?.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        // Trigger change first
        input.dispatchEvent(new Event('change'));
        this.commitValue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close('escape');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.cycleFocus(e.shiftKey ? -1 : 1);
      }
    });

    const downBtn = this.createSpinButton('▼', () => {
      const next = value <= min ? max : value - 1;
      onChange(next);
      this.rebuildCalendar();
      this.overlay?.focus();
    });

    group.appendChild(upBtn);
    group.appendChild(input);
    group.appendChild(downBtn);

    return { el: group, input };
  }

  private createSpinButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '8px';
    btn.style.padding = '0 4px';
    btn.style.color = this.theme?.colors.cellText ?? '#333';
    btn.style.lineHeight = '1';
    btn.tabIndex = -1;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private createNavButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '12px';
    btn.style.padding = '4px 8px';
    btn.style.color = this.theme?.colors.cellText ?? '#333';
    btn.tabIndex = -1;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private createFooterButton(text: string, onClick: () => void): HTMLButtonElement {
    const theme = this.theme!;
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.background = 'none';
    btn.style.border = `1px solid ${theme.colors.gridLine}`;
    btn.style.borderRadius = '3px';
    btn.style.padding = '2px 12px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = `${theme.fonts.cellSize}px`;
    btn.style.fontFamily = theme.fonts.cell;
    btn.style.color = theme.colors.cellText;
    btn.tabIndex = -1;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private applyFocusSectionStyle(): void {
    if (!this.theme) return;
    const activeShadow = `0 0 0 1px ${this.theme.colors.activeCellBorder}`;
    if (this.hourInput) {
      this.hourInput.style.boxShadow = this.focusSection === 'hour' ? activeShadow : '';
    }
    if (this.minuteInput) {
      this.minuteInput.style.boxShadow = this.focusSection === 'minute' ? activeShadow : '';
    }
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

  // ─── Focus cycling ──────────────────────────────────────

  private cycleFocus(direction: number): void {
    const sections: FocusSection[] = ['calendar', 'hour', 'minute'];
    const idx = sections.indexOf(this.focusSection);
    const next = (idx + direction + sections.length) % sections.length;
    this.focusSection = sections[next];
    this.applyFocusSectionStyle();

    if (this.focusSection === 'hour' && this.hourInput) {
      this.hourInput.focus();
    } else if (this.focusSection === 'minute' && this.minuteInput) {
      this.minuteInput.focus();
    } else {
      this.overlay?.focus();
    }
  }

  // ─── Keyboard ──────────────────────────────────────

  private handleKeyDown = (e: KeyboardEvent): void => {
    // If an input has focus, let it handle its own keys (handled in createSpinGroup)
    if (e.target instanceof HTMLInputElement) return;

    e.stopPropagation();

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.close('escape');
        break;
      case 'Enter':
        e.preventDefault();
        this.commitValue();
        break;
      case 'Tab':
        e.preventDefault();
        this.cycleFocus(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowLeft':
        if (this.focusSection === 'calendar') {
          e.preventDefault();
          this.moveFocus(-1);
        }
        break;
      case 'ArrowRight':
        if (this.focusSection === 'calendar') {
          e.preventDefault();
          this.moveFocus(1);
        }
        break;
      case 'ArrowUp':
        if (this.focusSection === 'calendar') {
          e.preventDefault();
          this.moveFocus(-7);
        }
        break;
      case 'ArrowDown':
        if (this.focusSection === 'calendar') {
          e.preventDefault();
          this.moveFocus(7);
        }
        break;
    }
  };

  private moveFocus(delta: number): void {
    const newDay = this.focusedDay + delta;
    const maxDays = daysInMonth(this.viewYear, this.viewMonth);

    if (newDay < 1) {
      this.navigateMonth(-1);
      const prevMaxDays = daysInMonth(this.viewYear, this.viewMonth);
      this.focusedDay = prevMaxDays + newDay;
      this.rebuildCalendar();
      this.overlay?.focus();
      return;
    }
    if (newDay > maxDays) {
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
