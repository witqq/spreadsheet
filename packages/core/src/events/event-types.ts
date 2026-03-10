// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellValue,
  CellRange,
  Selection,
  ColumnDef,
  CellMetadata,
  ValidationResult,
} from '../types/interfaces';
import type { FillDirection } from '../autofill/autofill-manager';
import type { SpreadsheetTheme } from '../themes/theme-types';

// --- Public Events ---

/** Event payload for cell click and double-click. */
export interface CellEvent {
  row: number;
  col: number;
  value: CellValue;
  column: ColumnDef;
  /** Sub-cell hit zone ID, if the click/hover landed on a declared zone. */
  hitZone?: string;
}

/** Event payload when a cell value changes (via editing, paste, or autofill). */
export interface CellChangeEvent extends CellEvent {
  oldValue: CellValue;
  newValue: CellValue;
  source: string;
}

/** Event payload when the selection changes. */
export interface SelectionChangeEvent {
  selection: Selection;
  previousSelection: Selection;
}

/** Event payload on scroll position change. */
export interface ScrollEvent {
  scrollTop: number;
  scrollLeft: number;
}

// --- Internal Grid Events ---

export type HitRegion =
  | 'cell'
  | 'header'
  | 'header-sort-icon'
  | 'header-filter-icon'
  | 'row-number'
  | 'row-group-toggle'
  | 'corner'
  | 'outside';

export interface HitTestResult {
  /** Region of the grid that was hit. */
  readonly region: HitRegion;
  /** Row index (-1 if not applicable, e.g. header click). */
  readonly row: number;
  /** Column index (-1 if not applicable, e.g. row-number click). */
  readonly col: number;
  /** Sub-cell hit zone ID, if the hit landed on a declared zone. */
  readonly hitZone?: string;
  /** CSS cursor style for the hit zone, if the zone declares one. */
  readonly hitZoneCursor?: string;
}

export interface GridMouseEvent extends HitTestResult {
  /** Original DOM mouse event. */
  readonly originalEvent: MouseEvent;
  /** Whether Shift key was held. */
  readonly shiftKey: boolean;
  /** Whether Ctrl/Cmd key was held. */
  readonly ctrlKey: boolean;
}

export interface GridKeyboardEvent {
  /** Original DOM keyboard event. */
  readonly originalEvent: KeyboardEvent;
  /** Key code (e.g. 'ArrowDown', 'Enter', 'Tab'). */
  readonly key: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
}

// --- Command Events ---

export interface CommandEvent {
  /** Human-readable description of the command. */
  description: string;
}

// --- Clipboard Events ---

export interface ClipboardDataEvent {
  /** Number of rows in the clipboard data. */
  rowCount: number;
  /** Number of columns in the clipboard data. */
  colCount: number;
}

// --- Column Resize Events ---

export interface ColumnResizeEvent {
  /** Column index that was resized. */
  colIndex: number;
  /** Width before resize. */
  oldWidth: number;
  /** Width after resize. */
  newWidth: number;
}

// --- Row Resize Events ---

export interface RowResizeEvent {
  /** Row index that was resized. */
  rowIndex: number;
  /** Height before resize. */
  oldHeight: number;
  /** Height after resize. */
  newHeight: number;
}

// --- Cell Status Events ---

export interface CellStatusChangeEvent {
  row: number;
  col: number;
  oldStatus: CellMetadata['status'] | undefined;
  newStatus: CellMetadata['status'] | undefined;
  errorMessage?: string;
}

export interface CellValidationEvent {
  row: number;
  col: number;
  result: ValidationResult;
}

// --- Autofill Events ---

export interface AutofillStartEvent {
  sourceRange: CellRange;
}

export interface AutofillPreviewEvent {
  sourceRange: CellRange;
  fillRange: CellRange | null;
  direction: FillDirection | null;
}

export interface AutofillCompleteEvent {
  sourceRange: CellRange;
  fillRange: CellRange;
  direction: FillDirection;
}

// --- Sort Events ---

export interface SortChangeEvent {
  /** Current sort columns after the change. */
  readonly sortColumns: readonly { col: number; direction: 'asc' | 'desc' }[];
}

export interface SortRejectedEvent {
  /** Reason the sort was rejected. */
  readonly reason: 'merged-regions-exist';
}

// --- Filter Events ---

export interface FilterChangeEvent {
  /** Number of visible rows after filtering. */
  readonly visibleRowCount: number;
  /** Total physical rows. */
  readonly totalRowCount: number;
}

// --- Row Group Events ---

export interface RowGroupToggleEvent {
  /** Physical row index of the group header. */
  readonly headerRow: number;
  /** New expanded state after toggle. */
  readonly expanded: boolean;
}

export interface RowGroupChangeEvent {
  /** All group header rows. */
  readonly groupHeaders: readonly number[];
}

// --- Event Map ---

/**
 * Complete event map for witqq spreadsheet.
 *
 * Subscribe via `engine.on('eventName', handler)`.
 * Internal `grid*` events are used for inter-component communication.
 */
export interface SpreadsheetEvents {
  // Public events
  cellClick: (event: CellEvent) => void;
  cellDoubleClick: (event: CellEvent) => void;
  cellHover: (event: CellEvent) => void;
  cellChange: (event: CellChangeEvent) => void;
  selectionChange: (event: SelectionChangeEvent) => void;
  scroll: (event: ScrollEvent) => void;
  ready: () => void;
  destroy: () => void;

  // Command events
  commandExecute: (event: CommandEvent) => void;
  commandUndo: (event: CommandEvent) => void;
  commandRedo: (event: CommandEvent) => void;

  // Clipboard events
  clipboardCopy: (event: ClipboardDataEvent) => void;
  clipboardCut: (event: ClipboardDataEvent) => void;
  clipboardPaste: (event: ClipboardDataEvent) => void;

  // Column resize events
  columnResize: (event: ColumnResizeEvent) => void;
  columnResizeStart: (event: { colIndex: number }) => void;
  columnResizeEnd: (event: ColumnResizeEvent) => void;

  // Row resize events
  rowResize: (event: RowResizeEvent) => void;
  rowResizeStart: (event: { rowIndex: number }) => void;
  rowResizeEnd: (event: RowResizeEvent) => void;

  // Cell status & validation events
  cellStatusChange: (event: CellStatusChangeEvent) => void;
  cellValidation: (event: CellValidationEvent) => void;

  // Autofill events
  autofillStart: (event: AutofillStartEvent) => void;
  autofillPreview: (event: AutofillPreviewEvent) => void;
  autofillComplete: (event: AutofillCompleteEvent) => void;

  // Sort events
  sortChange: (event: SortChangeEvent) => void;
  sortRejected: (event: SortRejectedEvent) => void;

  // Filter events
  filterChange: (event: FilterChangeEvent) => void;

  // Row group events
  rowGroupToggle: (event: RowGroupToggleEvent) => void;
  rowGroupChange: (event: RowGroupChangeEvent) => void;

  // Theme events
  themeChange: (event: { theme: SpreadsheetTheme }) => void;

  // Internal grid events (for inter-component communication)
  gridMouseDown: (event: GridMouseEvent) => void;
  gridMouseMove: (event: GridMouseEvent) => void;
  gridMouseUp: (event: GridMouseEvent) => void;
  gridMouseHover: (event: GridMouseEvent) => void;
  gridContextMenu: (event: GridMouseEvent) => void;
  gridKeyDown: (event: GridKeyboardEvent) => void;
}
