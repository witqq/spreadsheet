// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DatePickerEditor — CellEditor adapter wrapping DatePickerOverlay.
 *
 * Registered in CellEditorRegistry for columns with `type: 'date'`.
 * Delegates rendering to DatePickerOverlay with the new CellEditor lifecycle.
 */

import type { SpreadsheetTheme } from '../themes/theme-types';
import type { ResolvedLocale } from '../locale/resolve-locale';
import type { EditorCloseReason } from './inline-editor';
import type {
  CellEditor,
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
} from './cell-editor';
import { DatePickerOverlay } from './date-picker-overlay';

export class DatePickerEditor implements CellEditor {
  readonly id = 'date-picker';

  private overlay: DatePickerOverlay | null = null;
  private _isOpen = false;
  private _editingRow = -1;
  private _editingCol = -1;
  private closeFn: CellEditorClose | null = null;

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
    this._editingRow = context.row;
    this._editingCol = context.col;

    // Create a fresh DatePickerOverlay for each open
    this.overlay = new DatePickerOverlay({
      container: context.container,
      scrollContainer: context.scrollContainer,
      layoutEngine: context.layoutEngine,
      scrollManager: context.scrollManager,
      theme: context.theme,
      frozenRows: context.frozenRows,
      frozenColumns: context.frozenColumns,
      onCommit: commitFn,
      onClose: (reason: EditorCloseReason) => {
        this._isOpen = false;
        this.overlay = null;
        this.closeFn?.(reason);
      },
    });

    if (context.locale) {
      this.overlay.setLocale(context.locale);
    }

    this.overlay.open(context.row, context.col, context.value);
    this._isOpen = true;
  }

  close(reason: EditorCloseReason): void {
    if (!this._isOpen || !this.overlay) return;
    this.overlay.close(reason);
    // The onClose callback sets _isOpen = false and clears overlay
  }

  setTheme(theme: SpreadsheetTheme): void {
    this.overlay?.setTheme(theme);
  }

  setLocale(locale: ResolvedLocale): void {
    this.overlay?.setLocale(locale);
  }

  destroy(): void {
    if (this._isOpen) {
      this.close('programmatic');
    }
    this.overlay = null;
    this.closeFn = null;
  }
}
