// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * CellEditor — generic interface for overlay cell editors.
 *
 * Implementations render a DOM overlay (calendar, dropdown, color picker, etc.)
 * positioned above a cell. The engine delegates lifecycle management to the
 * editor via this interface.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { CellValue, ColumnDef } from '../types/interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { MergeManager } from '../merge/merge-manager';
import type { ResolvedLocale } from '../locale/resolve-locale';
import type { EditorCloseReason } from './inline-editor';

/** Context passed to CellEditor.open() with everything needed to render. */
export interface CellEditorContext {
  /** Logical row index. */
  row: number;
  /** Logical column index. */
  col: number;
  /** Current cell value. */
  value: CellValue;
  /** Column definition for the cell being edited. */
  column: ColumnDef;
  /** DOM container to append the editor overlay into. */
  container: HTMLElement;
  /** Scroll container (for scroll-close behavior). */
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  cellStore: CellStore;
  dataView: DataView;
  theme: SpreadsheetTheme;
  locale: ResolvedLocale;
  mergeManager: MergeManager | null;
  frozenRows: number;
  frozenColumns: number;
}

/** Callback to commit a value and close the editor. */
export type CellEditorCommit = (
  row: number,
  col: number,
  oldValue: CellValue,
  newValue: CellValue,
) => void;

/** Callback when the editor closes. */
export type CellEditorClose = (reason: EditorCloseReason) => void;

/**
 * CellEditor interface — lifecycle contract for custom overlay editors.
 *
 * Implementations must:
 * - Render DOM into context.container on open()
 * - Remove DOM on close()
 * - Call commitFn to persist changes
 * - Call closeFn to signal the engine
 * - Clean up all resources on destroy()
 */
export interface CellEditor {
  /** Unique identifier for this editor type. */
  readonly id: string;

  /** Whether the editor is currently open. */
  readonly isOpen: boolean;

  /** Row being edited (valid when isOpen). */
  readonly editingRow: number;

  /** Column being edited (valid when isOpen). */
  readonly editingCol: number;

  /**
   * Open the editor for a cell.
   * @param context Cell context with position, value, layout, theme, locale
   * @param commitFn Call to persist a new value
   * @param closeFn Call when the editor closes (for any reason)
   */
  open(context: CellEditorContext, commitFn: CellEditorCommit, closeFn: CellEditorClose): void;

  /**
   * Close the editor.
   * @param reason Why the editor is closing
   */
  close(reason: EditorCloseReason): void;

  /** Update theme at runtime (editor may be open or closed). */
  setTheme(theme: SpreadsheetTheme): void;

  /** Update locale at runtime (editor may be open or closed). */
  setLocale(locale: ResolvedLocale): void;

  /** Clean up all resources (DOM, listeners). Called when engine is destroyed. */
  destroy(): void;
}

/**
 * Predicate to determine if an editor handles a given column.
 * Return true if this editor should be used for the column.
 */
export type CellEditorMatcher = (column: ColumnDef, value: CellValue) => boolean;

/** Registration entry in the CellEditorRegistry. */
export interface CellEditorRegistration {
  /** The editor instance. */
  editor: CellEditor;
  /** Predicate to match columns/values this editor handles. */
  matcher: CellEditorMatcher;
  /** Higher priority wins when multiple editors match (default: 0). */
  priority: number;
}
