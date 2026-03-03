import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type {
  SpreadsheetEngineConfig,
  ColumnDef,
  CellData,
  CellValue,
  Selection,
  SpreadsheetTheme,
  SpreadsheetPlugin,
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet';

@Component({
  selector: 'witqq-spreadsheet',
  standalone: true,
  template: `<div #container style="position: relative; overflow: hidden" tabindex="0"></div>`,
})
export class SpreadsheetComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  // ─── Inputs (map to SpreadsheetEngineConfig) ─────────────────────

  @Input({ required: true }) columns!: ColumnDef[];
  @Input() data?: Record<string, unknown>[];
  @Input() rowCount?: number;
  @Input() theme?: SpreadsheetTheme;
  @Input() frozenRows?: number;
  @Input() frozenColumns?: number;
  @Input() editable?: boolean;
  @Input() sortable?: boolean;
  @Input() showGridLines?: boolean;
  @Input() showRowNumbers?: boolean;
  @Input() rowHeight?: number;
  @Input() headerHeight?: number;
  @Input() width?: number | string;
  @Input() height?: number | string;

  // ─── Outputs ─────────────────────────────────────────────

  @Output() cellChange = new EventEmitter<CellChangeEvent>();
  @Output() selectionChange = new EventEmitter<SelectionChangeEvent>();
  @Output() sortChange = new EventEmitter<SortChangeEvent>();
  @Output() filterChange = new EventEmitter<FilterChangeEvent>();
  @Output() scroll = new EventEmitter<ScrollEvent>();
  @Output() ready = new EventEmitter<void>();

  // ─── Private state ───────────────────────────────────────

  private engine: SpreadsheetEngine | null = null;
  private readonly handlers: Array<{
    event: string;
    handler: (...args: unknown[]) => void;
  }> = [];

  // ─── Lifecycle ───────────────────────────────────────────

  ngOnInit(): void {
    const config: SpreadsheetEngineConfig = {
      columns: this.columns,
      data: this.data,
      rowCount: this.rowCount,
      theme: this.theme,
      frozenRows: this.frozenRows,
      frozenColumns: this.frozenColumns,
      editable: this.editable,
      sortable: this.sortable,
      showGridLines: this.showGridLines,
      showRowNumbers: this.showRowNumbers,
      rowHeight: this.rowHeight,
      headerHeight: this.headerHeight,
      width: this.width,
      height: this.height,
    };

    this.engine = new SpreadsheetEngine(config);
    this.engine.mount(this.containerRef.nativeElement);

    const eventMap: Array<[string, EventEmitter<unknown>]> = [
      ['cellChange', this.cellChange],
      ['selectionChange', this.selectionChange],
      ['sortChange', this.sortChange],
      ['filterChange', this.filterChange],
      ['scroll', this.scroll],
      ['ready', this.ready],
    ];

    for (const [eventName, emitter] of eventMap) {
      const handler = (...args: unknown[]) => emitter.emit(args[0]);
      this.engine.on(eventName, handler);
      this.handlers.push({ event: eventName, handler });
    }
  }

  ngOnDestroy(): void {
    if (this.engine) {
      for (const { event, handler } of this.handlers) {
        this.engine.off(event, handler);
      }
      this.engine.destroy();
      this.engine = null;
    }
    this.handlers.length = 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.engine) return;

    if (changes['theme'] && !changes['theme'].firstChange) {
      const newTheme = changes['theme'].currentValue;
      if (newTheme && newTheme !== this.engine.getTheme()) {
        this.engine.setTheme(newTheme);
      }
    }

    if (changes['data'] && !changes['data'].firstChange) {
      const newData = changes['data'].currentValue;
      if (newData !== undefined) {
        const columnKeys = this.columns.map((c) => c.key);
        this.engine.getCellStore().clear();
        this.engine.getCellStore().bulkLoad(newData, columnKeys);
        this.engine.setRowCount(newData.length);
        this.engine.requestRender();
      }
    }
  }

  // ─── Public API (accessible via ViewChild) ───────────────

  getInstance(): SpreadsheetEngine {
    if (!this.engine) throw new Error('Spreadsheet not initialized');
    return this.engine;
  }

  focus(): void {
    this.containerRef?.nativeElement.focus();
  }

  getSelection(): Selection {
    if (!this.engine) throw new Error('Spreadsheet not initialized');
    return this.engine.getSelection();
  }

  selectCell(row: number, col: number): void {
    this.engine?.selectCell(row, col);
  }

  getCell(row: number, col: number): CellData | undefined {
    return this.engine?.getCell(row, col);
  }

  setCell(row: number, col: number, value: CellValue): void {
    this.engine?.setCell(row, col, value);
  }

  undo(): void {
    this.engine?.getCommandManager().undo();
  }

  redo(): void {
    this.engine?.getCommandManager().redo();
  }

  scrollTo(x: number, y: number): void {
    this.engine?.scrollTo(x, y);
  }

  requestRender(): void {
    this.engine?.requestRender();
  }

  installPlugin(plugin: SpreadsheetPlugin): void {
    this.engine?.installPlugin(plugin);
  }

  removePlugin(name: string): void {
    this.engine?.removePlugin(name);
  }

  print(): void {
    this.engine?.print();
  }
}
