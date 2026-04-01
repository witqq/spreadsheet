// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DateTimeEditor — CellEditor for 'datetime' columns.
 *
 * Renders a combined date+time picker: calendar grid on top, hour/minute
 * spin controls below. Commits an ISO datetime string (YYYY-MM-DDTHH:mm).
 * Extends BaseOverlayEditor for shared overlay lifecycle and calendar rendering.
 */

import type { CellValue } from '../types/interfaces';
import { BaseCalendarOverlayEditor } from './base-calendar-overlay-editor';
import { formatDate, toDate } from '../utils/date-format';
import { pad2, clamp } from './calendar-utils';

/** Parse a cell value into a Date (local time) or null, with datetime support. */
function parseDateTime(value: CellValue, dateFormat?: string): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    // Try custom dateFormat with time suffix: "DD.MM.YYYYTHH:mm"
    if (dateFormat) {
      const tIdx = value.indexOf('T');
      if (tIdx > 0) {
        const datePart = value.substring(0, tIdx);
        const timePart = value.substring(tIdx + 1);
        const date = toDate(datePart, dateFormat);
        if (date) {
          const timeMatch = timePart.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
          if (timeMatch) {
            date.setHours(
              Number(timeMatch[1]),
              Number(timeMatch[2]),
              timeMatch[3] ? Number(timeMatch[3]) : 0,
            );
            return date;
          }
        }
      }
      // Try date-only with custom format
      const date = toDate(value, dateFormat);
      if (date) return date;
    }
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

/**
 * Focus section identifier for keyboard Tab cycling.
 * calendar → hour → minute → calendar → ...
 */
type FocusSection = 'calendar' | 'hour' | 'minute';

export class DateTimeEditor extends BaseCalendarOverlayEditor {
  readonly id = 'date-time-picker';

  // Time state
  private hour = 0;
  private minute = 0;

  // Focus tracking
  private focusSection: FocusSection = 'calendar';
  private hourInput: HTMLInputElement | null = null;
  private minuteInput: HTMLInputElement | null = null;

  protected get overlayWidth(): number {
    return 240;
  }

  protected get overlayHeight(): number {
    return 320;
  }

  protected parseValue(value: CellValue): Date | null {
    return parseDateTime(value, this.column?.dateFormat);
  }

  protected getAriaLabel(): string {
    return this.locale?.dateTimePicker?.ariaLabel ?? 'Date and time picker';
  }

  protected initializeState(parsed: Date | null, now: Date): void {
    this.hour = parsed ? parsed.getHours() : now.getHours();
    this.minute = parsed ? parsed.getMinutes() : now.getMinutes();
    this.focusSection = 'calendar';
  }

  protected onCloseCleanup(): void {
    this.hourInput = null;
    this.minuteInput = null;
  }

  protected renderContent(): void {
    // Calendar grid — day click selects (no commit)
    this.renderCalendarGrid((day) => {
      this.focusedDay = day;
      this.selectedDate = new Date(this.viewYear, this.viewMonth, day, this.hour, this.minute);
      this.rebuildOverlay();
      this.overlay?.focus();
    });

    if (!this.overlay || !this.theme) return;
    const theme = this.theme;

    // Time controls
    const timeRow = document.createElement('div');
    timeRow.style.display = 'flex';
    timeRow.style.alignItems = 'center';
    timeRow.style.justifyContent = 'center';
    timeRow.style.gap = '6px';
    timeRow.style.padding = '6px 8px';
    timeRow.style.borderTop = `1px solid ${theme.colors.gridLine}`;

    const hourLabel = this.locale?.dateTimePicker?.hour ?? 'Hour';
    const minuteLabel = this.locale?.dateTimePicker?.minute ?? 'Minute';

    const hourGroup = this.createSpinGroup(hourLabel, this.hour, 0, 23, (val) => {
      this.hour = val;
    });
    this.hourInput = hourGroup.input;

    const sep = document.createElement('span');
    sep.textContent = ':';
    sep.style.fontWeight = 'bold';
    sep.style.fontSize = '14px';

    const minuteGroup = this.createSpinGroup(minuteLabel, this.minute, 0, 59, (val) => {
      this.minute = val;
    });
    this.minuteInput = minuteGroup.input;

    timeRow.appendChild(hourGroup.el);
    timeRow.appendChild(sep);
    timeRow.appendChild(minuteGroup.el);
    this.overlay.appendChild(timeRow);

    // Footer: Now + OK
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
      this.rebuildOverlay();
      this.overlay?.focus();
    });

    const okBtn = this.createFooterButton('OK', () => {
      this.commitValue();
    });
    okBtn.style.fontWeight = 'bold';

    footer.appendChild(nowBtn);
    footer.appendChild(okBtn);
    this.overlay.appendChild(footer);

    this.applyFocusSectionStyle();
  }

  protected onKeyDown(e: KeyboardEvent): void {
    // Let input elements handle their own keys
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
  }

  // ─── DateTime-specific methods ──────────────────────────────

  private commitValue(): void {
    const date = new Date(this.viewYear, this.viewMonth, this.focusedDay);
    const datePart = this.column?.dateFormat
      ? formatDate(date, this.column.dateFormat)
      : `${this.viewYear}-${pad2(this.viewMonth + 1)}-${pad2(this.focusedDay)}`;
    const commitStr = `${datePart}T${pad2(this.hour)}:${pad2(this.minute)}`;
    this.commitFn?.(this._editingRow, this._editingCol, this.originalValue, commitStr);
    this.close('enter');
  }

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
      this.rebuildOverlay();
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
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const next = value >= max ? min : value + 1;
        onChange(next);
        this.rebuildOverlay();
        if (this.focusSection === 'hour') this.hourInput?.focus();
        else if (this.focusSection === 'minute') this.minuteInput?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const next = value <= min ? max : value - 1;
        onChange(next);
        this.rebuildOverlay();
        if (this.focusSection === 'hour') this.hourInput?.focus();
        else if (this.focusSection === 'minute') this.minuteInput?.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
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
      this.rebuildOverlay();
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
}
