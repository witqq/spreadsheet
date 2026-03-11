// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * SpreadsheetEngine — main entry point for the spreadsheet engine.
 *
 * Framework-agnostic. Use directly or via framework wrappers.
 */

import type {
  CellData,
  CellValue,
  CellRange,
  CellMetadata,
  Selection,
  ColumnDef,
} from '../types/interfaces';
import { CanvasManager } from '../renderer/canvas-manager';
import { GridRenderer } from '../renderer/grid-renderer';
import { LayoutEngine } from '../renderer/layout-engine';
import { ViewportManager } from '../renderer/viewport-manager';
import { RenderScheduler } from '../renderer/render-scheduler';
import { DirtyTracker } from '../renderer/dirty-tracker';
import type { DirtyRect } from '../renderer/dirty-tracker';
import { ScrollManager } from '../renderer/scroll-manager';
import type { RenderMode } from '../renderer/render-layer';
import { CellStore } from '../model/cell-store';
import { RowStore } from '../model/row-store';
import { EventBus } from '../events/event-bus';
import { EventTranslator } from '../events/event-translator';
import { SelectionManager } from '../selection/selection-manager';
import { KeyboardNavigator } from '../selection/keyboard-navigator';
import { InlineEditor } from '../editing/inline-editor';
import type { EditorCloseReason } from '../editing/inline-editor';
import { CellTypeRegistry } from '../types/cell-type-registry';
import type { SpreadsheetEvents } from '../events/event-types';
import type { CellEvent } from '../events/event-types';
import type { GridMouseEvent, GridKeyboardEvent } from '../events/event-types';
import type { SpreadsheetTheme } from '../themes/theme-types';
import { lightTheme } from '../themes/built-in-themes';
import { CommandManager } from '../commands/command-manager';
import type { Command } from '../commands/command';
import { CellEditCommand } from '../commands/cell-edit-command';
import { MergeCellsCommand, UnmergeCellsCommand } from '../commands/merge-commands';
import { ClipboardManager } from '../clipboard/clipboard-manager';
import { ColumnResizeManager } from '../resize/column-resize-manager';
import { RowResizeManager } from '../resize/row-resize-manager';
import { ChangeTracker } from '../tracking/change-tracker';
import { ValidationEngine } from '../validation/validation-engine';
import type { SpreadsheetValidationRule } from '../validation/validation-engine';
import { TooltipManager } from '../tooltip/tooltip-manager';
import { AutofillManager } from '../autofill/autofill-manager';
import { FillHandleLayer } from '../renderer/layers/fill-handle-layer';
import { AriaManager } from '../aria/aria-manager';
import { DataView } from '../dataview/data-view';
import { SortEngine } from '../sort/sort-engine';
import { FilterEngine } from '../filter/filter-engine';
import type { FilterCondition } from '../filter/filter-engine';
import { FilterPanel } from '../filter/filter-panel';
import type { SortColumn, SortDirection } from '../sort/sort-engine';
import { MergeManager } from '../merge/merge-manager';
import type { MergedRegion } from '../types/interfaces';
import { ContextMenuManager } from '../context-menu/context-menu-manager';
import type { ContextMenuItem } from '../context-menu/context-menu-manager';
import { PrintManager } from '../print/print-manager';
import type { SpreadsheetPlugin, PluginAPI } from '../plugins/plugin-types';
import { createDefaultMenuItems } from '../context-menu/default-items';
import { RowGroupManager } from '../grouping/row-group-manager';
import type { RowGroupDef, ColumnAggregate } from '../grouping/row-group-manager';
import { RowGroupToggleLayer } from '../renderer/layers/row-group-toggle-layer';
import { AutoRowSizeManager } from '../auto-row-size/auto-row-size-manager';
import type { AutoRowSizeConfig } from '../auto-row-size/auto-row-size-manager';
import { CellTextLayer } from '../renderer/layers/cell-text-layer';
import { ColumnStretchManager } from '../resize/column-stretch-manager';
import { CellEditorRegistry } from '../editing/cell-editor-registry';
import { DatePickerEditor } from '../editing/date-picker-editor';
import { DateTimeEditor } from '../editing/date-time-editor';
import type { CellEditor, CellEditorContext } from '../editing/cell-editor';
import type { SpreadsheetLocale } from '../locale/locale-types';
import { resolveLocale } from '../locale/resolve-locale';
import type { ResolvedLocale } from '../locale/resolve-locale';

// Plugin API implementation for per-plugin state isolation
class SpreadsheetPluginAPI implements PluginAPI {
  readonly engine: SpreadsheetEngine;
  private state = new Map<string, unknown>();

  constructor(engine: SpreadsheetEngine) {
    this.engine = engine;
  }

  getPluginState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  setPluginState<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  /** Clear all state on plugin removal. */
  clearState(): void {
    this.state.clear();
  }
}

/**
 * Configuration for creating a {@link SpreadsheetEngine} instance.
 *
 * @example
 * ```ts
 * const engine = new SpreadsheetEngine({
 *   columns: [
 *     { key: 'name', title: 'Name', width: 200 },
 *     { key: 'age', title: 'Age', width: 80, type: 'number' },
 *   ],
 *   rowCount: 1000,
 *   editable: true,
 * });
 * engine.mount(document.getElementById('grid')!);
 * ```
 */
export interface SpreadsheetEngineConfig {
  /** Column definitions (required). */
  columns: ColumnDef[];
  /** Initial row data keyed by column key. */
  data?: Record<string, unknown>[];
  /** Total row count (default: data.length or 0). */
  rowCount?: number;
  /** Container width (pixels or CSS string). */
  width?: number | string;
  /** Container height (pixels or CSS string). */
  height?: number | string;
  /** Enable inline cell editing (default: false). */
  editable?: boolean;
  /** Enable column header click-to-sort (default: false). */
  sortable?: boolean;
  /** Number of rows frozen at top. */
  frozenRows?: number;
  /** Number of columns frozen at left. */
  frozenColumns?: number;
  /** Default row height in pixels. */
  rowHeight?: number;
  /** Header row height in pixels. */
  headerHeight?: number;
  /** Show grid lines between cells (default: true). */
  showGridLines?: boolean;
  /** Show row number column at left edge (default: true). */
  showRowNumbers?: boolean;
  /** Visual theme (default: lightTheme). */
  theme?: SpreadsheetTheme;
  /** Enable automatic row height based on cell content (default: false). */
  autoRowHeight?: boolean | AutoRowSizeConfig;
  /** Stretch columns to fill container width. 'all' distributes evenly, 'last' stretches last column. */
  stretchColumns?: 'all' | 'last';
  /** Locale for built-in UI strings. Defaults to English. */
  locale?: SpreadsheetLocale;
}

export class SpreadsheetEngine {
  private config: SpreadsheetEngineConfig;
  private canvasManager: CanvasManager | null = null;
  private gridRenderer: GridRenderer | null = null;
  private layoutEngine: LayoutEngine | null = null;
  private viewportManager: ViewportManager | null = null;
  private renderScheduler: RenderScheduler | null = null;
  private dirtyTracker: DirtyTracker | null = null;
  private scrollManager: ScrollManager | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private eventBus: EventBus;
  private eventTranslator: EventTranslator | null = null;
  private selectionManager: SelectionManager;
  private keyboardNavigator: KeyboardNavigator | null = null;
  private inlineEditor: InlineEditor | null = null;
  private cellStore: CellStore;
  private rowStore: RowStore;
  private cellTypeRegistry: CellTypeRegistry;
  private commandManager: CommandManager;
  private clipboardManager: ClipboardManager | null = null;
  private columnResizeManager: ColumnResizeManager | null = null;
  private rowResizeManager: RowResizeManager | null = null;
  private changeTracker: ChangeTracker;
  private validationEngine: ValidationEngine;
  private dataView: DataView;
  private sortEngine: SortEngine;
  private filterEngine: FilterEngine;
  private filterPanel: FilterPanel | null = null;
  private tooltipManager: TooltipManager | null = null;
  private autofillManager: AutofillManager | null = null;
  private mergeManager: MergeManager;
  private rowGroupManager: RowGroupManager;
  private contextMenuManager: ContextMenuManager | null = null;
  private ariaManager: AriaManager | null = null;
  private printManager: PrintManager | null = null;
  private autoRowSizeManager: AutoRowSizeManager | null = null;
  private columnStretchManager: ColumnStretchManager | null = null;
  private cellEditorRegistry: CellEditorRegistry = new CellEditorRegistry();
  private activeOverlayEditor: CellEditor | null = null;
  /** Guard against infinite measure→render→measure loops. */
  private _inAutoMeasure = false;
  private readonly plugins = new Map<string, SpreadsheetPlugin>();
  private readonly pluginAPIs = new Map<string, SpreadsheetPluginAPI>();
  private _isDraggingSelection = false;
  private mounted = false;
  private currentTheme: SpreadsheetTheme;
  private resolvedLocale: ResolvedLocale;

  constructor(config: SpreadsheetEngineConfig) {
    this.config = config;
    this.currentTheme = config.theme ?? lightTheme;
    this.resolvedLocale = resolveLocale(config.locale);
    this.cellStore = new CellStore();
    this.rowStore = new RowStore();
    this.eventBus = new EventBus();
    this.cellTypeRegistry = new CellTypeRegistry();

    // Create DataView for logical↔physical row mapping
    const rowCount = config.rowCount ?? config.data?.length ?? 0;
    this.dataView = new DataView({ totalRowCount: rowCount });

    // Create SortEngine for column sorting
    this.sortEngine = new SortEngine({
      cellStore: this.cellStore,
      totalRowCount: rowCount,
    });

    // Create FilterEngine for row filtering
    this.filterEngine = new FilterEngine({
      cellStore: this.cellStore,
      totalRowCount: rowCount,
    });

    // Create MergeManager for merged cells
    this.mergeManager = new MergeManager();

    // Create RowGroupManager for row grouping
    this.rowGroupManager = new RowGroupManager();
    this.rowGroupManager.setCellStore(this.cellStore);
    this.rowGroupManager.setLocale(this.resolvedLocale);

    // Apply format locale to cell type registry
    if (this.resolvedLocale.formatLocale) {
      this.cellTypeRegistry.setFormatLocale(this.resolvedLocale.formatLocale);
    }

    // Create change tracker and validation engine early (before commands)
    this.changeTracker = new ChangeTracker({
      cellStore: this.cellStore,
      eventBus: this.eventBus,
    });
    this.validationEngine = new ValidationEngine({
      cellStore: this.cellStore,
      eventBus: this.eventBus,
    });

    this.commandManager = new CommandManager({
      historyLimit: 100,
      onAfterExecute: (command) => {
        this.changeTracker.handleCommandExecute(command);
        this.runValidationAfterCommand(command);
      },
      onAfterUndo: (command) => {
        this.changeTracker.handleCommandUndo(command);
        this.runValidationAfterCommand(command);
      },
      onAfterRedo: (command) => {
        this.changeTracker.handleCommandRedo(command);
        this.runValidationAfterCommand(command);
      },
    });

    const visibleColumns = config.columns.filter((c) => !c.hidden);
    this.selectionManager = new SelectionManager({
      rowCount,
      colCount: visibleColumns.length,
      onChange: (selection, previousSelection) => {
        this.eventBus.emit('selectionChange', { selection, previousSelection });
        if (this.dirtyTracker) {
          this.dirtyTracker.markDirty('full');
        }
        if (this.renderScheduler) {
          this.renderScheduler.requestRender();
        }
      },
    });
  }

  mount(container: HTMLElement): void {
    if (this.mounted) {
      this.destroy();
    }

    this.mounted = true;

    const theme = this.config.theme ?? lightTheme;
    const data = this.config.data ?? [];
    const showRowNumbers = this.config.showRowNumbers ?? true;
    const rowCount = this.config.rowCount ?? data.length;

    // Populate CellStore from data array
    if (data.length > 0) {
      const columnKeys = this.config.columns.map((col) => col.key);
      this.cellStore.bulkLoad(data, columnKeys);
    }

    // Capture baseline for change tracking after initial data load
    this.changeTracker.captureBaseline();

    // Extract validation rules from column definitions
    for (let colIdx = 0; colIdx < this.config.columns.length; colIdx++) {
      const col = this.config.columns[colIdx];
      if (col.validation && col.validation.length > 0) {
        this.validationEngine.setColumnRules(colIdx, col.validation);
      }
    }
    // Run initial validation on all loaded data
    if (data.length > 0 && this.validationEngine.hasAnyRules()) {
      this.validationEngine.validateAll(rowCount);
    }

    // Create layout computation layer
    this.layoutEngine = new LayoutEngine({
      columns: this.config.columns,
      rowCount,
      rowHeight: theme.dimensions.rowHeight,
      headerHeight: theme.dimensions.headerHeight,
      rowNumberWidth: showRowNumbers ? theme.dimensions.rowNumberWidth : 0,
      rowStore: this.rowStore,
    });

    this.viewportManager = new ViewportManager(this.layoutEngine);

    // Create single canvas
    this.canvasManager = new CanvasManager({
      container,
    });

    // Re-render on browser zoom (devicePixelRatio change)
    this.canvasManager.setDprChangeCallback(() => {
      this.handleResize();
    });

    // Create render scheduler and dirty tracker
    this.dirtyTracker = new DirtyTracker();
    this.renderScheduler = new RenderScheduler(() => this.executeRender());

    this.gridRenderer = new GridRenderer({
      columns: this.config.columns,
      cellStore: this.cellStore,
      dataView: this.dataView,
      rowCount,
      theme,
      showRowNumbers,
      showGridLines: this.config.showGridLines ?? true,
      selectionManager: this.selectionManager,
      cellTypeRegistry: this.cellTypeRegistry,
      rowPositions: this.layoutEngine.getRowPositions(),
      rowHeights: this.layoutEngine.getRowHeightsArray(),
    });

    // Wire merge manager into render pipeline
    this.gridRenderer.setMergeManager(this.mergeManager);
    this.gridRenderer.setLocale(this.resolvedLocale);

    // Create auto row size manager if enabled
    if (this.config.autoRowHeight) {
      const autoConfig =
        typeof this.config.autoRowHeight === 'object' ? this.config.autoRowHeight : {};
      this.autoRowSizeManager = new AutoRowSizeManager(
        {
          ...autoConfig,
          minRowHeight: autoConfig.minRowHeight ?? theme.dimensions.rowHeight,
        },
        (updates) => this.setAutoRowHeights(updates),
      );

      // Register render layers that can measure heights
      const cellTextLayer = this.gridRenderer.getLayer(CellTextLayer);
      if (cellTextLayer) {
        this.autoRowSizeManager.setLayers([cellTextLayer]);
      }
    }

    // Create scroll manager for native scrollbar behavior
    this.scrollManager = new ScrollManager({
      container,
      totalWidth: this.layoutEngine.totalWidth,
      totalHeight: this.layoutEngine.totalHeight,
      onScroll: (_scrollX, _scrollY) => {
        if (this.dirtyTracker) {
          this.dirtyTracker.markDirty('viewport-change');
        }
        if (this.renderScheduler) {
          this.renderScheduler.requestRender();
        }
      },
    });

    // Create event translator for DOM-to-spreadsheet event mapping
    this.eventTranslator = new EventTranslator({
      scrollContainer: this.scrollManager.getElement(),
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      eventBus: this.eventBus,
      cellStore: this.cellStore,
      dataView: this.dataView,
      columns: this.config.columns,
      rowGroupManager: this.rowGroupManager,
      cellTypeRegistry: this.cellTypeRegistry,
      getTheme: () => this.currentTheme,
    });
    this.eventTranslator.attach();
    this.eventTranslator.setFrozenConfig(
      this.config.frozenRows ?? 0,
      this.config.frozenColumns ?? 0,
    );

    // Create tooltip manager for error cell hover
    this.tooltipManager = new TooltipManager({
      container,
      eventBus: this.eventBus,
      cellStore: this.cellStore,
      dataView: this.dataView,
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      theme,
    });

    // Create keyboard navigator for arrow/tab/enter/page navigation
    this.keyboardNavigator = new KeyboardNavigator({
      selectionManager: this.selectionManager,
      getVisibleRowCount: () => {
        if (!this.canvasManager || !this.layoutEngine) return 10;
        const viewportHeight = this.canvasManager.getCssHeight();
        const frozenRows = this.config.frozenRows ?? 0;
        const frozenH = frozenRows > 0 ? this.layoutEngine.getFrozenRowsHeight(frozenRows) : 0;
        return Math.floor(
          (viewportHeight - this.layoutEngine.headerHeight - frozenH) / this.layoutEngine.rowHeight,
        );
      },
    });

    // Create inline editor for cell editing
    this.inlineEditor = new InlineEditor({
      container,
      scrollContainer: this.scrollManager.getElement(),
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      cellStore: this.cellStore,
      dataView: this.dataView,
      theme,
      frozenRows: this.config.frozenRows ?? 0,
      frozenColumns: this.config.frozenColumns ?? 0,
      onCommit: (row, col, oldValue, newValue) => {
        // Translate logical → physical row for the undoable command
        const physRow = this.dataView.getPhysicalRow(row);
        const command = new CellEditCommand(this.cellStore, physRow, col, oldValue, newValue);
        this.commandManager.execute(command);
        this.eventBus.emit('commandExecute', { description: command.description });

        const visibleCols = this.config.columns.filter((c) => !c.hidden);
        const column = visibleCols[col];
        if (column) {
          this.eventBus.emit('cellChange', {
            row,
            col,
            value: newValue,
            column,
            oldValue,
            newValue,
            source: 'edit',
          });
        }
        if (this.dirtyTracker) {
          this.dirtyTracker.markCellDirty(row, col);
        }
        if (this.renderScheduler) {
          this.renderScheduler.requestRender();
        }
      },
      onClose: (reason: EditorCloseReason) => {
        this.handleEditorClose(reason);
      },
    });

    // Register built-in DatePicker editor for date columns via CellEditorRegistry
    const datePickerEditor = new DatePickerEditor();
    this.cellEditorRegistry.registerForType(datePickerEditor, 'date', 0);
    const dateTimeEditor = new DateTimeEditor();
    this.cellEditorRegistry.registerForType(dateTimeEditor, 'datetime', 0);
    this.cellEditorRegistry.setLocale(this.resolvedLocale);

    // Wire merge manager into selection, keyboard navigator, and inline editor
    this.selectionManager.setMergeManager(this.mergeManager);
    this.keyboardNavigator.setMergeManager(this.mergeManager);
    this.inlineEditor.setMergeManager(this.mergeManager);

    // Wire selection and editing events
    this.eventBus.on('gridMouseDown', this.handleGridMouseDown);
    this.eventBus.on('gridMouseMove', this.handleGridMouseMove);
    this.eventBus.on('gridMouseUp', this.handleGridMouseUp);
    this.eventBus.on('gridMouseHover', this.handleGridMouseHover);
    this.eventBus.on('gridKeyDown', this.handleGridKeyDown);
    this.eventBus.on('cellDoubleClick', this.handleCellDoubleClick);
    this.eventBus.on('gridContextMenu', this.handleGridContextMenu);

    // Create filter panel for column filtering UI
    this.filterPanel = new FilterPanel({
      container,
      scrollContainer: this.scrollManager.getElement(),
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      theme,
      onApply: (col, operator, value, valueTo) => {
        this.setColumnFilter(col, [{ col, operator, value, valueTo }]);
      },
      onClear: (col) => {
        this.removeColumnFilter(col);
      },
    });
    this.filterPanel.setLocale(this.resolvedLocale);

    // Create clipboard manager for copy/cut/paste
    this.clipboardManager = new ClipboardManager({
      cellStore: this.cellStore,
      dataView: this.dataView,
      selectionManager: this.selectionManager,
      commandManager: this.commandManager,
      eventBus: this.eventBus,
      isEditing: () =>
        (this.inlineEditor?.isEditing ?? false) || (this.activeOverlayEditor?.isOpen ?? false),
      onDataChange: () => {
        if (this.dirtyTracker) this.dirtyTracker.markDirty('cell-update');
        if (this.renderScheduler) this.renderScheduler.requestRender();
      },
    });
    this.clipboardManager.attach(this.scrollManager.getElement());

    // Create context menu manager for right-click menus
    this.contextMenuManager = new ContextMenuManager({
      container,
      engine: this,
      eventBus: this.eventBus,
      theme,
    });
    for (const item of createDefaultMenuItems(this.resolvedLocale)) {
      this.contextMenuManager.registerItem(item);
    }

    // Create ARIA accessibility manager for screen readers
    this.ariaManager = new AriaManager({
      container,
      scrollContainer: this.scrollManager.getElement(),
      eventBus: this.eventBus,
      cellStore: this.cellStore,
      dataView: this.dataView,
      columns: this.config.columns,
      rowCount,
    });
    this.ariaManager.attach();
    this.ariaManager.setLocale(this.resolvedLocale);

    // Create print manager for @media print support
    this.printManager = new PrintManager({
      container,
      cellStore: this.cellStore,
      dataView: this.dataView,
      columns: this.config.columns,
      rowStore: this.rowStore,
      theme: this.currentTheme,
    });
    this.printManager.attach();
    this.printManager.setLocale(this.resolvedLocale);

    // Create column resize manager for drag-to-resize columns
    this.columnResizeManager = new ColumnResizeManager({
      layoutEngine: this.layoutEngine,
      gridGeometry: this.gridRenderer.getGeometry(),
      scrollManager: this.scrollManager,
      commandManager: this.commandManager,
      eventBus: this.eventBus,
      columns: this.config.columns,
      container,
      onResize: () => {
        if (this.scrollManager && this.layoutEngine) {
          this.scrollManager.updateContentSize(
            this.layoutEngine.totalWidth,
            this.layoutEngine.totalHeight,
          );
        }
        if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
        if (this.renderScheduler) this.renderScheduler.requestRender();
      },
    });
    this.columnResizeManager.attach(this.scrollManager.getElement());

    // Hook column resize end into stretch manager
    this.eventBus.on('columnResizeEnd', (event) => {
      if (this.columnStretchManager) {
        this.columnStretchManager.markManualResize(event.colIndex);
        this.applyColumnStretch();
        if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
        if (this.renderScheduler) this.renderScheduler.requestRender();
      }
    });

    // Create row resize manager for drag-to-resize rows
    this.rowResizeManager = new RowResizeManager({
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      commandManager: this.commandManager,
      eventBus: this.eventBus,
      container,
      onResize: () => {
        if (this.scrollManager && this.layoutEngine) {
          this.scrollManager.updateContentSize(
            this.layoutEngine.totalWidth,
            this.layoutEngine.totalHeight,
          );
        }
        if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
        if (this.renderScheduler) this.renderScheduler.requestRender();
      },
    });
    this.rowResizeManager.attach(this.scrollManager.getElement());

    // Create autofill manager for drag-to-fill
    const visibleCols = this.config.columns.filter((c) => !c.hidden);
    this.autofillManager = new AutofillManager({
      cellStore: this.cellStore,
      dataView: this.dataView,
      selectionManager: this.selectionManager,
      layoutEngine: this.layoutEngine,
      scrollManager: this.scrollManager,
      commandManager: this.commandManager,
      eventBus: this.eventBus,
      dirtyTracker: this.dirtyTracker,
      renderScheduler: this.renderScheduler,
      container,
      rowCount,
      colCount: visibleCols.length,
      mergeManager: this.mergeManager,
    });
    this.autofillManager.attach(this.scrollManager.getElement());

    // Add fill handle layer to render pipeline (after selection overlay)
    this.gridRenderer.addLayer(new FillHandleLayer(this.autofillManager));

    // Add row group toggle layer to render pipeline
    this.gridRenderer.addLayer(new RowGroupToggleLayer(this.rowGroupManager, this.dataView));

    // Observe container resizes to update canvas dimensions
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    // Set up column stretch manager if configured
    if (this.config.stretchColumns) {
      this.columnStretchManager = new ColumnStretchManager(
        { mode: this.config.stretchColumns },
        (updates) => {
          if (!this.layoutEngine || !this.gridRenderer) return;
          this.layoutEngine.setColumnWidthsBatch(updates);
          const geometry = this.gridRenderer.getGeometry();
          for (const [colIndex, width] of updates) {
            geometry.setColumnWidth(colIndex, width);
          }
        },
      );
    }

    // Apply column stretch before first render (needs container width from syncSize)
    this.applyColumnStretch();

    // Initial render
    this.dirtyTracker.markDirty('full');
    this.executeRender();

    this.eventBus.emit('ready');

    // Install any plugins that were registered before mount
    for (const [name, plugin] of this.plugins) {
      const api = this.pluginAPIs.get(name)!;
      plugin.install(api);
    }

    // Start async measurement sweep for off-screen rows
    if (this.autoRowSizeManager) {
      this.startAutoMeasureSweep();

      // Column resize: mark all rows dirty for wrap-enabled columns
      this.eventBus.on('columnResize', (event) => {
        if (!this.autoRowSizeManager) return;
        const col = this.config.columns[event.colIndex];
        if (col?.wrapText) {
          this.autoRowSizeManager.markAllDirty();
          this.startDirtyMeasureSweep();
        }
      });

      // Row manual resize: row now has manual override, auto height is suppressed
      // No action needed — RowStore.setHeight marks it as manual, and
      // measureViewport/startAsyncMeasurement skip manual rows via isManual()
    }
  }

  /**
   * Handle container resize: sync canvas sizes and re-render.
   */
  private handleResize(): void {
    if (!this.mounted || !this.canvasManager) return;

    this.canvasManager.syncSize();

    this.applyColumnStretch();

    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty('full');
    }

    this.executeRender();
  }

  /** Recalculate column stretch distribution based on current container width. */
  private applyColumnStretch(): void {
    if (!this.columnStretchManager || !this.layoutEngine || !this.canvasManager) return;

    const showRowNumbers = this.config.showRowNumbers ?? true;
    const rowNumberWidth = showRowNumbers ? this.currentTheme.dimensions.rowNumberWidth : 0;
    const containerWidth = this.canvasManager.getCssWidth() - rowNumberWidth;

    this.columnStretchManager.recalculate(
      this.config.columns,
      containerWidth,
      this.config.frozenColumns ?? 0,
      (colIndex) => this.layoutEngine!.getColumnWidth(colIndex),
    );
  }

  /** Handle mouse click for selection. */
  private handleGridMouseDown = (event: GridMouseEvent): void => {
    // Ignore right-click for selection (contextmenu handles it)
    if (event.originalEvent.button === 2) return;

    // If editor is open, commit and close before processing the click
    if (this.inlineEditor?.isEditing) {
      this.inlineEditor.commitAndClose('blur');
    }
    // Close overlay editor (date picker, etc.) on grid click
    if (this.activeOverlayEditor?.isOpen) {
      this.activeOverlayEditor.close('blur');
    }

    const { region, row, col, shiftKey, ctrlKey } = event;

    if (region === 'cell') {
      if (shiftKey) {
        this.selectionManager.extendSelection(row, col);
      } else if (ctrlKey) {
        this.selectionManager.addRange(row, col);
      } else {
        this.selectionManager.selectCell(row, col);
      }
      // Start drag selection on cell mousedown
      this._isDraggingSelection = true;
    } else if (region === 'row-number' && row >= 0) {
      this.selectionManager.selectRow(row);
    } else if (region === 'row-group-toggle' && row >= 0) {
      this.handleRowGroupToggle(row);
    } else if (region === 'header-sort-icon' && col >= 0) {
      this.handleHeaderSort(col, event.shiftKey);
    } else if (region === 'header-filter-icon' && col >= 0) {
      const existing = this.filterEngine.getColumnFilters(col);
      const currentOp = existing?.[0]?.operator;
      const currentVal = existing?.[0]?.value != null ? String(existing[0].value) : undefined;
      this.filterPanel?.open(col, currentOp, currentVal);
    } else if (region === 'header' && col >= 0) {
      // Plain header click: no sort, no selection (icons handle actions)
    } else if (region === 'corner') {
      this.selectionManager.selectAll();
    }
  };

  /** Handle mouse move for drag selection. */
  private handleGridMouseMove = (event: GridMouseEvent): void => {
    if (!this._isDraggingSelection) return;
    if (event.region !== 'cell' || event.row < 0 || event.col < 0) return;

    this.selectionManager.extendSelection(event.row, event.col);
    this.scrollCellIntoView(event.row, event.col);
  };

  /** Handle mouse up to end drag selection. */
  private handleGridMouseUp = (_event: GridMouseEvent): void => {
    this._isDraggingSelection = false;
  };

  /** Handle mouse hover for cursor changes on header icons and sub-cell hit zones. */
  private handleGridMouseHover = (event: GridMouseEvent): void => {
    const el = this.scrollManager?.getElement();
    if (!el) return;
    if (
      event.region === 'header-sort-icon' ||
      event.region === 'header-filter-icon' ||
      event.region === 'row-group-toggle'
    ) {
      el.style.cursor = 'pointer';
    } else if (event.hitZoneCursor) {
      el.style.cursor = event.hitZoneCursor;
    } else {
      el.style.cursor = '';
    }
  };

  /** Handle right-click — context menu manager handles this via eventBus subscription. */
  private handleGridContextMenu = (_event: GridMouseEvent): void => {
    // Context menu is handled by ContextMenuManager (subscribed to gridContextMenu).
    // Close filter panel if open.
    this.filterPanel?.close();
  };

  /** Handle keyboard navigation and selection shortcuts. */
  private handleGridKeyDown = (event: GridKeyboardEvent): void => {
    // Don't navigate while editing — the textarea handles its own keyboard events
    if (this.inlineEditor?.isEditing) return;
    // Don't navigate while overlay editor is open
    if (this.activeOverlayEditor?.isOpen) return;

    const keyLower = event.key.toLowerCase();

    // Undo: Ctrl+Z (without Shift)
    if (event.ctrlKey && keyLower === 'z' && !event.shiftKey) {
      event.originalEvent.preventDefault();
      this.handleUndo();
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (
      (event.ctrlKey && keyLower === 'y' && !event.shiftKey) ||
      (event.ctrlKey && keyLower === 'z' && event.shiftKey)
    ) {
      event.originalEvent.preventDefault();
      this.handleRedo();
      return;
    }

    // F2 opens editor on active cell
    if (event.key === 'F2') {
      event.originalEvent.preventDefault();
      const { row, col } = this.selectionManager.getSelection().activeCell;
      this.openCellEditor(row, col);
      return;
    }

    if (!this.keyboardNavigator) return;

    const newCell = this.keyboardNavigator.handleKeyDown(event);
    if (newCell) {
      this.scrollCellIntoView(newCell.row, newCell.col);
      return;
    }

    // Type-to-edit: printable character (not Ctrl+key) opens editor with that character
    // Overlay editors (date picker, etc.) use structured input, not free-text
    if (!event.ctrlKey && event.key.length === 1 && this.inlineEditor) {
      event.originalEvent.preventDefault();
      const { row, col } = this.selectionManager.getSelection().activeCell;
      const visibleCols = this.config.columns.filter((c) => !c.hidden);
      const column = visibleCols[col];
      const physRow = this.dataView.getPhysicalRow(row);
      const cellData = this.cellStore.get(physRow, col);
      const value = cellData?.value ?? null;
      if (column && this.cellEditorRegistry.resolve(column, value)) {
        this.openCellEditor(row, col);
      } else {
        this.inlineEditor.open(row, col, event.key);
      }
    }
  };

  /** Handle double-click to open editor. */
  private handleCellDoubleClick = (event: CellEvent): void => {
    this.openCellEditor(event.row, event.col);
  };

  /** Handle editor close: navigate and refocus based on close reason. */
  private handleEditorClose(reason: EditorCloseReason): void {
    // Refocus scroll container for keyboard events
    if (this.scrollManager) {
      this.scrollManager.getElement().focus();
    }

    const { row, col } = this.selectionManager.getSelection().activeCell;

    // Compute next cell based on reason
    let nextRow = row;
    let nextCol = col;
    switch (reason) {
      case 'enter':
        nextRow = row + 1;
        break;
      case 'shift-enter':
        nextRow = row - 1;
        break;
      case 'tab':
        nextCol = col + 1;
        break;
      case 'shift-tab':
        nextCol = col - 1;
        break;
      default:
        return;
    }

    // Skip over hidden cells in merged regions
    const region = this.mergeManager.getMergedRegion(nextRow, nextCol);
    if (region && (region.startRow !== nextRow || region.startCol !== nextCol)) {
      switch (reason) {
        case 'enter':
          nextRow = region.endRow + 1;
          break;
        case 'shift-enter':
          nextRow = region.startRow - 1;
          break;
        case 'tab':
          nextCol = region.endCol + 1;
          break;
        case 'shift-tab':
          nextCol = region.startCol - 1;
          break;
      }
    }

    this.selectionManager.selectCell(nextRow, nextCol);
    this.scrollCellIntoView(nextRow, nextCol);
  }

  /**
   * Open the appropriate editor for a cell — overlay editor from registry, or InlineEditor fallback.
   */
  private openCellEditor(row: number, col: number): void {
    // Close any active editor first
    if (this.inlineEditor?.isEditing) {
      this.inlineEditor.commitAndClose('programmatic');
    }
    if (this.activeOverlayEditor?.isOpen) {
      this.activeOverlayEditor.close('programmatic');
    }

    const visibleCols = this.config.columns.filter((c) => !c.hidden);
    const column = visibleCols[col];
    if (!column) return;

    const physRow = this.dataView.getPhysicalRow(row);
    const cellData = this.cellStore.get(physRow, col);
    const value = cellData?.value ?? null;

    const editor = this.cellEditorRegistry.resolve(column, value);
    if (editor) {
      if (!this.scrollManager || !this.layoutEngine) return;
      const container = this.scrollManager.getElement().parentElement;
      if (!container) return;

      const context: CellEditorContext = {
        row,
        col,
        value,
        column,
        container,
        scrollContainer: this.scrollManager.getElement(),
        layoutEngine: this.layoutEngine,
        scrollManager: this.scrollManager,
        cellStore: this.cellStore,
        dataView: this.dataView,
        theme: this.currentTheme,
        locale: this.resolvedLocale,
        mergeManager: this.mergeManager,
        frozenRows: this.config.frozenRows ?? 0,
        frozenColumns: this.config.frozenColumns ?? 0,
      };

      const commitFn = (r: number, c: number, oldValue: CellValue, newValue: CellValue) => {
        const pRow = this.dataView.getPhysicalRow(r);
        const command = new CellEditCommand(this.cellStore, pRow, c, oldValue, newValue);
        this.commandManager.execute(command);
        this.eventBus.emit('commandExecute', { description: command.description });

        const vc = this.config.columns.filter((col) => !col.hidden);
        const col2 = vc[c];
        if (col2) {
          this.eventBus.emit('cellChange', {
            row: r,
            col: c,
            value: newValue,
            column: col2,
            oldValue,
            newValue,
            source: 'edit',
          });
        }
        if (this.dirtyTracker) {
          this.dirtyTracker.markCellDirty(r, c);
        }
        if (this.renderScheduler) {
          this.renderScheduler.requestRender();
        }
      };

      const closeFn = (reason: EditorCloseReason) => {
        this.activeOverlayEditor = null;
        this.handleEditorClose(reason);
      };

      this.activeOverlayEditor = editor;
      editor.open(context, commitFn, closeFn);
    } else {
      // Fallback: InlineEditor (textarea)
      this.inlineEditor?.open(row, col);
    }
  }

  /** Undo the last command and trigger re-render. */
  private handleUndo(): void {
    const command = this.commandManager.undo();
    if (command) {
      this.eventBus.emit('commandUndo', { description: command.description });
      this.syncScrollDimensions();
      if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
      if (this.renderScheduler) this.renderScheduler.requestRender();
    }
  }

  /** Redo the last undone command and trigger re-render. */
  private handleRedo(): void {
    const command = this.commandManager.redo();
    if (command) {
      this.eventBus.emit('commandRedo', { description: command.description });
      this.syncScrollDimensions();
      if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
      if (this.renderScheduler) this.renderScheduler.requestRender();
    }
  }

  /** Sync scroll container dimensions with layout engine (after resize/undo). */
  private syncScrollDimensions(): void {
    if (this.scrollManager && this.layoutEngine) {
      this.scrollManager.updateContentSize(
        this.layoutEngine.totalWidth,
        this.layoutEngine.totalHeight,
      );
    }
  }

  /**
   * Scroll the viewport so that the given cell is fully visible.
   * Frozen cells are always visible and don't trigger scrolling on their axis.
   */
  private scrollCellIntoView(row: number, col: number): void {
    if (!this.scrollManager || !this.layoutEngine || !this.canvasManager) return;

    const frozenRows = this.config.frozenRows ?? 0;
    const frozenCols = this.config.frozenColumns ?? 0;

    const scrollX = this.scrollManager.scrollX;
    const scrollY = this.scrollManager.scrollY;
    const viewportWidth = this.canvasManager.getCssWidth();
    const viewportHeight = this.canvasManager.getCssHeight();

    const { headerHeight, rowNumberWidth } = this.layoutEngine;

    let newScrollY = scrollY;
    let newScrollX = scrollX;

    // Vertical: skip if cell is in frozen rows (always visible)
    if (row >= frozenRows) {
      const frozenH = frozenRows > 0 ? this.layoutEngine.getFrozenRowsHeight(frozenRows) : 0;
      const cellTop = this.layoutEngine.getRowY(row);
      const cellBottom = cellTop + this.layoutEngine.getRowHeight(row);
      // Scrollable area starts after frozen rows
      const visibleTop = scrollY + frozenH;
      const visibleBottom = scrollY + (viewportHeight - headerHeight);

      if (cellTop < visibleTop) {
        newScrollY = cellTop - frozenH;
      } else if (cellBottom > visibleBottom) {
        newScrollY = cellBottom - (viewportHeight - headerHeight);
      }
    }

    // Horizontal: skip if cell is in frozen columns (always visible)
    if (col >= frozenCols) {
      const frozenW = frozenCols > 0 ? this.layoutEngine.getFrozenColsWidth(frozenCols) : 0;
      const colX = this.layoutEngine.getColumnX(col);
      const colW = this.layoutEngine.getColumnWidth(col);
      const cellLeft = colX;
      const cellRight = colX + colW;
      // Scrollable area starts after frozen columns
      const visibleLeft = scrollX + frozenW;
      const visibleRight = scrollX + (viewportWidth - rowNumberWidth);

      if (cellLeft < visibleLeft) {
        newScrollX = cellLeft - frozenW;
      } else if (cellRight > visibleRight) {
        newScrollX = cellRight - (viewportWidth - rowNumberWidth);
      }
    }

    if (newScrollX !== scrollX || newScrollY !== scrollY) {
      this.scrollManager.scrollTo(newScrollX, newScrollY);
    }
  }

  /** Run validation on cells affected by a command. */
  private runValidationAfterCommand(command: Command): void {
    if (!('affectedCells' in command)) return;
    const cells = (command as { affectedCells: ReadonlyArray<{ row: number; col: number }> })
      .affectedCells;
    for (const { row, col } of cells) {
      if (this.validationEngine.hasRules(row, col)) {
        this.validationEngine.validateCell(row, col);
      }
    }
  }

  destroy(): void {
    // Destroy plugins in reverse installation order
    const pluginNames = Array.from(this.plugins.keys()).reverse();
    for (const name of pluginNames) {
      const plugin = this.plugins.get(name)!;
      plugin.destroy?.();
      const api = this.pluginAPIs.get(name);
      api?.clearState();
    }
    this.plugins.clear();
    this.pluginAPIs.clear();

    this.commandManager.clear();
    this.eventBus.emit('destroy');

    // Destroy auto row size manager
    if (this.autoRowSizeManager) {
      this.autoRowSizeManager.destroy();
      this.autoRowSizeManager = null;
    }

    if (this.columnStretchManager) {
      this.columnStretchManager.destroy();
      this.columnStretchManager = null;
    }

    // Destroy clipboard manager
    if (this.clipboardManager) {
      this.clipboardManager.detach();
      this.clipboardManager = null;
    }

    // Destroy context menu manager
    if (this.contextMenuManager) {
      this.contextMenuManager.destroy();
      this.contextMenuManager = null;
    }

    // Destroy ARIA manager
    if (this.ariaManager) {
      this.ariaManager.detach();
      this.ariaManager = null;
    }

    // Destroy print manager
    if (this.printManager) {
      this.printManager.detach();
      this.printManager = null;
    }

    // Destroy column resize manager
    if (this.columnResizeManager) {
      this.columnResizeManager.detach();
      this.columnResizeManager = null;
    }

    // Destroy row resize manager
    if (this.rowResizeManager) {
      this.rowResizeManager.detach();
      this.rowResizeManager = null;
    }

    // Destroy tooltip manager
    if (this.tooltipManager) {
      this.tooltipManager.destroy();
      this.tooltipManager = null;
    }

    // Destroy autofill manager
    if (this.autofillManager) {
      this.autofillManager.detach();
      this.autofillManager = null;
    }

    // Destroy inline editor
    if (this.inlineEditor) {
      this.inlineEditor.destroy();
      this.inlineEditor = null;
    }

    // Destroy cell editor registry (all registered editors)
    this.cellEditorRegistry.destroy();
    this.activeOverlayEditor = null;

    // Destroy filter panel
    if (this.filterPanel) {
      this.filterPanel.destroy();
      this.filterPanel = null;
    }

    // Unsubscribe event handlers
    this.eventBus.off('gridMouseDown', this.handleGridMouseDown);
    this.eventBus.off('gridMouseMove', this.handleGridMouseMove);
    this.eventBus.off('gridMouseUp', this.handleGridMouseUp);
    this.eventBus.off('gridKeyDown', this.handleGridKeyDown);
    this.eventBus.off('cellDoubleClick', this.handleCellDoubleClick);
    this.eventBus.off('gridContextMenu', this.handleGridContextMenu);

    if (this.eventTranslator) {
      this.eventTranslator.detach();
      this.eventTranslator = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.renderScheduler) {
      this.renderScheduler.cancel();
      this.renderScheduler = null;
    }
    if (this.scrollManager) {
      this.scrollManager.destroy();
      this.scrollManager = null;
    }
    if (this.canvasManager) {
      this.canvasManager.destroy();
      this.canvasManager = null;
    }
    this.gridRenderer = null;
    this.layoutEngine = null;
    this.viewportManager = null;
    this.dirtyTracker = null;
    this.keyboardNavigator = null;
    this.eventBus.destroy();
    this.mounted = false;
  }

  // Data API
  getCell(row: number, col: number): CellData | undefined {
    return this.cellStore.get(this.dataView.getPhysicalRow(row), col);
  }

  setCell(row: number, col: number, value: CellValue): void {
    this.cellStore.setValue(this.dataView.getPhysicalRow(row), col, value);
    if (this.dirtyTracker) {
      this.dirtyTracker.markCellDirty(row, col);
    }
    // Mark row dirty for auto row height re-measurement
    if (this.autoRowSizeManager) {
      this.autoRowSizeManager.markDirtyRows([row]);
    }
    if (this.renderScheduler) {
      this.renderScheduler.requestRender();
    }
  }

  getCellStore(): CellStore {
    return this.cellStore;
  }

  /**
   * Bulk load complete CellData objects from a 2D array.
   * Position `[i][j]` maps to row `(startRow + i)`, column `j`.
   * Stores value, type, style, metadata, and custom fields in one pass.
   * Null/undefined entries are skipped (sparse data supported).
   *
   * @param data - 2D array of CellData objects (rows × columns)
   * @param startRow - Row offset for the first row of data (default: 0)
   */
  bulkLoadCellData(
    data: ReadonlyArray<ReadonlyArray<CellData | null | undefined>>,
    startRow = 0,
  ): void {
    this.cellStore.bulkLoadCellData(data, startRow);
    if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
    if (this.autoRowSizeManager) {
      const rows: number[] = [];
      for (let i = 0; i < data.length; i++) {
        rows.push(startRow + i);
      }
      this.autoRowSizeManager.markDirtyRows(rows);
    }
    if (this.renderScheduler) this.renderScheduler.requestRender();
  }

  getRowStore(): RowStore {
    return this.rowStore;
  }

  /**
   * Set the height of a specific row. Updates layout and triggers re-render.
   */
  setRowHeight(row: number, height: number): void {
    this.rowStore.setHeight(row, height);
    if (this.layoutEngine) {
      this.layoutEngine.setRowHeight(row, height);
    }
    this.syncScrollDimensions();
    if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
    if (this.renderScheduler) this.renderScheduler.requestRender();
  }

  /**
   * Set auto-measured row heights in batch. Only updates rows without manual overrides.
   * Uses batch layout update for O(n) instead of O(n²) position recomputation.
   * Applies scroll compensation when heights change above the viewport.
   */
  setAutoRowHeights(updates: Map<number, number>): void {
    const changed = this.rowStore.setAutoHeightsBatch(updates, this.layoutEngine?.rowHeight ?? 28);
    if (changed.size === 0) return;

    // Scroll compensation: record position of top visible row before layout change
    const scrollY = this.scrollManager?.scrollY ?? 0;
    let anchorRow = -1;
    let anchorOldY = 0;
    if (this.layoutEngine && this.viewportManager && scrollY > 0) {
      anchorRow = this.layoutEngine.getRowAtY(scrollY);
      if (anchorRow >= 0) {
        anchorOldY = this.layoutEngine.getRowY(anchorRow);
      }
    }

    if (this.layoutEngine) {
      // Build layout updates from changed rows (effective heights)
      const layoutUpdates = new Map<number, number>();
      for (const row of changed) {
        layoutUpdates.set(row, this.rowStore.getHeight(row, this.layoutEngine.rowHeight));
      }
      this.layoutEngine.setRowHeightsBatch(layoutUpdates);
    }
    this.syncScrollDimensions();

    // Scroll compensation: adjust scroll position if anchor row shifted
    if (anchorRow >= 0 && this.layoutEngine && this.scrollManager) {
      const anchorNewY = this.layoutEngine.getRowY(anchorRow);
      const delta = anchorNewY - anchorOldY;
      if (Math.abs(delta) > 0.5) {
        this.scrollManager.scrollTo(this.scrollManager.scrollX, scrollY + delta);
      }
    }

    if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
    if (this.renderScheduler) this.renderScheduler.requestRender();
  }

  /**
   * Start async row height measurement sweep for all off-screen rows.
   * Uses requestIdleCallback to avoid blocking the main thread.
   */
  private startAutoMeasureSweep(): void {
    if (!this.autoRowSizeManager || !this.gridRenderer || !this.layoutEngine) return;

    const totalRows = this.layoutEngine.rowCount;
    this.autoRowSizeManager.startAsyncMeasurement(
      totalRows,
      this.buildAutoMeasureContext(),
      this.rowStore,
    );
  }

  /**
   * Start async measurement only for dirty rows.
   * More efficient than full sweep when a few rows changed (e.g. cell edit).
   */
  private startDirtyMeasureSweep(): void {
    if (!this.autoRowSizeManager || !this.gridRenderer || !this.layoutEngine) return;

    if (this.autoRowSizeManager.isAllDirty) {
      // Full sweep needed (e.g. theme/font change)
      this.startAutoMeasureSweep();
      return;
    }

    if (!this.autoRowSizeManager.hasDirtyRows) return;

    this.autoRowSizeManager.startDirtyMeasurement(this.buildAutoMeasureContext(), this.rowStore);
  }

  /** Build a RenderContext factory for auto row height measurement. */
  private buildAutoMeasureContext(): (
    startRow: number,
    endRow: number,
  ) => import('../renderer/render-layer').RenderContext | null {
    const geometry = this.gridRenderer!.getGeometry();
    const visibleColCount = this.config.columns.filter((c) => !c.hidden).length;

    return (startRow: number, endRow: number) => {
      if (!this.canvasManager || !this.gridRenderer) return null;
      const ctx = this.canvasManager.getContext();
      const viewport: import('../renderer/viewport-manager').ViewportRange = {
        startRow,
        endRow,
        startCol: 0,
        endCol: visibleColCount - 1,
        visibleRowCount: endRow - startRow + 1,
        visibleColCount,
      };
      return {
        ctx,
        geometry,
        theme: this.currentTheme,
        canvasWidth: this.canvasManager.getCssWidth(),
        canvasHeight: this.canvasManager.getCssHeight(),
        viewport,
        scrollX: 0,
        scrollY: 0,
        renderMode: 'full' as import('../renderer/render-layer').RenderMode,
        paneRegion: 'full' as import('../renderer/render-layer').PaneRegion,
        mergeManager: this.mergeManager,
      };
    };
  }

  /**
   * Notify auto row size manager that specific rows need re-measurement.
   * Triggers async dirty measurement if auto row height is enabled.
   */
  markAutoRowHeightDirty(rows: number[]): void {
    if (!this.autoRowSizeManager || rows.length === 0) return;
    this.autoRowSizeManager.markDirtyRows(rows);
    this.startDirtyMeasureSweep();
  }

  /**
   * Notify auto row size manager that all rows need re-measurement.
   * Used for theme/font changes that affect all row heights.
   */
  markAllAutoRowHeightDirty(): void {
    if (!this.autoRowSizeManager) return;
    this.autoRowSizeManager.markAllDirty();
    this.startAutoMeasureSweep();
  }

  /** Get the auto row size manager instance (null if autoRowHeight is disabled). */
  getAutoRowSizeManager(): AutoRowSizeManager | null {
    return this.autoRowSizeManager;
  }

  // Command API
  getCommandManager(): CommandManager {
    return this.commandManager;
  }

  // Selection API
  getSelection(): Selection {
    return this.selectionManager.getSelection();
  }

  selectCell(row: number, col: number): void {
    this.selectionManager.selectCell(row, col);
  }

  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  getKeyboardNavigator(): KeyboardNavigator | null {
    return this.keyboardNavigator;
  }

  // Resize API
  resize(): void {
    this.handleResize();
  }

  // Scroll API
  scrollTo(x: number, y: number): void {
    if (this.scrollManager) {
      this.scrollManager.scrollTo(x, y);
    }
  }

  getVisibleRange(): CellRange {
    if (!this.viewportManager || !this.canvasManager) {
      return { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    }

    const scrollX = this.scrollManager?.scrollX ?? 0;
    const scrollY = this.scrollManager?.scrollY ?? 0;

    const range = this.viewportManager.computeVisibleRange(
      scrollX,
      scrollY,
      this.canvasManager.getCssWidth(),
      this.canvasManager.getCssHeight(),
    );

    return {
      startRow: range.startRow,
      startCol: range.startCol,
      endRow: range.endRow,
      endCol: range.endCol,
    };
  }

  /**
   * Request a render on the next animation frame.
   * Multiple calls are coalesced into a single render.
   */
  render(): void {
    if (!this.mounted) return;

    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty('full');
    }

    if (this.renderScheduler) {
      this.renderScheduler.requestRender();
    } else {
      this.executeRender();
    }
  }

  /**
   * Execute the actual render. Called by RenderScheduler or directly.
   */
  private executeRender(): void {
    if (!this.mounted || !this.canvasManager || !this.gridRenderer || !this.viewportManager) return;

    // Flush dirty cells before flushing regions (flushCells reads region state)
    let dirtyCells: import('../renderer/dirty-tracker').DirtyCell[] | null = null;
    if (this.dirtyTracker) {
      dirtyCells = this.dirtyTracker.flushCells();
      const dirtyRegions = this.dirtyTracker.flush();
      if (dirtyRegions.has('full') || dirtyRegions.has('cell-update')) {
        this.gridRenderer.invalidateFrozenCache();
      }
    }

    const width = this.canvasManager.getCssWidth();
    const height = this.canvasManager.getCssHeight();

    // Get current scroll position
    const scrollX = this.scrollManager?.scrollX ?? 0;
    const scrollY = this.scrollManager?.scrollY ?? 0;

    // Compute visible cell range from actual scroll position
    const viewport = this.viewportManager.computeVisibleRange(scrollX, scrollY, width, height);

    // Always render in full mode (ScrollVelocityTracker removed — benchmark showed <0.3% FPS difference)
    const renderMode: RenderMode = 'full';

    // Set frozen pane config if applicable
    const frozenRows = this.config.frozenRows ?? 0;
    const frozenColumns = this.config.frozenColumns ?? 0;

    if ((frozenRows > 0 || frozenColumns > 0) && this.layoutEngine) {
      const frozenRanges = this.viewportManager.computeFrozenRanges(
        scrollX,
        scrollY,
        width,
        height,
        frozenRows,
        frozenColumns,
      );
      this.gridRenderer.setFrozenConfig({
        frozenRows,
        frozenColumns,
        layoutEngine: this.layoutEngine,
        frozenRanges,
      });
    } else {
      this.gridRenderer.setFrozenConfig(undefined);
    }

    // Pass single canvas context
    const ctx = this.canvasManager.getContext();

    // Partial render if only specific cells changed (no scroll/resize/theme)
    if (dirtyCells && this.gridRenderer) {
      const dirtyRects = this.computeDirtyRects(dirtyCells, scrollX, scrollY);
      if (dirtyRects.length > 0) {
        this.gridRenderer.renderPartial(
          ctx,
          viewport,
          width,
          height,
          scrollX,
          scrollY,
          dirtyRects,
          renderMode,
        );
        return;
      }
    }

    this.gridRenderer.render(ctx, viewport, width, height, scrollX, scrollY, renderMode);

    // Post-render: measure visible rows for auto row height
    this.autoMeasureViewport(ctx, viewport, width, height, scrollX, scrollY);
  }

  /**
   * Measure visible row heights after render and apply auto heights.
   * Uses a guard flag to prevent infinite measure→render→measure loops.
   */
  private autoMeasureViewport(
    ctx: CanvasRenderingContext2D,
    viewport: import('../renderer/viewport-manager').ViewportRange,
    canvasWidth: number,
    canvasHeight: number,
    scrollX: number,
    scrollY: number,
  ): void {
    if (!this.autoRowSizeManager || this._inAutoMeasure || !this.gridRenderer) return;

    this._inAutoMeasure = true;
    try {
      const geometry = this.gridRenderer.getGeometry();
      const rc: import('../renderer/render-layer').RenderContext = {
        ctx,
        geometry,
        theme: this.currentTheme,
        canvasWidth,
        canvasHeight,
        viewport,
        scrollX,
        scrollY,
        renderMode: 'full',
        paneRegion: 'full',
        mergeManager: this.mergeManager,
      };
      this.autoRowSizeManager.measureViewport(rc, this.rowStore);
    } finally {
      this._inAutoMeasure = false;
    }
  }

  /**
   * Convert dirty cell coordinates to pixel rectangles for partial rendering.
   * Each cell rect includes 1px padding for grid lines on all sides.
   */
  private computeDirtyRects(
    cells: import('../renderer/dirty-tracker').DirtyCell[],
    scrollX: number,
    scrollY: number,
  ): DirtyRect[] {
    if (!this.gridRenderer) return [];

    const geometry = this.gridRenderer.getGeometry();
    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;
    const colRects = geometry.computeColumnRects();
    const rects: DirtyRect[] = [];

    for (const { row, col } of cells) {
      if (col < 0 || col >= colRects.length) continue;

      const cr = colRects[col];
      const rowY = geometry.getRowY(row);
      const rowH = geometry.getRowHeight(row);

      // Compute pixel position with scroll offset, padded by 1px for grid lines
      const x = Math.max(rnWidth, cr.x - scrollX - 1);
      const y = Math.max(headerHeight, headerHeight + rowY - scrollY - 1);
      const right = cr.x + cr.width - scrollX + 1;
      const bottom = headerHeight + rowY + rowH - scrollY + 1;

      if (right <= rnWidth || bottom <= headerHeight) continue; // off-screen
      rects.push({ x, y, width: right - x, height: bottom - y });
    }

    return rects;
  }

  // Event API
  on<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventBus.on(event, handler);
  }

  off<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventBus.off(event, handler);
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getConfig(): SpreadsheetEngineConfig {
    return this.config;
  }

  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvasManager?.getCanvas() ?? null;
  }

  getLayoutEngine(): LayoutEngine | null {
    return this.layoutEngine;
  }

  getViewportManager(): ViewportManager | null {
    return this.viewportManager;
  }

  getDirtyTracker(): DirtyTracker | null {
    return this.dirtyTracker;
  }

  getScrollManager(): ScrollManager | null {
    return this.scrollManager;
  }

  getInlineEditor(): InlineEditor | null {
    return this.inlineEditor;
  }

  // Change Tracking API

  /**
   * Set cell status externally (for saving/saved transitions during persistence).
   */
  setCellStatus(
    row: number,
    col: number,
    status: CellMetadata['status'],
    errorMessage?: string,
  ): void {
    const physRow = this.dataView.getPhysicalRow(row);
    this.changeTracker.setCellStatus(physRow, col, status, errorMessage);
    if (this.dirtyTracker) this.dirtyTracker.markCellDirty(row, col);
    if (this.renderScheduler) this.renderScheduler.requestRender();
  }

  /** Get current status of a cell. */
  getCellStatus(row: number, col: number): CellMetadata['status'] | undefined {
    return this.changeTracker.getCellStatus(this.dataView.getPhysicalRow(row), col);
  }

  /** Get all cells currently marked as changed. */
  getChangedCells(): Array<{ row: number; col: number }> {
    return this.changeTracker.getChangedCells();
  }

  /** Clear all change tracking (call after save). */
  clearChanges(): void {
    this.changeTracker.clearChanges();
    if (this.dirtyTracker) this.dirtyTracker.markDirty('full');
    if (this.renderScheduler) this.renderScheduler.requestRender();
  }

  /** Get the change tracker instance. */
  getChangeTracker(): ChangeTracker {
    return this.changeTracker;
  }

  // Validation API

  /** Set validation rules for an entire column. */
  setColumnValidation(col: number, rules: SpreadsheetValidationRule[]): void {
    this.validationEngine.setColumnRules(col, rules);
  }

  /** Set validation rules for a specific cell. */
  setCellValidation(row: number, col: number, rules: SpreadsheetValidationRule[]): void {
    this.validationEngine.setCellRules(this.dataView.getPhysicalRow(row), col, rules);
  }

  /** Remove validation rules for a column. */
  removeColumnValidation(col: number): void {
    this.validationEngine.removeColumnRules(col);
  }

  /** Remove validation rules for a specific cell. */
  removeCellValidation(row: number, col: number): void {
    this.validationEngine.removeCellRules(this.dataView.getPhysicalRow(row), col);
  }

  /** Get the validation engine instance. */
  getValidationEngine(): ValidationEngine {
    return this.validationEngine;
  }

  /** Get the data view for logical↔physical row mapping. */
  getDataView(): DataView {
    return this.dataView;
  }

  // --- Sort API ---

  /** Handle header click sort toggle. */
  private handleHeaderSort(col: number, multiColumn: boolean): void {
    const visibleCols = this.config.columns.filter((c) => !c.hidden);
    const colDef = visibleCols[col];
    if (colDef && colDef.sortable === false) return;

    if (this.mergeManager.hasAnyRegions()) {
      this.eventBus.emit('sortRejected', { reason: 'merged-regions-exist' });
      return;
    }

    this.sortEngine.toggleColumn(col, multiColumn);
    this.applyFilterAndSortToDataView();

    this.eventBus.emit('sortChange', { sortColumns: this.sortEngine.sortColumns });

    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Apply filter + sort + row groups pipeline to DataView. Filter first, then sort, then hide collapsed. */
  private applyFilterAndSortToDataView(): void {
    const filtered = this.filterEngine.computeVisibleRows();
    const sorted = this.sortEngine.computeSortedIndices(filtered ?? undefined);

    let indices = sorted ?? filtered;

    // Apply row group collapse filtering
    if (indices && this.rowGroupManager.hasGroups()) {
      indices = this.rowGroupManager.filterCollapsed(indices);
    } else if (!indices && this.rowGroupManager.hasGroups()) {
      // No filter/sort but groups exist — create identity indices, then filter
      const total = this.dataView.totalRowCount;
      const identity: number[] = [];
      for (let i = 0; i < total; i++) identity.push(i);
      indices = this.rowGroupManager.filterCollapsed(identity);
    }

    if (indices) {
      this.dataView.recompute(indices);
    } else {
      this.dataView.reset();
    }

    // Update header sort indicators
    const sortState = new Map<number, SortDirection>();
    for (const sc of this.sortEngine.sortColumns) {
      sortState.set(sc.col, sc.direction);
    }
    this.gridRenderer?.setSortState(sortState);

    // Update header filter indicators
    this.gridRenderer?.setFilterState(this.filterEngine.getFilteredColumns());

    // Update selection bounds for visible row count (after all pipeline stages)
    const visibleRows = this.dataView.visibleRowCount;
    this.selectionManager?.setRowCount(visibleRows);

    // Update layout and scroll dimensions for visible row count
    if (this.layoutEngine) {
      this.layoutEngine.setRowCount(visibleRows);
      this.scrollManager?.updateContentSize(
        this.layoutEngine.totalWidth,
        this.layoutEngine.totalHeight,
      );
    }
  }

  /** Sort by columns programmatically. */
  sortBy(columns: SortColumn[]): void {
    if (this.mergeManager.hasAnyRegions()) {
      this.eventBus.emit('sortRejected', { reason: 'merged-regions-exist' });
      return;
    }
    this.sortEngine.setSortColumns(columns);
    this.applyFilterAndSortToDataView();
    this.eventBus.emit('sortChange', { sortColumns: this.sortEngine.sortColumns });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Clear all sorting. */
  clearSort(): void {
    this.sortEngine.clearSort();
    this.applyFilterAndSortToDataView();
    this.eventBus.emit('sortChange', { sortColumns: [] });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Get current sort columns. */
  getSortColumns(): readonly SortColumn[] {
    return this.sortEngine.sortColumns;
  }

  /** Get the sort engine instance. */
  getSortEngine(): SortEngine {
    return this.sortEngine;
  }

  // ─── Filter API ────────────────────────────────────────────

  /** Set filter conditions for a column. Replaces any existing conditions. */
  setColumnFilter(col: number, conditions: FilterCondition[]): void {
    this.filterEngine.setColumnFilter(col, conditions);
    this.applyFilterAndSortToDataView();
    this.emitFilterChange();
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Remove filter from a specific column. */
  removeColumnFilter(col: number): void {
    this.filterEngine.removeColumnFilter(col);
    this.applyFilterAndSortToDataView();
    this.emitFilterChange();
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Clear all filters. */
  clearFilters(): void {
    this.filterEngine.clearFilters();
    this.applyFilterAndSortToDataView();
    this.emitFilterChange();
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Get count of visible (non-filtered) rows. */
  getFilteredRowCount(): number {
    return this.filterEngine.getVisibleRowCount();
  }

  /** Get the filter engine instance. */
  getFilterEngine(): FilterEngine {
    return this.filterEngine;
  }

  /** Open the filter panel for a column. */
  openFilterPanel(col: number): void {
    const existing = this.filterEngine.getColumnFilters(col);
    const currentOp = existing?.[0]?.operator;
    const currentVal = existing?.[0]?.value != null ? String(existing[0].value) : undefined;
    this.filterPanel?.open(col, currentOp, currentVal);
  }

  /** Close the filter panel if open. */
  closeFilterPanel(): void {
    this.filterPanel?.close();
  }

  /** Whether the filter panel is currently open. */
  get isFilterPanelOpen(): boolean {
    return this.filterPanel?.isOpen ?? false;
  }

  private emitFilterChange(): void {
    const totalRowCount = this.filterEngine.totalRowCount;
    const visibleRowCount = this.filterEngine.getVisibleRowCount();
    this.eventBus.emit('filterChange', { visibleRowCount, totalRowCount });
  }

  // ─── Merge API ─────────────────────────────────────────────

  /** Merge cells in the given region. Optionally set anchor cell value. Returns false if invalid. */
  mergeCells(region: MergedRegion, value?: CellValue): boolean {
    const frozenRows = this.config.frozenRows ?? 0;
    const frozenCols = this.config.frozenColumns ?? 0;
    const error = this.mergeManager.validateMerge(region, frozenRows, frozenCols);
    if (error) return false;

    const cmd = new MergeCellsCommand(this.mergeManager, this.cellStore, region, value);
    this.commandManager.execute(cmd);
    this.eventBus.emit('commandExecute', { description: cmd.description });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
    return true;
  }

  /** Unmerge cells starting at the given anchor. Returns false if no merge found. */
  unmergeCells(startRow: number, startCol: number): boolean {
    const existing = this.mergeManager.getMergedRegion(startRow, startCol);
    if (!existing) return false;

    const cmd = new UnmergeCellsCommand(this.mergeManager, this.cellStore, existing);
    this.commandManager.execute(cmd);
    this.eventBus.emit('commandExecute', { description: cmd.description });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
    return true;
  }

  /** Get the merged region containing the given cell, or null. */
  getMergedRegion(row: number, col: number): MergedRegion | null {
    return this.mergeManager.getMergedRegion(row, col);
  }

  /** Get the MergeManager instance. */
  getMergeManager(): MergeManager {
    return this.mergeManager;
  }

  // ─── Row Group API ────────────────────────────────────────

  /** Define row groups. Replaces all existing groups. Triggers DataView recomputation. */
  setRowGroups(groups: RowGroupDef[]): void {
    this.rowGroupManager.setGroups(groups);
    this.applyFilterAndSortToDataView();
    this.markAllAutoRowHeightDirty();
    this.eventBus.emit('rowGroupChange', { groupHeaders: this.rowGroupManager.getGroupHeaders() });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Toggle expand/collapse for a group by logical row index. */
  toggleRowGroup(logicalRow: number): void {
    const physRow = this.dataView.getPhysicalRow(logicalRow);
    this.handleRowGroupToggle(logicalRow, physRow);
  }

  /** Expand all row groups. */
  expandAllGroups(): void {
    this.rowGroupManager.expandAll();
    this.applyFilterAndSortToDataView();
    this.markAllAutoRowHeightDirty();
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Collapse all row groups. */
  collapseAllGroups(): void {
    this.rowGroupManager.collapseAll();
    this.applyFilterAndSortToDataView();
    this.markAllAutoRowHeightDirty();
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Clear all row groups. */
  clearRowGroups(): void {
    this.rowGroupManager.clear();
    this.applyFilterAndSortToDataView();
    this.markAllAutoRowHeightDirty();
    this.eventBus.emit('rowGroupChange', { groupHeaders: [] });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Set aggregate functions for group headers. */
  setGroupAggregates(aggregates: ColumnAggregate[]): void {
    this.rowGroupManager.setAggregates(aggregates);
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  /** Get the RowGroupManager instance. */
  getRowGroupManager(): RowGroupManager {
    return this.rowGroupManager;
  }

  /** Get the CellTypeRegistry instance for registering custom cell types. */
  getCellTypeRegistry(): CellTypeRegistry {
    return this.cellTypeRegistry;
  }

  /** Handle row group toggle by logical row (from hit-test). */
  private handleRowGroupToggle(logicalRow: number, physRow?: number): void {
    const phys = physRow ?? this.dataView.getPhysicalRow(logicalRow);
    if (!this.rowGroupManager.isGroupHeader(phys)) return;
    const expanded = this.rowGroupManager.toggleGroup(phys);
    this.applyFilterAndSortToDataView();
    this.markAllAutoRowHeightDirty();
    this.eventBus.emit('rowGroupToggle', { headerRow: phys, expanded });
    this.dirtyTracker?.markDirty('full');
    this.renderScheduler?.requestRender();
  }

  // ─── Clipboard API ─────────────────────────────────────────

  /** Get the ClipboardManager instance. */
  getClipboardManager(): ClipboardManager | null {
    return this.clipboardManager;
  }

  // ─── Context Menu API ──────────────────────────────────────

  /** Get the ContextMenuManager instance. */
  getContextMenuManager(): ContextMenuManager | null {
    return this.contextMenuManager;
  }

  /** Register a context menu item. */
  registerContextMenuItem(item: ContextMenuItem): void {
    this.contextMenuManager?.registerItem(item);
  }

  /** Unregister a context menu item by id. */
  unregisterContextMenuItem(id: string): void {
    this.contextMenuManager?.unregisterItem(id);
  }

  /** Add a render layer to the pipeline (appended after existing layers). */
  addRenderLayer(layer: import('../renderer/render-layer').RenderLayer, _target?: string): void {
    this.gridRenderer?.addLayer(layer);
  }

  /** Insert a render layer before an existing layer in the pipeline. */
  insertRenderLayerBefore(
    layer: import('../renderer/render-layer').RenderLayer,
    beforeLayer: import('../renderer/render-layer').RenderLayer,
  ): void {
    this.gridRenderer?.insertLayerBefore(layer, beforeLayer);
  }

  /** Get a render layer by constructor type from the pipeline. */
  getRenderLayer<T extends import('../renderer/render-layer').RenderLayer>(
    layerClass: new (...args: unknown[]) => T,
  ): T | undefined {
    return this.gridRenderer?.getLayer(layerClass);
  }

  /** Remove a render layer from the pipeline. */
  removeRenderLayer(layer: import('../renderer/render-layer').RenderLayer): void {
    this.gridRenderer?.removeLayer(layer);
  }

  /** Request a re-render on the next animation frame. */
  requestRender(): void {
    if (this.renderScheduler) {
      this.dirtyTracker?.markDirty('full');
      this.renderScheduler.requestRender();
    }
  }

  /** Get the merge manager for reading merged regions. */

  // ─── Theme API ─────────────────────────────────────────────

  /** Get the current theme. */
  getTheme(): SpreadsheetTheme {
    return this.currentTheme;
  }

  /** Switch theme at runtime. Propagates to all subsystems and triggers full re-render. */
  setTheme(theme: SpreadsheetTheme): void {
    this.currentTheme = theme;
    this.config = { ...this.config, theme };

    // Propagate to canvas rendering subsystems
    this.gridRenderer?.setTheme(theme);

    // Propagate to DOM overlay subsystems
    this.inlineEditor?.setTheme(theme);
    this.cellEditorRegistry.setTheme(theme);
    this.filterPanel?.setTheme(theme);
    this.contextMenuManager?.setTheme(theme);
    this.tooltipManager?.setTheme(theme);

    // Notify plugins of theme change
    this.eventBus.emit('themeChange', { theme });

    // Theme/font change affects all row heights
    this.markAllAutoRowHeightDirty();

    // Trigger full re-render
    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty('full');
    }
    if (this.renderScheduler) {
      this.renderScheduler.requestRender();
    }
  }

  /** Get the resolved locale (English defaults merged with user-provided locale). */
  getLocale(): ResolvedLocale {
    return this.resolvedLocale;
  }

  /**
   * Get the CellEditorRegistry for registering custom overlay editors.
   * Call before mount() to register editors, or after — editors registered
   * after mount() will be available on next cell open.
   */
  getCellEditorRegistry(): CellEditorRegistry {
    return this.cellEditorRegistry;
  }

  /**
   * Convenience: register a CellEditor for a column type string.
   * Equivalent to getCellEditorRegistry().registerForType(editor, type, priority).
   */
  registerCellEditor(editor: CellEditor, type: string, priority = 0): void {
    this.cellEditorRegistry.registerForType(editor, type, priority);
  }

  /** Switch locale at runtime. Propagates to subsystems that use locale strings. */
  setLocale(locale: SpreadsheetLocale): void {
    this.resolvedLocale = resolveLocale(locale);
    this.config = { ...this.config, locale };

    // Propagate to subsystems
    this.contextMenuManager?.setLocale(this.resolvedLocale);
    this.cellEditorRegistry.setLocale(this.resolvedLocale);
    this.filterPanel?.setLocale(this.resolvedLocale);
    this.gridRenderer?.setLocale(this.resolvedLocale);
    this.rowGroupManager.setLocale(this.resolvedLocale);
    this.ariaManager?.setLocale(this.resolvedLocale);
    this.printManager?.setLocale(this.resolvedLocale);
    if (this.resolvedLocale.formatLocale) {
      this.cellTypeRegistry.setFormatLocale(this.resolvedLocale.formatLocale);
    }

    // Re-render to apply any canvas-drawn locale strings
    if (this.dirtyTracker) {
      this.dirtyTracker.markDirty('full');
    }
    if (this.renderScheduler) {
      this.renderScheduler.requestRender();
    }
  }

  // ─── Plugin API ────────────────────────────────────────────

  /**
   * Install a plugin. Resolves dependencies (all must be installed first).
   * If engine is mounted, calls plugin.install() immediately.
   * If not mounted, install() will be called during mount().
   */
  installPlugin(plugin: SpreadsheetPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already installed`);
    }

    // Verify dependencies are installed
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin "${plugin.name}" requires "${dep}" which is not installed`);
        }
      }
    }

    const api = new SpreadsheetPluginAPI(this);
    this.plugins.set(plugin.name, plugin);
    this.pluginAPIs.set(plugin.name, api);

    // If engine is already mounted, install immediately
    if (this.mounted) {
      plugin.install(api);
    }
  }

  /** Remove a plugin by name. Calls plugin.destroy() if defined. */
  removePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    // Check no other plugin depends on this one
    for (const [otherName, other] of this.plugins) {
      if (otherName !== name && other.dependencies?.includes(name)) {
        throw new Error(`Cannot remove plugin "${name}": "${otherName}" depends on it`);
      }
    }

    plugin.destroy?.();
    const api = this.pluginAPIs.get(name);
    api?.clearState();
    this.plugins.delete(name);
    this.pluginAPIs.delete(name);
  }

  /** Get an installed plugin by name. */
  getPlugin(name: string): SpreadsheetPlugin | undefined {
    return this.plugins.get(name);
  }

  /** Get all installed plugin names. */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** Trigger print: generates a DOM table and opens the print dialog. */
  print(): void {
    if (this.printManager) {
      this.printManager.print();
    }
  }

  /** Get current total row count. */
  getRowCount(): number {
    return this.dataView.totalRowCount;
  }

  /** Update row count across all subsystems. */
  setRowCount(count: number): void {
    this.dataView.setTotalRowCount(count);
    this.sortEngine.setTotalRowCount(count);
    this.filterEngine.setTotalRowCount(count);
    this.selectionManager?.setRowCount(count);
    if (this.layoutEngine) {
      this.layoutEngine.setRowCount(count);
      // Propagate new Float64Array references if reallocation occurred
      this.gridRenderer
        ?.getGeometry()
        .setRowData(this.layoutEngine.getRowPositions(), this.layoutEngine.getRowHeightsArray());
      this.scrollManager?.updateContentSize(
        this.layoutEngine.totalWidth,
        this.layoutEngine.totalHeight,
      );
    }
    // Recompute sort/filter mapping if active
    if (this.sortEngine.sortColumns.length > 0 || this.filterEngine.getFilteredColumns().size > 0) {
      this.applyFilterAndSortToDataView();
    }
  }
}
