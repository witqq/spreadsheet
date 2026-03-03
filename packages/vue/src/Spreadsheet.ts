import {
  defineComponent,
  ref,
  h,
  onMounted,
  onUnmounted,
  watch,
  type PropType,
} from 'vue';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type {
  SpreadsheetEngineConfig,
  ColumnDef,
  CellData,
  CellValue,
  Selection,
  SpreadsheetTheme,
  SpreadsheetPlugin,
} from '@witqq/spreadsheet';

const EMIT_EVENTS = [
  'cellChange',
  'selectionChange',
  'sortChange',
  'filterChange',
  'scroll',
  'ready',
] as const;

export const Spreadsheet = defineComponent({
  name: 'Spreadsheet',

  props: {
    columns: {
      type: Array as PropType<ColumnDef[]>,
      required: true,
    },
    data: {
      type: Array as PropType<Record<string, unknown>[]>,
      default: undefined,
    },
    rowCount: {
      type: Number,
      default: undefined,
    },
    theme: {
      type: Object as PropType<SpreadsheetTheme>,
      default: undefined,
    },
    frozenRows: {
      type: Number,
      default: undefined,
    },
    frozenColumns: {
      type: Number,
      default: undefined,
    },
    editable: {
      type: Boolean,
      default: undefined,
    },
    sortable: {
      type: Boolean,
      default: undefined,
    },
    showGridLines: {
      type: Boolean,
      default: undefined,
    },
    showRowNumbers: {
      type: Boolean,
      default: undefined,
    },
    rowHeight: {
      type: Number,
      default: undefined,
    },
    headerHeight: {
      type: Number,
      default: undefined,
    },
    width: {
      type: [Number, String] as PropType<number | string>,
      default: undefined,
    },
    height: {
      type: [Number, String] as PropType<number | string>,
      default: undefined,
    },
  },

  emits: ['cellChange', 'selectionChange', 'sortChange', 'filterChange', 'scroll', 'ready'],

  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let engine: SpreadsheetEngine | null = null;
    const handlers: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];

    onMounted(() => {
      if (!containerRef.value) return;

      const config: SpreadsheetEngineConfig = {
        columns: props.columns,
        data: props.data,
        rowCount: props.rowCount,
        theme: props.theme,
        frozenRows: props.frozenRows,
        frozenColumns: props.frozenColumns,
        editable: props.editable,
        sortable: props.sortable,
        showGridLines: props.showGridLines,
        showRowNumbers: props.showRowNumbers,
        rowHeight: props.rowHeight,
        headerHeight: props.headerHeight,
        width: props.width,
        height: props.height,
      };

      engine = new SpreadsheetEngine(config);
      engine.mount(containerRef.value);

      for (const eventName of EMIT_EVENTS) {
        const handler = (...args: unknown[]) => {
          emit(eventName, ...args);
        };
        engine.on(eventName, handler);
        handlers.push({ event: eventName, handler });
      }
    });

    onUnmounted(() => {
      if (engine) {
        for (const { event, handler } of handlers) {
          engine.off(event, handler);
        }
        engine.destroy();
        engine = null;
      }
      handlers.length = 0;
    });

    watch(
      () => props.theme,
      (newTheme) => {
        if (engine && newTheme && newTheme !== engine.getTheme()) {
          engine.setTheme(newTheme);
        }
      },
    );

    watch(
      () => props.data,
      (newData) => {
        if (!engine || newData === undefined) return;
        const columnKeys = props.columns.map((c) => c.key);
        engine.getCellStore().clear();
        engine.getCellStore().bulkLoad(newData, columnKeys);
        engine.setRowCount(newData.length);
        engine.requestRender();
      },
    );

    expose({
      getInstance(): SpreadsheetEngine {
        if (!engine) throw new Error('Spreadsheet not mounted');
        return engine;
      },
      focus(): void {
        containerRef.value?.focus();
      },
      getSelection(): Selection {
        if (!engine) throw new Error('Spreadsheet not mounted');
        return engine.getSelection();
      },
      selectCell(row: number, col: number): void {
        engine?.selectCell(row, col);
      },
      getCell(row: number, col: number): CellData | undefined {
        return engine?.getCell(row, col);
      },
      setCell(row: number, col: number, value: CellValue): void {
        engine?.setCell(row, col, value);
      },
      undo(): void {
        engine?.getCommandManager().undo();
      },
      redo(): void {
        engine?.getCommandManager().redo();
      },
      scrollTo(x: number, y: number): void {
        engine?.scrollTo(x, y);
      },
      requestRender(): void {
        engine?.requestRender();
      },
      installPlugin(plugin: SpreadsheetPlugin): void {
        engine?.installPlugin(plugin);
      },
      removePlugin(name: string): void {
        engine?.removePlugin(name);
      },
      print(): void {
        engine?.print();
      },
    });

    return () =>
      h('div', {
        ref: containerRef,
        style: { position: 'relative', overflow: 'hidden' },
        tabindex: 0,
      });
  },
});

export interface SpreadsheetExposed {
  getInstance(): SpreadsheetEngine;
  focus(): void;
  getSelection(): Selection;
  selectCell(row: number, col: number): void;
  getCell(row: number, col: number): CellData | undefined;
  setCell(row: number, col: number, value: CellValue): void;
  undo(): void;
  redo(): void;
  scrollTo(x: number, y: number): void;
  requestRender(): void;
  installPlugin(plugin: SpreadsheetPlugin): void;
  removePlugin(name: string): void;
  print(): void;
}
