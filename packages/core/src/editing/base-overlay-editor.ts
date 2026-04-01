// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * BaseOverlayEditor — abstract base class for overlay cell editors.
 *
 * Provides shared overlay lifecycle: positioning relative to the cell,
 * scroll-close for non-frozen cells, click-outside detection, keyboard
 * delegation, and theme/locale propagation. Subclasses implement value
 * initialization, content rendering, and keyboard behavior.
 *
 * Calendar-specific editors should extend {@link BaseCalendarOverlayEditor}
 * which adds calendar grid rendering and month navigation on top of this base.
 */

import type { SpreadsheetTheme } from '../themes/theme-types';
import type { CellValue, ColumnDef } from '../types/interfaces';
import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { EditorCloseReason } from './inline-editor';
import type {
  CellEditor,
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
} from './cell-editor';
import type { ResolvedLocale } from '../locale/resolve-locale';

export abstract class BaseOverlayEditor implements CellEditor {
  abstract readonly id: string;

  protected overlay: HTMLDivElement | null = null;
  protected _isOpen = false;
  protected _editingRow = -1;
  protected _editingCol = -1;
  protected closeFn: CellEditorClose | null = null;
  protected commitFn: CellEditorCommit | null = null;
  protected originalValue: CellValue = null;

  // Context refs
  protected theme: SpreadsheetTheme | null = null;
  protected locale: ResolvedLocale | null = null;
  protected column: ColumnDef | null = null;
  protected container: HTMLElement | null = null;
  protected scrollContainerEl: HTMLElement | null = null;
  protected layoutEngine: LayoutEngine | null = null;
  protected scrollManager: ScrollManager | null = null;
  protected frozenRows = 0;
  protected frozenColumns = 0;

  // Event handler refs
  private scrollHandler: (() => void) | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  // ─── Abstract methods ──────────────────────────────────────

  /** Width of the overlay in pixels. */
  protected abstract get overlayWidth(): number;

  /** Approximate height of the overlay in pixels (for positioning). */
  protected abstract get overlayHeight(): number;

  /** ARIA label for the overlay dialog. */
  protected abstract getAriaLabel(): string;

  /** Called after context is stored. Set up subclass-specific state from the cell value. */
  protected abstract initializeFromValue(value: CellValue): void;

  /** Render the overlay content. */
  protected abstract renderContent(): void;

  /** Handle keydown events on the overlay. */
  protected abstract onKeyDown(e: KeyboardEvent): void;

  // ─── Virtual methods (overridable) ──────────────────────────────

  /** Subclass cleanup on close (e.g., clear input refs). */
  protected onCloseCleanup(): void {
    // Default: no-op
  }

  // ─── CellEditor interface ──────────────────────────────────────

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
    this.column = context.column;
    this.layoutEngine = context.layoutEngine;
    this.scrollManager = context.scrollManager;
    this.container = context.container;
    this.scrollContainerEl = context.scrollContainer;
    this.frozenRows = context.frozenRows;
    this.frozenColumns = context.frozenColumns;

    this.initializeFromValue(context.value);

    this.overlay = document.createElement('div');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', this.getAriaLabel());
    this.applyBaseStyles();
    this.renderContent();
    this.positionOverlay();

    this.overlay.addEventListener('keydown', this.handleKeyDownBound);
    context.container.appendChild(this.overlay);
    this._isOpen = true;

    this.overlay.focus();

    // Scroll closes the editor (unless frozen cell)
    this.scrollHandler = () => {
      if (this._isOpen) {
        if (this._editingRow < this.frozenRows && this._editingCol < this.frozenColumns) return;
        this.close('scroll');
      }
    };
    if (this.scrollContainerEl) {
      this.scrollContainerEl.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    // Outside click closes
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

    this.onCloseCleanup();

    if (this.overlay) {
      this.overlay.removeEventListener('keydown', this.handleKeyDownBound);
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
    }

    if (this.scrollHandler && this.scrollContainerEl) {
      this.scrollContainerEl.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
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

  // ─── Positioning ──────────────────────────────────────

  protected positionOverlay(): void {
    if (!this.overlay || !this.layoutEngine || !this.scrollManager) return;

    const le = this.layoutEngine;
    const sm = this.scrollManager;

    const cellRect = le.getCellRect(this._editingRow, this._editingCol);
    const scrollXOffset = this._editingCol < this.frozenColumns ? 0 : sm.scrollX;
    const scrollYOffset = this._editingRow < this.frozenRows ? 0 : sm.scrollY;

    const x = cellRect.x - scrollXOffset;
    const y = cellRect.y - scrollYOffset + cellRect.height;

    if (!this.container) return;
    const containerRect = this.container.getBoundingClientRect();

    let left = x;
    let top = y;

    if (left + this.overlayWidth > containerRect.width) {
      left = containerRect.width - this.overlayWidth;
    }
    if (left < 0) left = 0;

    if (top + this.overlayHeight > containerRect.height) {
      top = cellRect.y - scrollYOffset - this.overlayHeight;
    }
    if (top < 0) top = 0;

    const s = this.overlay.style;
    s.position = 'absolute';
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.zIndex = '50';
  }

  // ─── Styling ──────────────────────────────────────

  private applyBaseStyles(): void {
    if (!this.overlay || !this.theme) return;

    const o = this.overlay;
    o.style.width = `${this.overlayWidth}px`;
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
  }

  /** Clear and re-render overlay content. */
  protected rebuildOverlay(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = '';
    this.renderContent();
  }

  // ─── Internal ──────────────────────────────────────

  private handleKeyDownBound = (e: KeyboardEvent): void => {
    this.onKeyDown(e);
  };
}
