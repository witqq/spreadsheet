// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DatePickerEditor — CellEditor for 'date' columns.
 *
 * Renders a calendar overlay below the target cell. Clicking a day or
 * pressing Enter commits the date and closes. Extends BaseOverlayEditor
 * for shared overlay lifecycle and calendar rendering.
 */

import type { CellValue } from '../types/interfaces';
import { BaseCalendarOverlayEditor } from './base-calendar-overlay-editor';
import { formatDate, toDate } from '../utils/date-format';

export class DatePickerEditor extends BaseCalendarOverlayEditor {
  readonly id = 'date-picker';

  protected get overlayWidth(): number {
    return 224;
  }

  protected get overlayHeight(): number {
    return 260;
  }

  protected parseValue(value: CellValue): Date | null {
    return toDate(value, this.column?.dateFormat);
  }

  protected getAriaLabel(): string {
    return this.locale?.datePicker?.ariaLabel ?? 'Date picker';
  }

  protected initializeState(): void {
    // No additional state for date-only picker
  }

  protected renderContent(): void {
    this.renderCalendarGrid((day) => this.selectDate(day));

    if (!this.overlay || !this.theme) return;

    // Footer with Today button
    const footer = document.createElement('div');
    footer.style.padding = '4px 8px 8px';
    footer.style.borderTop = `1px solid ${this.theme.colors.gridLine}`;
    footer.style.textAlign = 'center';

    const todayBtn = this.createFooterButton(
      this.locale?.datePicker?.today ?? 'Today',
      () => {
        const t = new Date();
        this.viewYear = t.getFullYear();
        this.viewMonth = t.getMonth();
        this.selectDate(t.getDate());
      },
    );
    footer.appendChild(todayBtn);
    this.overlay.appendChild(footer);
  }

  protected onKeyDown(e: KeyboardEvent): void {
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
  }

  private selectDate(day: number): void {
    const date = new Date(this.viewYear, this.viewMonth, day);
    const commitStr = this.column?.dateFormat
      ? formatDate(date, this.column.dateFormat)
      : `${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    this.commitFn?.(this._editingRow, this._editingCol, this.originalValue, commitStr);
    this.close('enter');
  }
}
