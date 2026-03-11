// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { useEffect, useImperativeHandle, useRef, forwardRef, type Ref } from 'react';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type {
  SpreadsheetEngineConfig,
  CellData,
  CellValue,
  Selection,
  SpreadsheetPlugin,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';
import type {
  CellEvent,
  CellChangeEvent,
  SelectionChangeEvent,
  ScrollEvent,
  CommandEvent,
  ClipboardDataEvent,
  ColumnResizeEvent,
  RowResizeEvent,
  CellStatusChangeEvent,
  CellValidationEvent,
  AutofillStartEvent,
  AutofillPreviewEvent,
  AutofillCompleteEvent,
  SortChangeEvent,
  SortRejectedEvent,
  FilterChangeEvent,
  RowGroupToggleEvent,
  RowGroupChangeEvent,
  SpreadsheetEvents,
} from '@witqq/spreadsheet';

// ─── Callback props ──────────────────────────────────────────

export interface SpreadsheetCallbacks {
  // Cell events
  onCellClick?: (event: CellEvent) => void;
  onCellDoubleClick?: (event: CellEvent) => void;
  onCellHover?: (event: CellEvent) => void;
  onCellChange?: (event: CellChangeEvent) => void;

  // Selection & scroll
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  onScroll?: (event: ScrollEvent) => void;

  // Lifecycle
  onReady?: () => void;
  onDestroy?: () => void;

  // Command events
  onCommandExecute?: (event: CommandEvent) => void;
  onCommandUndo?: (event: CommandEvent) => void;
  onCommandRedo?: (event: CommandEvent) => void;

  // Clipboard events
  onClipboardCopy?: (event: ClipboardDataEvent) => void;
  onClipboardCut?: (event: ClipboardDataEvent) => void;
  onClipboardPaste?: (event: ClipboardDataEvent) => void;

  // Column resize events
  onColumnResize?: (event: ColumnResizeEvent) => void;
  onColumnResizeStart?: (event: { colIndex: number }) => void;
  onColumnResizeEnd?: (event: ColumnResizeEvent) => void;

  // Row resize events
  onRowResize?: (event: RowResizeEvent) => void;
  onRowResizeStart?: (event: { rowIndex: number }) => void;
  onRowResizeEnd?: (event: RowResizeEvent) => void;

  // Cell status & validation
  onCellStatusChange?: (event: CellStatusChangeEvent) => void;
  onCellValidation?: (event: CellValidationEvent) => void;

  // Autofill events
  onAutofillStart?: (event: AutofillStartEvent) => void;
  onAutofillPreview?: (event: AutofillPreviewEvent) => void;
  onAutofillComplete?: (event: AutofillCompleteEvent) => void;

  // Sort events
  onSortChange?: (event: SortChangeEvent) => void;
  onSortRejected?: (event: SortRejectedEvent) => void;

  // Filter events
  onFilterChange?: (event: FilterChangeEvent) => void;

  // Row group events
  onRowGroupToggle?: (event: RowGroupToggleEvent) => void;
  onRowGroupChange?: (event: RowGroupChangeEvent) => void;

  // Theme events
  onThemeChange?: (event: { theme: SpreadsheetTheme }) => void;
}

// ─── Props (generic over row type) ──────────────────────────

export interface SpreadsheetProps<TRow extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<SpreadsheetEngineConfig, 'data'>, SpreadsheetCallbacks {
  data?: TRow[];
  className?: string;
  style?: React.CSSProperties;
}

// ─── Ref API ────────────────────────────────────────────────

export interface SpreadsheetRef {
  /** Get the underlying SpreadsheetEngine instance. */
  getInstance(): SpreadsheetEngine;
  /** Focus the container element. */
  focus(): void;
  /** Get current selection state. */
  getSelection(): Selection;
  /** Select a cell by row and column index. */
  selectCell(row: number, col: number): void;
  /** Get cell data at row,col. */
  getCell(row: number, col: number): CellData | undefined;
  /** Set cell value at row,col. */
  setCell(row: number, col: number, value: CellValue): void;
  /** Undo the last command. */
  undo(): void;
  /** Redo the last undone command. */
  redo(): void;
  /** Scroll to position. */
  scrollTo(x: number, y: number): void;
  /** Force a re-render. */
  requestRender(): void;
  /** Install a plugin. */
  installPlugin(plugin: SpreadsheetPlugin): void;
  /** Remove a plugin by name. */
  removePlugin(name: string): void;
  /** Trigger print dialog with clean table output. */
  print(): void;
}

// ─── Callback ref keys (to avoid stale closures) ────────────

type CallbackKey = keyof SpreadsheetCallbacks;
const CALLBACK_KEYS: CallbackKey[] = [
  'onCellClick',
  'onCellDoubleClick',
  'onCellHover',
  'onCellChange',
  'onSelectionChange',
  'onScroll',
  'onReady',
  'onDestroy',
  'onCommandExecute',
  'onCommandUndo',
  'onCommandRedo',
  'onClipboardCopy',
  'onClipboardCut',
  'onClipboardPaste',
  'onColumnResize',
  'onColumnResizeStart',
  'onColumnResizeEnd',
  'onRowResize',
  'onRowResizeStart',
  'onRowResizeEnd',
  'onCellStatusChange',
  'onCellValidation',
  'onAutofillStart',
  'onAutofillPreview',
  'onAutofillComplete',
  'onSortChange',
  'onSortRejected',
  'onFilterChange',
  'onRowGroupToggle',
  'onRowGroupChange',
  'onThemeChange',
];

// Map callback prop name → EventBus event name
const CALLBACK_EVENT_MAP: Record<CallbackKey, keyof SpreadsheetEvents> = {
  onCellClick: 'cellClick',
  onCellDoubleClick: 'cellDoubleClick',
  onCellHover: 'cellHover',
  onCellChange: 'cellChange',
  onSelectionChange: 'selectionChange',
  onScroll: 'scroll',
  onReady: 'ready',
  onDestroy: 'destroy',
  onCommandExecute: 'commandExecute',
  onCommandUndo: 'commandUndo',
  onCommandRedo: 'commandRedo',
  onClipboardCopy: 'clipboardCopy',
  onClipboardCut: 'clipboardCut',
  onClipboardPaste: 'clipboardPaste',
  onColumnResize: 'columnResize',
  onColumnResizeStart: 'columnResizeStart',
  onColumnResizeEnd: 'columnResizeEnd',
  onRowResize: 'rowResize',
  onRowResizeStart: 'rowResizeStart',
  onRowResizeEnd: 'rowResizeEnd',
  onCellStatusChange: 'cellStatusChange',
  onCellValidation: 'cellValidation',
  onAutofillStart: 'autofillStart',
  onAutofillPreview: 'autofillPreview',
  onAutofillComplete: 'autofillComplete',
  onSortChange: 'sortChange',
  onSortRejected: 'sortRejected',
  onFilterChange: 'filterChange',
  onRowGroupToggle: 'rowGroupToggle',
  onRowGroupChange: 'rowGroupChange',
  onThemeChange: 'themeChange',
};

// ─── Component ──────────────────────────────────────────────

function SpreadsheetInner<TRow extends Record<string, unknown> = Record<string, unknown>>(
  props: SpreadsheetProps<TRow>,
  ref: Ref<SpreadsheetRef>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SpreadsheetEngine | null>(null);

  // Store callbacks in refs to avoid stale closures
  const callbackRefs = useRef<SpreadsheetCallbacks>({});
  for (const key of CALLBACK_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (callbackRefs.current as any)[key] = props[key];
  }

  useImperativeHandle(ref, () => ({
    getInstance() {
      if (!engineRef.current) throw new Error('Spreadsheet not mounted');
      return engineRef.current;
    },
    focus() {
      containerRef.current?.focus();
    },
    getSelection() {
      if (!engineRef.current) throw new Error('Spreadsheet not mounted');
      return engineRef.current.getSelection();
    },
    selectCell(row: number, col: number) {
      engineRef.current?.selectCell(row, col);
    },
    getCell(row: number, col: number) {
      return engineRef.current?.getCell(row, col);
    },
    setCell(row: number, col: number, value: CellValue) {
      engineRef.current?.setCell(row, col, value);
    },
    undo() {
      engineRef.current?.getCommandManager().undo();
    },
    redo() {
      engineRef.current?.getCommandManager().redo();
    },
    scrollTo(x: number, y: number) {
      engineRef.current?.scrollTo(x, y);
    },
    requestRender() {
      engineRef.current?.requestRender();
    },
    installPlugin(plugin: SpreadsheetPlugin) {
      engineRef.current?.installPlugin(plugin);
    },
    removePlugin(name: string) {
      engineRef.current?.removePlugin(name);
    },
    print() {
      engineRef.current?.print();
    },
  }));

  // Mount engine once
  useEffect(() => {
    if (!containerRef.current) return;

    const {
      className: _cls,
      style: _style,
      ...configWithCallbacks
    } = props;

    // Strip all callback props from engine config
    const config: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(configWithCallbacks)) {
      if (!(k in CALLBACK_EVENT_MAP)) {
        config[k] = v;
      }
    }

    const engine = new SpreadsheetEngine(config as SpreadsheetEngineConfig);
    engine.mount(containerRef.current);
    engineRef.current = engine;

    // Wire EventBus → callback refs (stable handlers that read from refs)
    const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

    for (const key of CALLBACK_KEYS) {
      const eventName = CALLBACK_EVENT_MAP[key];
      const handler = (...args: unknown[]) => {
        const cb = callbackRefs.current[key];
        if (cb) (cb as (...a: unknown[]) => void)(...args);
      };
      engine.on(eventName, handler);
      handlers.push({ event: eventName, handler });
    }

    return () => {
      // Unsubscribe all handlers before destroy
      for (const { event, handler } of handlers) {
        engine.off(event, handler);
      }
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Prop update: theme (without remount)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const theme = props.theme;
    if (theme && theme !== engine.getTheme()) {
      engine.setTheme(theme);
    }
  }, [props.theme]);

  // Prop update: data (clear + reload)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const data = props.data;
    if (data === undefined) return;

    const columnKeys = props.columns.map((c) => c.key);
    engine.getCellStore().clear();
    engine.getCellStore().bulkLoad(data, columnKeys);
    engine.setRowCount(data.length);
    engine.requestRender();
  }, [props.data]);

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...props.style,
      }}
      tabIndex={0}
    />
  );
}

// forwardRef with generic support
export const Spreadsheet = forwardRef(SpreadsheetInner) as <
  TRow extends Record<string, unknown> = Record<string, unknown>,
>(
  props: SpreadsheetProps<TRow> & { ref?: Ref<SpreadsheetRef> },
) => React.ReactElement | null;
