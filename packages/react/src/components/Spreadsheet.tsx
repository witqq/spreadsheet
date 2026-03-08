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
} from '@witqq/spreadsheet';
import type {
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet';

// ─── Callback props ──────────────────────────────────────────

export interface SpreadsheetCallbacks {
  onCellChange?: (event: CellChangeEvent) => void;
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  onSortChange?: (event: SortChangeEvent) => void;
  onFilterChange?: (event: FilterChangeEvent) => void;
  onScroll?: (event: ScrollEvent) => void;
  onReady?: () => void;
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
  'onCellChange',
  'onSelectionChange',
  'onSortChange',
  'onFilterChange',
  'onScroll',
  'onReady',
];

// Map callback prop name → EventBus event name
const CALLBACK_EVENT_MAP: Record<CallbackKey, string> = {
  onCellChange: 'cellChange',
  onSelectionChange: 'selectionChange',
  onSortChange: 'sortChange',
  onFilterChange: 'filterChange',
  onScroll: 'scroll',
  onReady: 'ready',
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
      onCellChange: _1,
      onSelectionChange: _2,
      onSortChange: _3,
      onFilterChange: _4,
      onScroll: _5,
      onReady: _6,
      ...config
    } = props; // destructure callbacks to exclude from engine config

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
