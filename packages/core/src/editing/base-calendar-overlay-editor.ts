// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * BaseCalendarOverlayEditor — abstract calendar base for overlay editors.
 *
 * Extends {@link BaseOverlayEditor} with calendar-specific state (viewYear,
 * viewMonth, selectedDate, focusedDay), calendar grid rendering, month
 * navigation, and day focus movement. DatePickerEditor and DateTimeEditor
 * extend this class.
 */

import type { CellValue } from '../types/interfaces';
import { BaseOverlayEditor } from './base-overlay-editor';
import {
  DAYS_IN_WEEK,
  WEEK_LABELS,
  MONTH_NAMES,
  daysInMonth,
  firstDayOfMonth,
  isSameDay,
} from './calendar-utils';

export abstract class BaseCalendarOverlayEditor extends BaseOverlayEditor {
  // Calendar state
  protected viewYear = 0;
  protected viewMonth = 0;
  protected selectedDate: Date | null = null;
  protected focusedDay = 1;

  // ─── Abstract methods (calendar-specific) ────────────────────

  /** Parse the cell value into a Date for calendar initialization. */
  protected abstract parseValue(value: CellValue): Date | null;

  /** Called after base calendar state is initialized. Set up subclass-specific state. */
  protected abstract initializeState(parsed: Date | null, now: Date): void;

  // ─── BaseOverlayEditor implementation ────────────────────────

  protected initializeFromValue(value: CellValue): void {
    const parsed = this.parseValue(value);
    const now = new Date();
    this.selectedDate = parsed;
    this.viewYear = parsed ? parsed.getFullYear() : now.getFullYear();
    this.viewMonth = parsed ? parsed.getMonth() : now.getMonth();
    this.focusedDay = parsed ? parsed.getDate() : now.getDate();
    this.initializeState(parsed, now);
  }

  // ─── Calendar rendering helpers ──────────────────────────────

  /**
   * Render calendar grid into the overlay: header, week labels, day cells.
   * @param onDayClick Callback when a day cell is clicked.
   */
  protected renderCalendarGrid(onDayClick: (day: number) => void): void {
    if (!this.overlay || !this.theme) return;

    const theme = this.theme;

    // Header: ◀ Month Year ▶
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

    // Week labels
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

    // Day grid
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
        onDayClick(day);
      });

      daysGrid.appendChild(cell);
    }

    this.overlay.appendChild(daysGrid);
  }

  /** Create a navigation button (◀/▶). */
  protected createNavButton(text: string, onClick: () => void): HTMLButtonElement {
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

  /** Create a footer action button (Today, Now, OK). */
  protected createFooterButton(text: string, onClick: () => void): HTMLButtonElement {
    if (!this.theme) throw new Error('Theme not set');
    const theme = this.theme;
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

  /** Navigate to the previous or next month. */
  protected navigateMonth(delta: number): void {
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
    this.rebuildOverlay();
    this.overlay?.focus();
  }

  /** Move calendar focus by a number of days. */
  protected moveFocus(delta: number): void {
    const newDay = this.focusedDay + delta;
    const maxDays = daysInMonth(this.viewYear, this.viewMonth);

    if (newDay < 1) {
      this.navigateMonth(-1);
      const prevMaxDays = daysInMonth(this.viewYear, this.viewMonth);
      this.focusedDay = prevMaxDays + newDay;
      this.rebuildOverlay();
      this.overlay?.focus();
      return;
    }
    if (newDay > maxDays) {
      const overflow = newDay - maxDays;
      this.navigateMonth(1);
      this.focusedDay = overflow;
      this.rebuildOverlay();
      this.overlay?.focus();
      return;
    }

    this.focusedDay = newDay;
    this.rebuildOverlay();
    this.overlay?.focus();
  }
}
