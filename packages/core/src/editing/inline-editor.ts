// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * InlineEditor — manages a positioned textarea DOM element for cell editing.
 *
 * Double-click or F2 opens the editor on the active cell. Enter commits
 * the value and closes. Escape cancels. Tab commits and signals navigation.
 * Scrolling commits and closes. Click-outside is handled by the engine
 * coordinator (SpreadsheetEngine) which calls commit() before processing the click.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { CellValue } from '../types/interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { MergeManager } from '../merge/merge-manager';
import type { MergedRegion } from '../types/interfaces';

export type EditorCloseReason =
  | 'enter'
  | 'shift-enter'
  | 'tab'
  | 'shift-tab'
  | 'escape'
  | 'blur'
  | 'scroll'
  | 'programmatic';

export interface InlineEditorConfig {
  /** Parent container for positioning the textarea. */
  container: HTMLElement;
  /** Scroll container to listen for scroll events. */
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  cellStore: CellStore;
  dataView: DataView;
  theme: SpreadsheetTheme;
  /** Called when the editor commits a changed value. */
  onCommit: (row: number, col: number, oldValue: CellValue, newValue: CellValue) => void;
  /** Called when the editor closes, with the reason for closing. */
  onClose: (reason: EditorCloseReason) => void;
  /** Number of frozen rows (0 = none). */
  frozenRows?: number;
  /** Number of frozen columns (0 = none). */
  frozenColumns?: number;
}

export class InlineEditor {
  private config: InlineEditorConfig;
  private textarea: HTMLTextAreaElement | null = null;
  private currentRow = -1;
  private currentCol = -1;
  private originalValue: CellValue = null;
  private _isEditing = false;
  private scrollHandler: (() => void) | null = null;
  private _mergeManager: MergeManager | null = null;
  private currentMergeRegion: MergedRegion | null = null;

  constructor(config: InlineEditorConfig) {
    this.config = config;
  }

  /** Set the merge manager for merge-aware editing. */
  setMergeManager(mm: MergeManager): void {
    this._mergeManager = mm;
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.config = { ...this.config, theme };
    // Re-style textarea if currently editing
    this.styleTextarea();
  }

  get isEditing(): boolean {
    return this._isEditing;
  }

  get editingRow(): number {
    return this.currentRow;
  }

  get editingCol(): number {
    return this.currentCol;
  }

  /**
   * Open the editor on the given cell. If already editing, commits the
   * current cell first.
   */
  open(row: number, col: number, initialText?: string): void {
    if (this._isEditing) {
      this.commitAndClose('programmatic');
    }

    // Merge-aware: redirect to anchor cell
    this.currentMergeRegion = this._mergeManager?.getMergedRegion(row, col) ?? null;
    if (this.currentMergeRegion) {
      row = this.currentMergeRegion.startRow;
      col = this.currentMergeRegion.startCol;
    }

    this.currentRow = row;
    this.currentCol = col;

    // Read current cell value (translate logical → physical for CellStore access)
    const physRow = this.config.dataView.getPhysicalRow(row);
    const cellData = this.config.cellStore.get(physRow, col);
    // For formula cells, show the raw formula string for editing
    this.originalValue = cellData?.formula ?? cellData?.value ?? null;

    // Create textarea
    this.textarea = document.createElement('textarea');
    // If initialText provided (type-to-edit), use it instead of cell value
    if (initialText !== undefined) {
      this.textarea.value = initialText;
    } else {
      this.textarea.value = this.originalValue != null ? String(this.originalValue) : '';
    }

    // Position and style
    this.positionTextarea();
    this.styleTextarea();

    // Append to container
    this.config.container.appendChild(this.textarea);
    this.textarea.focus();
    if (initialText !== undefined) {
      // Type-to-edit: cursor at end of initial text
      const len = this.textarea.value.length;
      this.textarea.setSelectionRange(len, len);
    } else {
      this.textarea.select();
    }

    // Textarea keyboard handler
    this.textarea.addEventListener('keydown', this.handleTextareaKeyDown);

    // Scroll handler: commit and close on scroll (only for non-frozen cells)
    this.scrollHandler = () => {
      if (this._isEditing) {
        const frozenRows = this.config.frozenRows ?? 0;
        const frozenCols = this.config.frozenColumns ?? 0;
        const inFrozenRow = this.currentRow < frozenRows;
        const inFrozenCol = this.currentCol < frozenCols;
        // Corner cells (both frozen) never move — don't close
        // Frozen-row cells only move horizontally — close only on horizontal scroll
        // Frozen-col cells only move vertically — close only on vertical scroll
        // Main cells move both ways — always close
        if (inFrozenRow && inFrozenCol) {
          // Corner: never close on scroll
          return;
        }
        this.commitAndClose('scroll');
      }
    };
    this.config.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

    this._isEditing = true;
  }

  /**
   * Commit the current value and close the editor.
   * If the value hasn't changed, no commit event is fired.
   */
  commitAndClose(reason: EditorCloseReason): void {
    if (!this._isEditing || !this.textarea) return;

    const newValueStr = this.textarea.value;

    // Coerce first so comparison uses the same type as originalValue
    const coerced = this.coerceValue(newValueStr);

    // Only fire commit if value actually changed
    if (coerced !== this.originalValue) {
      // CellStore update is handled by the command system via onCommit
      this.config.onCommit(this.currentRow, this.currentCol, this.originalValue, coerced);
    }

    this.close(reason);
  }

  /**
   * Cancel editing and close without committing.
   */
  cancelAndClose(): void {
    this.close('escape');
  }

  private coerceValue(str: string): CellValue {
    if (str === '') return null;

    // If original was a number, try to parse back to number
    if (typeof this.originalValue === 'number') {
      const num = Number(str);
      if (!isNaN(num)) return num;
    }

    // If original was a boolean, try to parse back
    if (typeof this.originalValue === 'boolean') {
      if (str.toLowerCase() === 'true') return true;
      if (str.toLowerCase() === 'false') return false;
    }

    return str;
  }

  private positionTextarea(): void {
    if (!this.textarea) return;

    const le = this.config.layoutEngine;
    const sm = this.config.scrollManager;
    const frozenRows = this.config.frozenRows ?? 0;
    const frozenCols = this.config.frozenColumns ?? 0;

    let x: number;
    let y: number;
    let width: number;
    let height: number;

    if (this.currentMergeRegion) {
      // For merged cells, compute rect spanning the full region
      const startRect = le.getCellRect(
        this.currentMergeRegion.startRow,
        this.currentMergeRegion.startCol,
      );
      const endRect = le.getCellRect(
        this.currentMergeRegion.endRow,
        this.currentMergeRegion.endCol,
      );
      const scrollXOffset = this.currentCol < frozenCols ? 0 : sm.scrollX;
      const scrollYOffset = this.currentRow < frozenRows ? 0 : sm.scrollY;
      x = startRect.x - scrollXOffset;
      y = startRect.y - scrollYOffset;
      width = endRect.x + endRect.width - startRect.x;
      height = endRect.y + endRect.height - startRect.y;
    } else {
      // getCellRect returns absolute coordinates (including header/rowNumber offsets)
      const cellRect = le.getCellRect(this.currentRow, this.currentCol);
      const scrollXOffset = this.currentCol < frozenCols ? 0 : sm.scrollX;
      const scrollYOffset = this.currentRow < frozenRows ? 0 : sm.scrollY;
      x = cellRect.x - scrollXOffset;
      y = cellRect.y - scrollYOffset;
      width = cellRect.width;
      height = cellRect.height;
    }

    const s = this.textarea.style;
    s.position = 'absolute';
    s.left = `${x}px`;
    s.top = `${y}px`;
    s.width = `${width}px`;
    s.height = `${height}px`;
    s.zIndex = '20'; // Above scroll container (z:10)
  }

  private styleTextarea(): void {
    if (!this.textarea) return;

    const theme = this.config.theme;
    const s = this.textarea.style;

    s.padding = `${theme.dimensions.cellPadding}px`;
    s.margin = '0';
    s.border = `${theme.borders.activeCellWidth}px solid ${theme.colors.activeCellBorder}`;
    s.outline = 'none';
    s.resize = 'none';
    s.overflow = 'hidden';
    s.boxSizing = 'border-box';
    s.font = `${theme.fonts.cellSize}px ${theme.fonts.cell}`;
    s.color = theme.colors.cellText;
    s.backgroundColor = theme.colors.cellEditBackground;
  }

  private handleTextareaKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault();
          this.commitAndClose('enter');
        } else {
          e.preventDefault();
          this.commitAndClose('shift-enter');
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.cancelAndClose();
        break;
      case 'Tab':
        e.preventDefault();
        this.commitAndClose(e.shiftKey ? 'shift-tab' : 'tab');
        break;
    }

    // Stop propagation so navigation handlers don't fire.
    // This is a safety measure — since the textarea is not inside the
    // scroll container, keyboard events wouldn't reach EventTranslator
    // anyway, but we stop them to prevent any bubbling to the container.
    e.stopPropagation();
  };

  private close(reason: EditorCloseReason): void {
    if (!this._isEditing) return;

    this._isEditing = false;

    // Remove textarea
    if (this.textarea) {
      this.textarea.removeEventListener('keydown', this.handleTextareaKeyDown);
      if (this.textarea.parentNode) {
        this.textarea.parentNode.removeChild(this.textarea);
      }
      this.textarea = null;
    }

    // Remove scroll listener
    if (this.scrollHandler) {
      this.config.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    this.config.onClose(reason);
  }

  /** Clean up when the engine is destroyed. */
  destroy(): void {
    if (this._isEditing) {
      this.close('programmatic');
    }
  }
}
