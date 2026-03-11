# @witqq/spreadsheet

> Canvas-based spreadsheet engine — framework-agnostic core with zero external dependencies.

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet
```

No peer dependencies required. The core package is framework-agnostic with zero external dependencies.

For framework wrappers see: `@witqq/spreadsheet-react`, `@witqq/spreadsheet-vue`, `@witqq/spreadsheet-angular`.

## Quick Start

```typescript
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name', width: 150 },
  { key: 'age', title: 'Age', width: 80, type: 'number' },
  { key: 'email', title: 'Email', width: 200 },
];

const data = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' },
];

const engine = new SpreadsheetEngine({ columns, data });
engine.mount(document.getElementById('grid')!);

// Listen to events
engine.on('cellChange', (event) => {
  console.log(`Cell (${event.row}, ${event.col}) changed to ${event.value}`);
});

// Clean up
engine.destroy();
```

---

## SpreadsheetEngine

Main entry point. Create an instance with configuration, mount to a DOM container, interact via the public API, and destroy when done.

### Constructor

```typescript
new SpreadsheetEngine(config: SpreadsheetEngineConfig)
```

### SpreadsheetEngineConfig

```typescript
interface SpreadsheetEngineConfig {
  columns: ColumnDef[];                          // Column definitions (required)
  data?: Record<string, unknown>[];              // Initial row data keyed by column key
  rowCount?: number;                             // Total rows (default: data.length or 0)
  width?: number | string;                       // Container width (pixels or CSS string)
  height?: number | string;                      // Container height (pixels or CSS string)
  editable?: boolean;                            // Enable inline cell editing (default: false)
  sortable?: boolean;                            // Enable header click-to-sort (default: false)
  frozenRows?: number;                           // Rows frozen at top
  frozenColumns?: number;                        // Columns frozen at left
  rowHeight?: number;                            // Default row height in pixels
  headerHeight?: number;                         // Header row height in pixels
  showGridLines?: boolean;                       // Show grid lines (default: true)
  showRowNumbers?: boolean;                      // Show row number column (default: true)
  theme?: SpreadsheetTheme;                      // Visual theme (default: lightTheme)
  autoRowHeight?: boolean | AutoRowSizeConfig;   // Auto row height from content (default: false)
  stretchColumns?: 'all' | 'last';              // Stretch columns to fill width
  locale?: SpreadsheetLocale;                    // Locale for UI strings (default: English)
}
```

### Lifecycle

```typescript
engine.mount(container: HTMLElement): void    // Mount to DOM, initialize subsystems, render
engine.destroy(): void                        // Unmount, clean up all resources
engine.resize(): void                         // Force layout recalculation (auto via ResizeObserver)
engine.render(): void                         // Full re-render (sync fallback if no scheduler)
engine.requestRender(): void                  // Schedule re-render via animation frame (no-op without scheduler)
```

### Data API

```typescript
engine.getCell(row: number, col: number): CellData | undefined
engine.setCell(row: number, col: number, value: CellValue): void
engine.getCellStore(): CellStore
engine.getRowStore(): RowStore
engine.setRowHeight(row: number, height: number): void
engine.setAutoRowHeights(updates: Map<number, number>): void  // Batch-set auto heights with scroll compensation
engine.setRowCount(count: number): void       // Update row count across all subsystems
engine.getRowCount(): number                  // Get total physical row count
```

All row/col indices in the engine API are **logical** (visible) indices. The engine translates to physical indices via DataView internally.

### Selection API

```typescript
engine.getSelection(): Selection
engine.selectCell(row: number, col: number): void
engine.getSelectionManager(): SelectionManager
engine.getKeyboardNavigator(): KeyboardNavigator | null
```

### Event API

```typescript
engine.on<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void
engine.off<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void
engine.getEventBus(): EventBus
```

### Scroll API

```typescript
engine.scrollTo(x: number, y: number): void
engine.getVisibleRange(): CellRange           // Currently visible cell range
engine.getScrollManager(): ScrollManager | null
```

### Sort API

```typescript
engine.sortBy(columns: SortColumn[]): void    // Sort programmatically
engine.clearSort(): void                      // Remove all sorting
engine.getSortColumns(): readonly SortColumn[]
engine.getSortEngine(): SortEngine
```

### Filter API

```typescript
engine.setColumnFilter(col: number, conditions: FilterCondition[]): void
engine.removeColumnFilter(col: number): void
engine.clearFilters(): void
engine.getFilteredRowCount(): number
engine.getFilterEngine(): FilterEngine
engine.openFilterPanel(col: number): void
engine.closeFilterPanel(): void
engine.isFilterPanelOpen: boolean             // Getter property
```

### Merge API

```typescript
engine.mergeCells(region: MergedRegion, value?: CellValue): boolean
engine.unmergeCells(startRow: number, startCol: number): boolean
engine.getMergedRegion(row: number, col: number): MergedRegion | null
engine.getMergeManager(): MergeManager
```

### Row Group API

```typescript
engine.setRowGroups(groups: RowGroupDef[]): void
engine.toggleRowGroup(logicalRow: number): void
engine.expandAllGroups(): void
engine.collapseAllGroups(): void
engine.clearRowGroups(): void
engine.setGroupAggregates(aggregates: ColumnAggregate[]): void
engine.getRowGroupManager(): RowGroupManager
```

### Validation API

```typescript
engine.setColumnValidation(col: number, rules: SpreadsheetValidationRule[]): void
engine.setCellValidation(row: number, col: number, rules: SpreadsheetValidationRule[]): void
engine.removeColumnValidation(col: number): void
engine.removeCellValidation(row: number, col: number): void
engine.getValidationEngine(): ValidationEngine
```

### Change Tracking API

```typescript
engine.setCellStatus(row: number, col: number, status: 'changed' | 'error' | 'saving' | 'saved', errorMessage?: string): void
engine.getCellStatus(row: number, col: number): CellMetadata['status'] | undefined
engine.getChangedCells(): Array<{ row: number; col: number }>
engine.clearChanges(): void
engine.getChangeTracker(): ChangeTracker
```

### Theme API

```typescript
engine.getTheme(): SpreadsheetTheme
engine.setTheme(theme: SpreadsheetTheme): void      // Switch theme at runtime
engine.getLocale(): ResolvedLocale
engine.setLocale(locale: SpreadsheetLocale): void    // Switch locale at runtime
```

### Plugin API

```typescript
engine.installPlugin(plugin: SpreadsheetPlugin): void
engine.removePlugin(name: string): void
engine.getPlugin(name: string): SpreadsheetPlugin | undefined
engine.getPluginNames(): string[]
```

### Editor API

```typescript
engine.getCellEditorRegistry(): CellEditorRegistry
engine.registerCellEditor(editor: CellEditor, type: string, priority?: number): void
engine.getInlineEditor(): InlineEditor | null
```

### Render Layer API

```typescript
engine.addRenderLayer(layer: RenderLayer): void
engine.insertRenderLayerBefore(layer: RenderLayer, beforeLayer: RenderLayer): void
engine.getRenderLayer<T extends RenderLayer>(layerClass: new (...args: unknown[]) => T): T | undefined
engine.removeRenderLayer(layer: RenderLayer): void
```

### Other Accessors

```typescript
engine.getConfig(): SpreadsheetEngineConfig
engine.getCanvasElement(): HTMLCanvasElement | null
engine.getLayoutEngine(): LayoutEngine | null
engine.getViewportManager(): ViewportManager | null
engine.getDirtyTracker(): DirtyTracker | null
engine.getDataView(): DataView
engine.getCommandManager(): CommandManager
engine.getClipboardManager(): ClipboardManager | null
engine.getContextMenuManager(): ContextMenuManager | null
engine.getCellTypeRegistry(): CellTypeRegistry
engine.getAutoRowSizeManager(): AutoRowSizeManager | null
engine.print(): void
```

---

## Data Model

### CellStore

Sparse cell storage using Map with `"row:col"` string keys. Only stores non-empty cells. O(1) get/set/delete.

```typescript
import { CellStore } from '@witqq/spreadsheet';

const store = new CellStore();

store.set(0, 0, { value: 'Hello' });
store.setValue(0, 1, 42);
store.get(0, 0);                               // { value: 'Hello' }
store.has(0, 0);                                // true
store.delete(0, 0);                             // true
store.clear();

// Metadata
store.setMetadata(0, 0, { status: 'changed' });
store.clearMetadata(0, 0);

// Bulk loading
store.bulkLoad(rows, columnKeys);               // Load from array of row objects
store.bulkLoadChunk(startRow, rows, columnKeys); // Load chunk at offset
store.bulkGenerate(startRow, count, columnKeys, generateRow); // Generate rows in-place

// Iteration
store.iterateRange(range);                      // Yields { row, col, data } in range
store.entries();                                // Yields all { row, col, data }

// Properties
store.size;                                     // Number of stored cells
store.version;                                  // Increments on each mutation
```

### RowStore

Row metadata storage: height overrides and hidden rows. Rows without overrides use the default height from theme.

Height overrides are separated into **manual** (user drag-resized) and **auto** (computed by measurement). Manual overrides always take priority.

```typescript
import { RowStore } from '@witqq/spreadsheet';

const rowStore = new RowStore();

rowStore.getHeight(row, defaultHeight);         // Resolve: hidden→manual→auto→default
rowStore.setHeight(row, height);                // Set manual height override
rowStore.setAutoHeight(row, height);            // Set auto-measured height
rowStore.setAutoHeightsBatch(updates, default); // Batch set auto heights, returns changed Set
rowStore.clearHeight(row);                      // Clear manual override
rowStore.clearAutoHeight(row);                  // Clear auto override
rowStore.clearAllAutoHeights();                 // Clear all auto overrides
rowStore.isManual(row);                         // Has manual override?
rowStore.isAuto(row);                           // Has auto override?

// Row visibility
rowStore.isHidden(row);
rowStore.hide(row);
rowStore.show(row);
rowStore.visibleRowsInRange(startRow, endRow);  // Iterator of visible row indices

// Bookkeeping
rowStore.shiftRowsUp(deletedRow);               // Shift metadata after row deletion
rowStore.clear();

// Properties
rowStore.version;
rowStore.overrideCount;
rowStore.manualOverrideCount;
rowStore.autoOverrideCount;
rowStore.hiddenCount;
```

### ColStore

Column definitions store with hidden column tracking.

```typescript
import { ColStore } from '@witqq/spreadsheet';

const colStore = new ColStore(columns);

colStore.getColumn(index): ColumnDef | undefined
colStore.getColumns(): ReadonlyArray<ColumnDef>
colStore.setColumns(columns: ColumnDef[]): void
colStore.findByKey(key: string): number         // Column index by key, -1 if not found

// Visibility
colStore.isHidden(index): boolean
colStore.hide(index): void
colStore.show(index): void
colStore.visibleColumns();                      // Iterator of { index, column }
colStore.visibleColumnsInRange(start, end);     // Iterator of visible column indices
colStore.clear();                               // Reset to empty

// Properties
colStore.columnCount;
colStore.visibleColumnCount;
colStore.hiddenCount;
colStore.version;
```

### StylePool

Flyweight pool that deduplicates CellStyle objects by content. Returns a ref string for each interned style. Multiple identical styles share the same ref.

```typescript
import { StylePool } from '@witqq/spreadsheet';

const pool = new StylePool();

const ref = pool.intern({ bgColor: '#ff0', fontWeight: 'bold' });
const style = pool.resolve(ref);               // { bgColor: '#ff0', fontWeight: 'bold' }
pool.has(ref);                                  // true
pool.size;                                      // 1
pool.clear();
```

### DataView

Logical↔physical row index mapping layer. Sits between CellStore (physical rows) and the engine (logical rows). When no sort/filter is active, operates as a zero-overhead passthrough.

```typescript
import { DataView } from '@witqq/spreadsheet';
import type { DataViewConfig } from '@witqq/spreadsheet';

const config: DataViewConfig = { totalRowCount: 1000 };
const view = new DataView(config);

view.getPhysicalRow(logicalRow);               // Logical → physical row index
view.getLogicalRow(physicalRow);               // Physical → logical (undefined if hidden)
view.visibleRowCount;                          // Rows after filtering
view.totalRowCount;                            // All physical rows
view.isPassthrough();                          // true when no sort/filter active

view.recompute(physicalIndices);               // Apply sorted/filtered mapping
view.reset();                                  // Reset to identity mapping
view.setTotalRowCount(count);                  // Update total (e.g. row insert)
```

---

## Types

### Cell Types

```typescript
type CellValue = string | number | boolean | Date | null;

interface CellData {
  readonly value: CellValue;
  readonly displayValue?: string;               // Overrides default rendering
  readonly formula?: string;                    // Formula expression (e.g. "=SUM(A1:A10)")
  readonly style?: CellStyleRef;                // Reference to shared style in StylePool
  readonly type?: CellType;                     // Cell type for rendering/editing
  readonly metadata?: CellMetadata;             // Status, errors, links, comments
}

interface CellMetadata {
  readonly status?: 'changed' | 'error' | 'saving' | 'saved';
  readonly errorMessage?: string;               // Tooltip on hover
  readonly link?: { url: string; label?: string };
  readonly comment?: string;                    // Tooltip on hover
}

type CellType =
  | 'string' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'select' | 'dynamicSelect' | 'formula' | 'link'
  | 'image' | 'progressBar' | 'rating' | 'badge' | 'custom';
```

### Style Types

```typescript
interface CellStyleRef {
  readonly ref: string;                         // Unique hash key from StylePool.intern()
  readonly style: CellStyle;                    // The resolved style object
}
```

```typescript
interface CellStyle {
  readonly bgColor?: string;                    // CSS color
  readonly textColor?: string;                  // CSS color
  readonly fontFamily?: string;
  readonly fontSize?: number;                   // Pixels
  readonly fontWeight?: 'normal' | 'bold';
  readonly fontStyle?: 'normal' | 'italic';
  readonly textAlign?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
  readonly borderTop?: BorderStyle;
  readonly borderRight?: BorderStyle;
  readonly borderBottom?: BorderStyle;
  readonly borderLeft?: BorderStyle;
  readonly numberFormat?: string;               // e.g. "#,##0.00"
  readonly textWrap?: boolean;                  // Per-cell wrap override (priority: cellStyle > ColumnDef.wrapText)
  readonly indent?: number;
}

interface BorderStyle {
  readonly width: number;
  readonly color: string;
  readonly style: 'solid' | 'dashed' | 'dotted';
}
```

**Text wrapping priority:** `cellStyle?.textWrap ?? ColumnDef.wrapText ?? false`. Per-cell `textWrap` overrides the column setting bidirectionally — set `textWrap: true` to enable wrapping for a single cell, or `textWrap: false` to disable it even when the column has `wrapText: true`.

### Geometry Types

```typescript
interface CellAddress {
  readonly row: number;
  readonly col: number;
}

interface CellRange {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
}

interface CellRect {
  readonly x: number;                           // Pixel position on canvas
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

### Column Definition

```typescript
interface ColumnDef {
  readonly key: string;                         // Unique ID for data binding
  readonly title: string;                       // Header display text
  readonly width: number;                       // Width in pixels
  readonly minWidth?: number;                   // Min width for resize
  readonly maxWidth?: number;                   // Max width for resize
  readonly type?: CellType;                     // Cell type (rendering/editing)
  readonly frozen?: boolean;                    // Pin to frozen pane
  readonly sortable?: boolean;                  // Enable header sort
  readonly filterable?: boolean;                // Enable column filter
  readonly editable?: boolean;                  // Allow inline editing
  readonly resizable?: boolean;                 // Allow drag-to-resize
  readonly hidden?: boolean;                    // Hide from display
  readonly wrapText?: boolean;                  // Enable text wrapping
  readonly validation?: SpreadsheetValidationRule[];  // Validation rules
}
```

### Selection Types

```typescript
type SelectionType = 'cell' | 'range' | 'row' | 'column' | 'all';

interface Selection {
  readonly type: SelectionType;
  readonly ranges: readonly CellRange[];
  readonly activeCell: CellAddress;
  readonly anchorCell: CellAddress;
}
```

### Merge Types

```typescript
interface MergedRegion {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;                      // Inclusive
  readonly endCol: number;                      // Inclusive
}
```

### Validation Types

```typescript
interface ValidationRule {
  readonly type: string;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  readonly valid: boolean;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}
```

### Conditional Format Types

```typescript
type ComparisonOperator =
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'equal' | 'notEqual' | 'between' | 'notBetween';

interface ValueCondition {
  readonly type: 'value';
  readonly operator: ComparisonOperator;
  readonly value: number;
  readonly value2?: number;                     // For between/notBetween
}

interface GradientScaleCondition {
  readonly type: 'gradientScale';
  readonly stops: readonly GradientStop[];
}

interface GradientStop {
  readonly value: number;
  readonly color: string;
}

interface DataBarCondition {
  readonly type: 'dataBar';
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly color: string;
  readonly showValue?: boolean;
}

interface IconSetCondition {
  readonly type: 'iconSet';
  readonly iconSet: IconSetName;
  readonly thresholds: readonly IconSetThreshold[];
  readonly showValue?: boolean;
}

type IconSetName = 'arrows' | 'circles' | 'flags' | 'stars';

interface IconSetThreshold {
  readonly value: number;
  readonly icon: string;
}

type ConditionalFormatCondition =
  | ValueCondition | GradientScaleCondition | DataBarCondition | IconSetCondition;

interface ConditionalFormatRule {
  readonly id: string;
  readonly priority: number;
  readonly range: CellRange;
  readonly condition: ConditionalFormatCondition;
  readonly style?: Partial<CellStyle>;
  readonly stopIfTrue?: boolean;
}
```

### Change Tracking Types

```typescript
interface CellChange {
  readonly row: number;
  readonly col: number;
  readonly oldValue: CellValue;
  readonly newValue: CellValue;
  readonly timestamp: number;
  readonly userId?: string;
  readonly source: string;
}
```

---

## Cell Type Registry

Maps `CellType` identifiers to render and format functions. Built-in types: `string`, `number`, `boolean`, `date`.

```typescript
import { CellTypeRegistry } from '@witqq/spreadsheet';
import type {
  CellTypeRenderer,
  CellAlignment,
  CellDecorator,
  CellDecoratorPosition,
  CellDecoratorRegistration,
} from '@witqq/spreadsheet';

interface CellTypeRenderer {
  format(value: CellValue): string;            // Format value for text display
  align: CellAlignment;                        // 'left' | 'center' | 'right'
  render?: (                                   // Optional custom canvas rendering
    ctx: CanvasRenderingContext2D,
    value: CellValue,
    x: number, y: number,
    width: number, height: number,
    theme: SpreadsheetTheme,
  ) => void;
  measureHeight?: (                            // Optional height for auto row sizing
    ctx: CanvasRenderingContext2D,
    value: CellValue,
    width: number,
    theme: SpreadsheetTheme,
  ) => number;
  getHitZones?: (                              // Optional sub-cell interactive zones
    value: CellValue,
    width: number, height: number,
    theme?: SpreadsheetTheme,
  ) => HitZone[];
}

// Decorator position relative to cell content
type CellDecoratorPosition = 'left' | 'right' | 'overlay' | 'underlay';

// Composable rendering addon for cells
interface CellDecorator {
  readonly id: string;
  readonly position: CellDecoratorPosition;
  getWidth?(cellData: CellData, cellHeight: number, ctx?: CanvasRenderingContext2D, theme?: SpreadsheetTheme): number;
  render(ctx: CanvasRenderingContext2D, cellData: CellData, x: number, y: number, width: number, height: number, theme: SpreadsheetTheme): void;
  getHitZones?(width: number, height: number, cellData: CellData): HitZone[];
}

// Registration binding a decorator to specific cells
interface CellDecoratorRegistration {
  decorator: CellDecorator;
  appliesTo: (row: number, col: number, cellData: CellData) => boolean;
}
```

### Usage

```typescript
// Register a custom cell type renderer
engine.getCellTypeRegistry().register('rating', {
  format: (value) => '★'.repeat(Number(value) || 0),
  align: 'center',
  render: (ctx, value, x, y, w, h, theme) => {
    const stars = Number(value) || 0;
    ctx.fillStyle = theme.colors.cellText;
    ctx.fillText('★'.repeat(stars), x + 4, y + h / 2);
  },
});

// Access built-in renderer
const numRenderer = engine.getCellTypeRegistry().get('number');
numRenderer.format(1234.5);                    // "1,234.5"

// Set format locale (affects number and date formatting)
engine.getCellTypeRegistry().setFormatLocale('de-DE');
engine.getCellTypeRegistry().getFormatLocale();  // 'de-DE'

// Detect type from value
engine.getCellTypeRegistry().detectType(42);   // 'number'
engine.getCellTypeRegistry().detectType(true); // 'boolean'

// Decorators — composable rendering addons around cell text
engine.getCellTypeRegistry().addDecorator({
  decorator: {
    id: 'status-dot',
    position: 'left',              // 'left' | 'right' | 'overlay' | 'underlay'
    getWidth: () => 16,
    render: (ctx, cellData, x, y, w, h) => {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = cellData.value === 'Active' ? '#63be7b' : '#999';
      ctx.fill();
    },
    getHitZones: (w, h) => [{ id: 'dot', x: 0, y: 0, width: w, height: h, cursor: 'pointer' }],
  },
  appliesTo: (row, col) => col === 5,
});
engine.getCellTypeRegistry().removeDecorator('status-dot');
```

---

## Editing

### InlineEditor

Built-in textarea-based editor. Opens on double-click, F2, or type-to-edit. Commits on Enter, cancels on Escape, navigates on Tab.

```typescript
import { InlineEditor } from '@witqq/spreadsheet';
import type { InlineEditorConfig, EditorCloseReason } from '@witqq/spreadsheet';

interface InlineEditorConfig {
  container: HTMLElement;                       // Parent container for textarea positioning
  scrollContainer: HTMLElement;                 // Scroll container for scroll events
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  cellStore: CellStore;
  dataView: DataView;
  theme: SpreadsheetTheme;
  onCommit: (row: number, col: number, oldValue: CellValue, newValue: CellValue) => void;
  onClose: (reason: EditorCloseReason) => void;
  frozenRows?: number;
  frozenColumns?: number;
}

type EditorCloseReason =
  | 'enter'           // Enter key — commits, moves down
  | 'shift-enter'     // Shift+Enter — commits, moves up
  | 'tab'             // Tab — commits, moves right
  | 'shift-tab'       // Shift+Tab — commits, moves left
  | 'escape'          // Escape — cancels, no commit
  | 'blur'            // Click outside — commits
  | 'scroll'          // Grid scroll — commits
  | 'programmatic';   // Closed by code

// InlineEditor is managed by SpreadsheetEngine internally.
// Access via:
const editor = engine.getInlineEditor();
editor?.isEditing;                             // Whether editor is open
editor?.editingRow;                            // Current row (-1 if not editing)
editor?.editingCol;                            // Current column (-1 if not editing)
```

### CellEditor Interface

Generic interface for overlay cell editors (calendars, dropdowns, color pickers). The engine delegates lifecycle management via this interface.

```typescript
import type {
  CellEditor,
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
  CellEditorMatcher,
  CellEditorRegistration,
} from '@witqq/spreadsheet';

interface CellEditor {
  readonly id: string;                         // Unique editor type ID
  readonly isOpen: boolean;
  readonly editingRow: number;
  readonly editingCol: number;

  open(context: CellEditorContext, commitFn: CellEditorCommit, closeFn: CellEditorClose): void;
  close(reason: EditorCloseReason): void;
  setTheme(theme: SpreadsheetTheme): void;
  setLocale(locale: ResolvedLocale): void;
  destroy(): void;
}

interface CellEditorContext {
  row: number;
  col: number;
  value: CellValue;
  column: ColumnDef;
  container: HTMLElement;
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

type CellEditorCommit = (row: number, col: number, oldValue: CellValue, newValue: CellValue) => void;
type CellEditorClose = (reason: EditorCloseReason) => void;
type CellEditorMatcher = (column: ColumnDef, value: CellValue) => boolean;

interface CellEditorRegistration {
  editor: CellEditor;
  matcher: CellEditorMatcher;
  priority: number;                            // Higher wins when multiple match
}
```

### CellEditorRegistry

Maps column types / predicates to CellEditor instances. The engine queries the registry to find the best editor. InlineEditor (textarea) is the fallback when no registered editor matches.

```typescript
import { CellEditorRegistry } from '@witqq/spreadsheet';

const registry = engine.getCellEditorRegistry();

// Register by predicate
registry.register(myEditor, (column, value) => column.type === 'color', 10);

// Register by column type string
registry.registerForType(myDateEditor, 'date', 0);

// Resolve best editor for a cell
const editor = registry.resolve(column, value); // CellEditor | null

// Get all registered editors
registry.getAll();                             // CellEditor[] (deduplicated)

// Propagate theme/locale to all registered editors
registry.setTheme(theme);
registry.setLocale(locale);

// Cleanup
registry.destroy();                            // Destroy all editors and clear
```

### Built-in Editors

**DatePickerEditor** — Calendar overlay for `type: 'date'` columns. Auto-registered during mount.

```typescript
import { DatePickerEditor } from '@witqq/spreadsheet';
// Auto-registered for column type 'date' at priority 0
```

**DateTimeEditor** — Date+time picker for `type: 'datetime'` columns. Auto-registered during mount.

```typescript
import { DateTimeEditor } from '@witqq/spreadsheet';
// Auto-registered for column type 'datetime' at priority 0
```

**DatePickerOverlay** — Low-level calendar DOM widget used by DatePickerEditor.

```typescript
import { DatePickerOverlay } from '@witqq/spreadsheet';
import type { DatePickerConfig } from '@witqq/spreadsheet';

interface DatePickerConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
  onCommit: (row: number, col: number, oldValue: CellValue, newValue: CellValue) => void;
  onClose: (reason: EditorCloseReason) => void;
  frozenRows?: number;
  frozenColumns?: number;
}
```

### Registering a Custom Editor

```typescript
import type { CellEditor, CellEditorContext, CellEditorCommit, CellEditorClose } from '@witqq/spreadsheet';

class ColorPickerEditor implements CellEditor {
  readonly id = 'color-picker';
  private _isOpen = false;
  private _editingRow = -1;
  private _editingCol = -1;

  get isOpen() { return this._isOpen; }
  get editingRow() { return this._editingRow; }
  get editingCol() { return this._editingCol; }

  open(ctx: CellEditorContext, commitFn: CellEditorCommit, closeFn: CellEditorClose) {
    this._isOpen = true;
    this._editingRow = ctx.row;
    this._editingCol = ctx.col;
    // Create DOM overlay, position it, handle input...
    // Call commitFn(row, col, oldValue, newColor) to persist
    // Call closeFn('enter') when done
  }

  close(reason: EditorCloseReason) {
    this._isOpen = false;
    // Remove DOM overlay
  }

  setTheme(theme: SpreadsheetTheme) { /* update styling */ }
  setLocale(locale: ResolvedLocale) { /* update labels */ }
  destroy() { this.close('programmatic'); }
}

// Register before or after mount
engine.registerCellEditor(new ColorPickerEditor(), 'color', 10);
```

---

## Selection

### SelectionManager

Manages selection state: active cell, anchor cell, selected ranges, and selection type. Pure state management — no rendering.

```typescript
import { SelectionManager } from '@witqq/spreadsheet';
import type { SelectionManagerConfig } from '@witqq/spreadsheet';

interface SelectionManagerConfig {
  rowCount: number;
  colCount: number;
  onChange?: (selection: Selection, previousSelection: Selection) => void;
}

const sm = engine.getSelectionManager();

// Selection actions
sm.selectCell(row, col);                       // Single cell (click)
sm.extendSelection(row, col);                  // Extend from anchor (Shift+click)
sm.addRange(row, col);                         // Add range (Ctrl+click)
sm.selectRow(row);                             // Entire row (row number click)
sm.selectColumn(col);                          // Entire column (header click)
sm.selectAll();                                // All cells (Ctrl+A or corner click)

// Query
sm.getSelection(): Selection                   // Immutable snapshot
sm.isSelected(row, col): boolean               // Cell in any selected range?
sm.isActiveCell(row, col): boolean             // Is the active cell?
sm.rowCount: number
sm.colCount: number

// Update bounds
sm.setRowCount(count);                         // After filtering changes visible rows
sm.setMergeManager(mm);                        // For merge-aware selection
```

All selection methods are merge-aware: clicking a merged cell selects the entire merge region, and the active cell is redirected to the merge anchor.

### KeyboardNavigator

Handles keyboard events for spreadsheet navigation. Merge-aware: skips hidden cells in merged regions.

```typescript
import { KeyboardNavigator } from '@witqq/spreadsheet';
import type { KeyboardNavigatorConfig } from '@witqq/spreadsheet';

interface KeyboardNavigatorConfig {
  selectionManager: SelectionManager;
  getVisibleRowCount: () => number;            // For Page Up/Down distance
}

const nav = engine.getKeyboardNavigator();

// Process a keyboard event — returns new CellAddress for auto-scroll, or null
nav?.handleKeyDown(event): CellAddress | null

// Set merge manager for merge-aware navigation
nav?.setMergeManager(mm);
```

**Supported keys:**
- Arrow keys — move active cell
- Shift+Arrow — extend selection range
- Tab / Shift+Tab — move right/left
- Enter / Shift+Enter — move down/up
- Home / End — jump to row start/end
- Ctrl+Home / Ctrl+End — jump to grid corners
- Page Up / Page Down — scroll by visible row count
- Ctrl+A — select all

---

## Plugin Types

```typescript
interface SpreadsheetPlugin {
  readonly name: string;
  readonly dependencies?: string[];            // Names of required plugins
  install(api: PluginAPI): void;
  destroy?(): void;
}

interface PluginAPI {
  readonly engine: SpreadsheetEngine;
  getPluginState<T>(key: string): T | undefined;
  setPluginState<T>(key: string, value: T): void;
}
```

See `@witqq/spreadsheet-plugins` for official plugin implementations.

---

## Constants

```typescript
import { LINE_HEIGHT_MULTIPLIER } from '@witqq/spreadsheet';
// Value: 1.2 — used in text measurement for auto row height
```

---

## Common Patterns

### Controlled Data Updates

```typescript
const engine = new SpreadsheetEngine({
  columns: [{ key: 'name', title: 'Name', width: 200 }],
  data: initialData,
});
engine.mount(container);

// Update a single cell
engine.setCell(0, 0, 'New Value');

// Bulk update via CellStore
const store = engine.getCellStore();
store.bulkLoadChunk(100, newRows, ['name', 'age', 'email']);
engine.setRowCount(store.size);
engine.render();
```

### Theme Switching

```typescript
import { SpreadsheetEngine, lightTheme, darkTheme } from '@witqq/spreadsheet';

const engine = new SpreadsheetEngine({ columns, data, theme: lightTheme });
engine.mount(container);

// Switch at runtime
document.querySelector('#dark-mode').addEventListener('change', (e) => {
  engine.setTheme(e.target.checked ? darkTheme : lightTheme);
});
```

### Frozen Panes

```typescript
const engine = new SpreadsheetEngine({
  columns,
  data,
  frozenRows: 1,      // Freeze first row
  frozenColumns: 2,    // Freeze first two columns
});
```

### Auto Row Height

```typescript
const engine = new SpreadsheetEngine({
  columns: [
    { key: 'description', title: 'Description', width: 300, wrapText: true },
  ],
  data,
  autoRowHeight: true,  // or { minRowHeight: 28, maxRowHeight: 200 }
});
```

### Programmatic Sort and Filter

```typescript
// Sort by age descending
engine.sortBy([{ col: 1, direction: 'desc' }]);

// Filter name column to contain "Alice"
engine.setColumnFilter(0, [{ col: 0, operator: 'contains', value: 'Alice' }]);

// Clear
engine.clearSort();
engine.clearFilters();
```

## Rendering

### CanvasManager

DPI-aware canvas element manager. Creates and sizes a `<canvas>` inside a container, handles device pixel ratio changes (browser zoom).

```typescript
import { CanvasManager, CanvasManagerConfig } from '@witqq/spreadsheet';

interface CanvasManagerConfig {
  container: HTMLElement;
  dpr?: number; // device pixel ratio override; defaults to window.devicePixelRatio
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `syncSize` | `(): void` | Sync canvas size with container dimensions; applies DPR transform |
| `getContext` | `(): CanvasRenderingContext2D` | Get the 2D drawing context |
| `getCanvas` | `(): HTMLCanvasElement` | Get the raw canvas element |
| `getDpr` | `(): number` | Current device pixel ratio |
| `getCssWidth` | `(): number` | Canvas CSS width |
| `getCssHeight` | `(): number` | Canvas CSS height |
| `getPixelWidth` | `(): number` | Canvas pixel width (`canvas.width`) |
| `getPixelHeight` | `(): number` | Canvas pixel height (`canvas.height`) |
| `setDprChangeCallback` | `(callback: () => void): void` | Callback on DPR change |
| `destroy` | `(): void` | Cleanup DPR watcher, remove canvas from DOM |

### LayoutEngine

Pre-computed cumulative row/column positions using `Float64Array`. All coordinate lookups are O(1); row/column-at-pixel lookups use O(log n) binary search.

```typescript
import { LayoutEngine, LayoutEngineConfig } from '@witqq/spreadsheet';

interface LayoutEngineConfig {
  columns: ColumnDef[];
  rowCount: number;
  rowHeight: number;
  headerHeight: number;
  rowNumberWidth: number;
  rowStore?: RowStore;
}
```

**Getters:**

| Property | Type | Description |
|----------|------|-------------|
| `rowCount` | `number` | Current effective row count |
| `columnCount` | `number` | Number of visible columns |
| `rowHeight` | `number` | Default row height |
| `headerHeight` | `number` | Header height |
| `rowNumberWidth` | `number` | Row number gutter width |
| `contentWidth` | `number` | Total width of all visible columns |
| `contentHeight` | `number` | Total height of all rows |
| `totalWidth` | `number` | `rowNumberWidth + contentWidth` |
| `totalHeight` | `number` | `headerHeight + contentHeight` |

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `setRowCount` | `(count: number): void` | Update row count; reallocates arrays if needed |
| `getRowPositions` | `(): Float64Array` | Cumulative row positions (shared ref) |
| `getRowHeightsArray` | `(): Float64Array` | Per-row heights array |
| `getCellRect` | `(row: number, col: number): CellRect` | O(1) cell rectangle lookup |
| `getColumnX` | `(col: number): number` | Column x-position |
| `getColumnWidth` | `(col: number): number` | Column width |
| `getRowY` | `(row: number): number` | Row y-position |
| `getRowHeight` | `(row: number): number` | Height of a specific row |
| `getRowAtY` | `(y: number): number` | O(log n) binary search for row at y pixel |
| `getColAtX` | `(x: number): number` | O(log n) binary search for column at x pixel |
| `setRowHeight` | `(row: number, height: number): void` | Update single row height; O(n) recompute |
| `setRowHeightsBatch` | `(updates: Map<number, number>): void` | Batch-update row heights; single O(n) recompute |
| `setColumnWidth` | `(col: number, width: number): void` | Update single column width |
| `setColumnWidthsBatch` | `(updates: Map<number, number>): void` | Batch-update column widths |
| `getFrozenRowsHeight` | `(count: number): number` | Pixel height of first `count` frozen rows |
| `getFrozenColsWidth` | `(count: number): number` | Pixel width of first `count` frozen columns |

### GridGeometry

Pure cell position/rectangle computation. Delegates to `LayoutEngine` row positions when available, falls back to uniform row height.

```typescript
import { GridGeometry, GridGeometryConfig } from '@witqq/spreadsheet';

interface GridGeometryConfig {
  columns: ColumnDef[];
  theme: SpreadsheetTheme;
  showRowNumbers: boolean;
  rowPositions?: Float64Array;
  rowHeights?: Float64Array;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `getRowY` | `(row: number): number` | Row y-position relative to content |
| `getRowHeight` | `(row: number): number` | Height of a specific row |
| `setRowData` | `(rowPositions: Float64Array, rowHeights: Float64Array): void` | Update row data (shared refs from LayoutEngine) |
| `getVisibleColumns` | `(): ColumnDef[]` | Non-hidden columns (cached) |
| `getColumnWidth` | `(col: number): number` | Column width |
| `setColumnWidth` | `(col: number, width: number): void` | Set column width override |
| `computeColumnRects` | `(): CellRect[]` | Column header rectangles (cached) |
| `computeCellRect` | `(row: number, col: number): CellRect` | Rectangle for a specific cell |
| `computeAllCellRects` | `(rowCount: number): CellRect[][]` | 2D array of all cell rectangles |
| `invalidateCache` | `(): void` | Clear cached rects and visible columns |
| `setTheme` | `(theme: SpreadsheetTheme): void` | Update theme and invalidate |

### ViewportManager

Computes visible cell range from scroll position with configurable row/column buffer for pre-rendering.

```typescript
import { ViewportManager, ViewportRange, ViewportConfig, FrozenViewportRanges } from '@witqq/spreadsheet';

interface ViewportRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startCol: number;
  readonly endCol: number;
  readonly visibleRowCount: number;
  readonly visibleColCount: number;
}

interface FrozenViewportRanges {
  corner: ViewportRange;
  frozenRow: ViewportRange;
  frozenCol: ViewportRange;
  main: ViewportRange;
}

interface ViewportConfig {
  rowBuffer?: number; // default: 10
  colBuffer?: number; // default: 5
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `computeVisibleRange` | `(scrollX, scrollY, viewportWidth, viewportHeight): ViewportRange` | Visible rows/columns with buffer |
| `computeFrozenRanges` | `(scrollX, scrollY, viewportWidth, viewportHeight, frozenRows, frozenCols): FrozenViewportRanges` | 4 viewport ranges for frozen pane rendering |

### RenderScheduler

RAF-based render coalescing. Multiple `requestRender()` calls within one frame produce a single render.

```typescript
import { RenderScheduler } from '@witqq/spreadsheet';

const scheduler = new RenderScheduler(() => { /* render callback */ });
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `requestRender` | `(): void` | Schedule render on next `requestAnimationFrame` |
| `cancel` | `(): void` | Cancel pending render |
| `isPending` | `(): boolean` | Whether a render is scheduled |

### DirtyTracker

Tracks which visual regions need redrawing. Subsystems mark regions dirty; the render loop flushes them.

```typescript
import { DirtyTracker, DirtyRegion, DirtyCell, DirtyRect } from '@witqq/spreadsheet';

type DirtyRegion = 'full' | 'viewport-change' | 'cell-update';
interface DirtyCell { row: number; col: number; }
interface DirtyRect { x: number; y: number; width: number; height: number; }
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `markDirty` | `(region: DirtyRegion): void` | Mark entire region for redraw |
| `markCellDirty` | `(row: number, col: number): void` | Mark specific cell dirty (cap: 50 cells) |
| `isDirty` | `(): boolean` | Whether any region is dirty |
| `isRegionDirty` | `(region: DirtyRegion): boolean` | Check specific region |
| `flush` | `(): Set<DirtyRegion>` | Get dirty regions and clear |
| `flushCells` | `(): DirtyCell[] | null` | Flush dirty cells; `null` if full redraw needed |
| `clear` | `(): void` | Clear all dirty flags |

### ScrollManager

Native scrollbar behavior via hidden scrollable overlay div. Captures wheel events and forwards to callback.

```typescript
import { ScrollManager, ScrollManagerConfig } from '@witqq/spreadsheet';

interface ScrollManagerConfig {
  container: HTMLElement;
  totalWidth: number;
  totalHeight: number;
  onScroll: (scrollX: number, scrollY: number) => void;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `scrollX` | `number` (getter) | Current horizontal scroll offset |
| `scrollY` | `number` (getter) | Current vertical scroll offset |

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateContentSize` | `(totalWidth: number, totalHeight: number): void` | Update scrollable area |
| `scrollTo` | `(x: number, y: number): void` | Programmatic scroll |
| `getElement` | `(): HTMLDivElement` | Get scroll container element |
| `destroy` | `(): void` | Remove listeners and DOM |

### RenderPipeline

Orchestrates composable render layers on a single canvas. Supports frozen pane 4-region rendering with `ImageData` caching for static frozen areas.

```typescript
import { RenderPipeline, FrozenPaneConfig } from '@witqq/spreadsheet';

interface FrozenPaneConfig {
  frozenRows: number;
  frozenColumns: number;
  layoutEngine: LayoutEngine;
  frozenRanges: FrozenViewportRanges;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `addLayer` | `(layer: RenderLayer): void` | Append layer to pipeline |
| `insertLayerBefore` | `(layer: RenderLayer, beforeLayer: RenderLayer): void` | Insert layer before another |
| `getLayer` | `<T extends RenderLayer>(layerClass: new (...) => T): T \| undefined` | Find layer by class type |
| `removeLayer` | `(layer: RenderLayer): void` | Remove layer from pipeline |
| `setMergeManager` | `(manager: MergeManager \| undefined): void` | Set merge manager for merge-aware rendering |
| `setTheme` | `(theme: SpreadsheetTheme): void` | Update theme, invalidate frozen caches |
| `invalidateFrozenCache` | `(): void` | Invalidate frozen pane caches |
| `render` | `(ctx, viewport, canvasWidth, canvasHeight, scrollX, scrollY, renderMode?, frozenConfig?): void` | Full render of all layers |
| `renderPartial` | `(ctx, viewport, canvasWidth, canvasHeight, scrollX, scrollY, dirtyRects, renderMode?, frozenConfig?): void` | Partial render of dirty rectangles only |

### RenderLayer Interface

Composable layer that draws one visual aspect of the grid.

```typescript
import { RenderLayer, RenderContext, RenderMode, PaneRegion } from '@witqq/spreadsheet';

type RenderMode = 'full' | 'light' | 'placeholder';
type PaneRegion = 'corner' | 'frozenRow' | 'frozenCol' | 'main' | 'full';

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  geometry: GridGeometry;
  theme: SpreadsheetTheme;
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportRange;
  scrollX: number;
  scrollY: number;
  renderMode: RenderMode;
  paneRegion: PaneRegion;
  mergeManager?: MergeManager;
}

interface RenderLayer {
  render(rc: RenderContext): void;
  measureHeights?(rc: RenderContext): Map<number, number>; // optional: row → desired height
}
```

### GridRenderer

Facade that creates the default layer stack: Background → CellText → CellStatus → EmptyState → GridLines → Header → RowNumber → SelectionOverlay.

```typescript
import { GridRenderer, GridRenderConfig } from '@witqq/spreadsheet';

interface GridRenderConfig {
  columns: ColumnDef[];
  cellStore: CellStore;
  dataView: DataView;
  rowCount: number;
  theme: SpreadsheetTheme;
  showRowNumbers: boolean;
  showGridLines: boolean;
  selectionManager?: SelectionManager;
  cellTypeRegistry?: CellTypeRegistry;
  rowPositions?: Float64Array;
  rowHeights?: Float64Array;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `computeColumnRects` | `(): CellRect[]` | Column header rectangles |
| `computeCellRect` | `(row, col): CellRect` | Rectangle for a specific cell |
| `computeAllCellRects` | `(): CellRect[][]` | All cell rectangles as 2D array |
| `getGeometry` | `(): GridGeometry` | Access grid geometry |
| `addLayer` | `(layer: RenderLayer): void` | Add layer (inserted before GridLines/Selection) |
| `insertLayerBefore` | `(layer, beforeLayer): void` | Insert layer before another |
| `getLayer` | `<T>(layerClass): T \| undefined` | Find layer by type |
| `removeLayer` | `(layer): void` | Remove layer |
| `setSortState` | `(state: HeaderSortState): void` | Sort indicators on headers |
| `setFilterState` | `(state: HeaderFilterState): void` | Filter indicators on headers |
| `setFrozenConfig` | `(config: FrozenPaneConfig \| undefined): void` | Set frozen pane config |
| `invalidateFrozenCache` | `(): void` | Invalidate frozen pane caches |
| `setMergeManager` | `(manager: MergeManager \| undefined): void` | Set merge manager |
| `setTheme` | `(theme: SpreadsheetTheme): void` | Runtime theme change |
| `setLocale` | `(locale: ResolvedLocale): void` | Runtime locale change |
| `render` | `(ctx, viewport, w, h, scrollX, scrollY, renderMode?): void` | Full render |
| `renderPartial` | `(ctx, viewport, w, h, scrollX, scrollY, dirtyRects, renderMode?): void` | Partial render |

### TextMeasureCache

LRU cache for `ctx.measureText()` results. Caches text width, word-wrap line splits, and em-height measurements.

```typescript
import { TextMeasureCache } from '@witqq/spreadsheet';

const cache = new TextMeasureCache(10_000); // maxSize
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `measureText` | `(ctx, text: string, font: string): number` | Cached text width measurement |
| `measureEmHeight` | `(ctx, font: string): number` | Font em-height (ascent+descent) |
| `getWrappedLines` | `(ctx, text, font, maxWidth): string[]` | Word-wrap line splitting |
| `countWrappedLines` | `(ctx, text, font, maxWidth): number` | Count of wrapped lines |
| `measureWrappedHeight` | `(ctx, text, font, maxWidth, lineHeight?, padding?): number` | Total pixel height for wrapped text |
| `truncateText` | `(ctx, text, font, maxWidth): string` | Truncate with ellipsis |
| `clear` | `(): void` | Clear all caches |

### Built-in Render Layers

| Layer | Constructor | Description |
|-------|-------------|-------------|
| `CellTextLayer` | `(cellStore, dataView, measureCache, typeRegistry?)` | Cell text with truncation, alignment, word-wrap, merged cell support, custom cell type rendering |
| `CellStatusLayer` | `(cellStore, dataView)` | Status indicators: error (red triangle), changed/saving (blue dot), saved (green dot) |
| `EmptyStateLayer` | parameterless | "No data" text when all rows filtered out |
| `FillHandleLayer` | `(autofillManager)` | Fill handle square + autofill preview overlay |
| `RowGroupToggleLayer` | `(groupManager, dataView)` | Expand/collapse icons in row number gutter |

`CellTextLayer` also implements `measureHeights(rc)` returning `Map<number, number>` of desired row heights for wrap-text columns.

---

## Events

### EventBus

Typed publish/subscribe for spreadsheet events. Supports both typed event names (via `SpreadsheetEvents` interface) and dynamic string names (for framework wrappers).

```typescript
import { EventBus } from '@witqq/spreadsheet';

const bus = new EventBus();
bus.on('cellClick', (event) => console.log(event.row, event.col));
bus.off('cellClick', handler);
bus.emit('cellClick', { row: 0, col: 0, value: 'test', column: colDef });
bus.destroy(); // remove all handlers
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void` | Register typed handler |
| `on` | `(event: string, handler: EventHandler): void` | Register dynamic handler |
| `off` | `<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void` | Remove typed handler |
| `off` | `(event: string, handler: EventHandler): void` | Remove dynamic handler |
| `emit` | `<K>(event: K, ...args: Parameters<SpreadsheetEvents[K]>): void` | Dispatch event |
| `destroy` | `(): void` | Remove all handlers |

### EventTranslator

Translates DOM events (mouse, touch, keyboard) on the scroll container into typed spreadsheet events via hit-testing.

```typescript
import { EventTranslator, EventTranslatorConfig } from '@witqq/spreadsheet';

interface EventTranslatorConfig {
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  eventBus: EventBus;
  cellStore: CellStore;
  dataView: DataView;
  columns: ColumnDef[];
  rowGroupManager?: RowGroupManager;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(): void` | Attach DOM listeners (mouse, touch, keyboard) |
| `detach` | `(): void` | Remove all DOM listeners |
| `setFrozenConfig` | `(frozenRows: number, frozenCols: number): void` | Update frozen pane config for hit-testing |
| `hitTest` | `(offsetX: number, offsetY: number): HitTestResult` | Convert pixel coordinates to grid region + cell address |

### Event Types

```typescript
import type {
  SpreadsheetEvents,
  CellEvent, CellChangeEvent,
  SelectionChangeEvent, ScrollEvent,
  CommandEvent, ClipboardDataEvent,
  ColumnResizeEvent, RowResizeEvent,
  CellStatusChangeEvent, CellValidationEvent,
  GridMouseEvent, GridKeyboardEvent,
  HitTestResult, HitRegion,
  SortChangeEvent, SortRejectedEvent, FilterChangeEvent,
  AutofillStartEvent, AutofillPreviewEvent, AutofillCompleteEvent,
  RowGroupToggleEvent, RowGroupChangeEvent,
} from '@witqq/spreadsheet';
```

**`HitRegion`** — `'cell' | 'header' | 'header-sort-icon' | 'header-filter-icon' | 'row-number' | 'row-group-toggle' | 'corner' | 'outside'`

**`HitTestResult`** — `{ readonly region: HitRegion; readonly row: number; readonly col: number; readonly hitZone?: string; readonly hitZoneCursor?: string }`

**`GridMouseEvent`** extends `HitTestResult` — `{ readonly originalEvent: MouseEvent; readonly shiftKey: boolean; readonly ctrlKey: boolean }`

**`GridKeyboardEvent`** — `{ readonly originalEvent: KeyboardEvent; readonly key: string; readonly shiftKey: boolean; readonly ctrlKey: boolean }`

**`CellEvent`** — `{ row: number; col: number; value: CellValue; column: ColumnDef; hitZone?: string; hitZoneCursor?: string }`

**`CellChangeEvent`** extends `CellEvent` — `{ oldValue: CellValue; newValue: CellValue; source: string }`

**`SelectionChangeEvent`** — `{ selection: Selection; previousSelection: Selection }`

**`ScrollEvent`** — `{ scrollTop: number; scrollLeft: number }`

**`CommandEvent`** — `{ description: string }`

**`ClipboardDataEvent`** — `{ rowCount: number; colCount: number }`

**`ColumnResizeEvent`** — `{ colIndex: number; oldWidth: number; newWidth: number }`

**`RowResizeEvent`** — `{ rowIndex: number; oldHeight: number; newHeight: number }`

**`CellStatusChangeEvent`** — `{ row: number; col: number; oldStatus: CellMetadata['status'] | undefined; newStatus: CellMetadata['status'] | undefined; errorMessage?: string }`

**`CellValidationEvent`** — `{ row: number; col: number; result: ValidationResult }`

**`AutofillStartEvent`** — `{ sourceRange: CellRange }`

**`AutofillPreviewEvent`** — `{ sourceRange: CellRange; fillRange: CellRange | null; direction: FillDirection | null }`

**`AutofillCompleteEvent`** — `{ sourceRange: CellRange; fillRange: CellRange; direction: FillDirection }`

**`SortChangeEvent`** — `{ readonly sortColumns: readonly { col: number; direction: 'asc' | 'desc' }[] }`

**`SortRejectedEvent`** — `{ readonly reason: 'merged-regions-exist' }`

**`FilterChangeEvent`** — `{ readonly visibleRowCount: number; readonly totalRowCount: number }`

**`RowGroupToggleEvent`** — `{ readonly headerRow: number; readonly expanded: boolean }`

**`RowGroupChangeEvent`** — `{ readonly groupHeaders: readonly number[] }`

### SpreadsheetEvents Map

All events follow `(event: T) => void` signature. Registered via `engine.on('eventName', handler)`.

| Category | Event | Payload |
|----------|-------|---------|
| Cell | `cellClick` | `CellEvent` |
| Cell | `cellDoubleClick` | `CellEvent` |
| Cell | `cellChange` | `CellChangeEvent` |
| Selection | `selectionChange` | `SelectionChangeEvent` |
| Scroll | `scroll` | `ScrollEvent` |
| Lifecycle | `ready` | (none) |
| Lifecycle | `destroy` | (none) |
| Command | `commandExecute` | `CommandEvent` |
| Command | `commandUndo` | `CommandEvent` |
| Command | `commandRedo` | `CommandEvent` |
| Clipboard | `clipboardCopy` | `ClipboardDataEvent` |
| Clipboard | `clipboardCut` | `ClipboardDataEvent` |
| Clipboard | `clipboardPaste` | `ClipboardDataEvent` |
| Resize | `columnResize` | `ColumnResizeEvent` |
| Resize | `columnResizeStart` | `{ colIndex: number }` |
| Resize | `columnResizeEnd` | `ColumnResizeEvent` |
| Resize | `rowResize` | `RowResizeEvent` |
| Resize | `rowResizeStart` | `{ rowIndex: number }` |
| Resize | `rowResizeEnd` | `RowResizeEvent` |
| Status | `cellStatusChange` | `CellStatusChangeEvent` |
| Status | `cellValidation` | `CellValidationEvent` |
| Autofill | `autofillStart` | `AutofillStartEvent` |
| Autofill | `autofillPreview` | `AutofillPreviewEvent` |
| Autofill | `autofillComplete` | `AutofillCompleteEvent` |
| Sort | `sortChange` | `SortChangeEvent` |
| Sort | `sortRejected` | `SortRejectedEvent` |
| Filter | `filterChange` | `FilterChangeEvent` |
| Groups | `rowGroupToggle` | `RowGroupToggleEvent` |
| Groups | `rowGroupChange` | `RowGroupChangeEvent` |
| Theme | `themeChange` | `{ theme: SpreadsheetTheme }` |

Internal grid events (`gridMouseDown`, `gridMouseMove`, `gridMouseUp`, `gridMouseHover`, `gridContextMenu`, `gridKeyDown`) are emitted by `EventTranslator` and consumed by internal subsystems.

---

## Commands

### Command Interface

Core interface for the undo/redo system. Every data-modifying operation implements `Command`.

```typescript
import type { Command } from '@witqq/spreadsheet';

interface Command {
  execute(): void;
  undo(): void;
  readonly description: string;
}
```

### CommandManager

Manages command execution with bounded undo/redo stacks.

```typescript
import { CommandManager, CommandManagerConfig, CommandCallback } from '@witqq/spreadsheet';

type CommandCallback = (command: Command) => void;

interface CommandManagerConfig {
  historyLimit?: number; // default: 100
  onAfterExecute?: CommandCallback;
  onAfterUndo?: CommandCallback;
  onAfterRedo?: CommandCallback;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `(command: Command): void` | Execute command, push to undo stack, clear redo stack |
| `undo` | `(): Command \| undefined` | Undo last command |
| `redo` | `(): Command \| undefined` | Redo last undone command |
| `canUndo` | `(): boolean` | Whether undo is available |
| `canRedo` | `(): boolean` | Whether redo is available |
| `clear` | `(): void` | Clear both stacks |

**Getters:** `undoCount: number`, `redoCount: number`

### Built-in Commands

| Command | Constructor | Description |
|---------|-------------|-------------|
| `CellEditCommand` | `(cellStore, row, col, oldValue, newValue)` | Single-cell value edit |
| `BatchCellEditCommand` | `(cellStore, edits: readonly CellEdit[])` | Multi-cell edit (paste, autofill, bulk ops) |
| `ResizeColumnCommand` | `(layoutEngine, gridGeometry, colIndex, oldWidth, newWidth)` | Column width resize |
| `ResizeRowCommand` | `(layoutEngine, rowIndex, oldHeight, newHeight)` | Row height resize |
| `MergeCellsCommand` | `(mergeManager, cellStore, region, value?)` | Merge cell region (snapshots displaced cells) |
| `UnmergeCellsCommand` | `(mergeManager, cellStore, region)` | Unmerge cell region |
| `InsertRowCommand` | `(deps: RowCommandDeps, targetRow)` | Insert row, shift cells and merges down |
| `DeleteRowCommand` | `(deps: RowCommandDeps, targetRow)` | Delete row, shift cells and merges up |

```typescript
import type { CellEdit, RowCommandDeps } from '@witqq/spreadsheet';

interface CellEdit {
  readonly row: number;
  readonly col: number;
  readonly oldValue: CellValue;
  readonly newValue: CellValue;
}

interface RowCommandDeps {
  cellStore: CellStore;
  mergeManager: MergeManager | null;
  setRowCount: (count: number) => void;
  getRowCount: () => number;
}
```

`CellEditCommand` and `BatchCellEditCommand` expose `get affectedCells()` returning `ReadonlyArray<{ row, col, oldValue, newValue }>`.

---

## Sort

### SortEngine

Multi-column sort with stable ordering. Supports toggle cycling (`none → asc → desc → none`).

```typescript
import { SortEngine, SortEngineConfig, SortColumn, SortDirection, compareCellValues } from '@witqq/spreadsheet';

type SortDirection = 'asc' | 'desc';

interface SortColumn {
  readonly col: number;
  readonly direction: SortDirection;
}

interface SortEngineConfig {
  cellStore: CellStore;
  totalRowCount: number;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `isClear` | `(): boolean` | No sort columns active |
| `toggleColumn` | `(col: number, multiColumn?: boolean): SortColumn[]` | Cycle sort on column; `multiColumn` preserves other sorts |
| `setSortColumns` | `(columns: SortColumn[]): void` | Programmatically set sort columns |
| `clearSort` | `(): void` | Remove all sorts |
| `setTotalRowCount` | `(count: number): void` | Update row count |
| `computeSortedIndices` | `(physicalIndices?: number[]): number[] \| null` | Sorted row indices; `null` if no sort active |

**Getter:** `sortColumns: readonly SortColumn[]`

**`compareCellValues(a: CellValue, b: CellValue): number`** — Exported utility. `null` sorts last; type-aware comparison (numbers, strings via `localeCompare`, booleans, dates); cross-type order: `number < boolean < string`.

---

## Filter

### FilterEngine

Multi-column filtering with 14 operators. AND logic across conditions.

```typescript
import { FilterEngine, FilterEngineConfig, FilterCondition, FilterOperator, evaluateCondition } from '@witqq/spreadsheet';

type FilterOperator =
  | 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith'
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'between' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty';

interface FilterCondition {
  col: number;
  operator: FilterOperator;
  value?: CellValue;    // comparison value
  valueTo?: CellValue;  // upper bound for 'between'
  values?: CellValue[]; // for 'in' / 'notIn'
}

interface FilterEngineConfig {
  cellStore: CellStore;
  totalRowCount: number;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setColumnFilter` | `(col: number, conditions: FilterCondition[]): void` | Set filter for a column |
| `removeColumnFilter` | `(col: number): void` | Remove filter from column |
| `getColumnFilters` | `(col: number): FilterCondition[]` | Get conditions for column |
| `getFilteredColumns` | `(): Set<number>` | Columns with active filters |
| `setConditions` | `(conditions: FilterCondition[]): void` | Replace all conditions |
| `clearAll` | `(): void` | Clear all filters |
| `clearFilters` | `(): void` | Alias for `clearAll()` |
| `getVisibleRowCount` | `(): number` | Count of rows passing filters |
| `setTotalRowCount` | `(count: number): void` | Update row count |
| `computeVisibleRows` | `(): number[] \| null` | Visible row indices; `null` if no filters |

**Getters:** `conditions: readonly FilterCondition[]`, `totalRowCount: number`, `hasActiveFilters: boolean`

**`evaluateCondition(value: CellValue | null, cond: FilterCondition): boolean`** — Exported utility. Evaluates a single condition. String comparisons are case-insensitive; numeric coercion for cross-type comparisons.

### FilterPanel

DOM-based filter UI panel positioned below column headers.

```typescript
import { FilterPanel, FilterPanelConfig } from '@witqq/spreadsheet';

interface FilterPanelConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
  onApply: (col: number, operator: FilterOperator, value: string, valueTo?: string) => void;
  onClear: (col: number) => void;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `open` | `(col: number, currentOperator?, currentValue?): void` | Open panel for column, optionally pre-fill |
| `close` | `(): void` | Close panel and remove DOM |
| `setTheme` | `(theme: SpreadsheetTheme): void` | Runtime theme switch |
| `setLocale` | `(locale: ResolvedLocale): void` | Runtime locale switch |
| `destroy` | `(): void` | Alias for `close()` |

**Getters:** `isOpen: boolean`, `currentCol: number` (-1 if closed)

---

## Clipboard

### ClipboardManagerConfig

```ts
import { ClipboardManagerConfig, ClipboardManager } from '@witqq/spreadsheet';

interface ClipboardManagerConfig {
  cellStore: CellStore;
  dataView: DataView;
  selectionManager: SelectionManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  isEditing: () => boolean;
  onDataChange: () => void;
}
```

### ClipboardManager

Handles copy, cut, and paste operations through native clipboard events. Serializes data as both TSV and HTML for cross-application compatibility.

```ts
const clipboard = new ClipboardManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(scrollContainer: HTMLElement): void` | Attach copy/cut/paste keyboard listeners to the container |
| `detach` | `(): void` | Remove all clipboard listeners |
| `getSelectedData` | `(): CellValue[][]` | Read first selected range as a 2D array |

All clipboard operations are no-ops while `isEditing()` returns `true`.

**Copy** serializes the selection to TSV + HTML and emits `clipboardCopy`.
**Cut** copies then clears source cells via `BatchCellEditCommand` (undoable) and emits `clipboardCut`.
**Paste** parses HTML first (Excel/Sheets compatibility), falls back to TSV, writes starting at the active cell clipped to grid boundaries via `BatchCellEditCommand`, and emits `clipboardPaste`.

### Clipboard Serialization Functions

```ts
import {
  serializeToTSV,
  serializeToHTML,
  parseTSV,
  parseHTML,
} from '@witqq/spreadsheet';
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `serializeToTSV` | `(data: CellValue[][]): string` | Rows joined by `\n`, cells by `\t` |
| `serializeToHTML` | `(data: CellValue[][]): string` | Returns `<table>` HTML with escaped values |
| `parseTSV` | `(text: string): CellValue[][]` | Splits on `\n`/`\t`; coerces values to number, boolean, or null |
| `parseHTML` | `(html: string): CellValue[][] \| null` | Extracts `<td>`/`<th>` text via DOMParser; returns `null` if no `<table>` found |

### ClipboardDataEvent

```ts
interface ClipboardDataEvent {
  rowCount: number;
  colCount: number;
}
```

Payload for `clipboardCopy`, `clipboardCut`, and `clipboardPaste` events.

---

## Validation

### Validation Rule Types

```ts
import {
  ValidationRule,
  ValidationResult,
  SpreadsheetValidationRule,
  RequiredRule,
  RangeRule,
  RegexRule,
  CustomRule,
  ValidationEngine,
  ValidationEngineConfig,
} from '@witqq/spreadsheet';
```

**Base types:**

```ts
interface ValidationRule {
  readonly type: string;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  readonly valid: boolean;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}
```

**Built-in rule discriminated union:**

```ts
type SpreadsheetValidationRule = RequiredRule | RangeRule | RegexRule | CustomRule;
```

| Rule | `type` | Extra Fields | Behavior |
|------|--------|-------------|----------|
| `RequiredRule` | `'required'` | — | Fails if value is `null`, `undefined`, or `''` |
| `RangeRule` | `'range'` | `min?: number`, `max?: number` | Skips empty; coerces to number; fails if `NaN`, `< min`, or `> max` |
| `RegexRule` | `'regex'` | `pattern: string`, `flags?: string` | Skips empty; tests `String(value)` against `new RegExp(pattern, flags)` |
| `CustomRule` | `'custom'` | `validate: (value: CellValue) => ValidationResult` | Delegates to user function |

### ValidationEngineConfig

```ts
interface ValidationEngineConfig {
  cellStore: CellStore;
  eventBus: EventBus;
}
```

### ValidationEngine

```ts
const validation = new ValidationEngine(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setColumnRules` | `(col: number, rules: SpreadsheetValidationRule[]): void` | Set rules for all cells in a column |
| `getColumnRules` | `(col: number): SpreadsheetValidationRule[]` | Get column rules |
| `setCellRules` | `(row: number, col: number, rules: SpreadsheetValidationRule[]): void` | Set rules for a specific cell |
| `getCellRules` | `(row: number, col: number): SpreadsheetValidationRule[]` | Get cell rules |
| `removeColumnRules` | `(col: number): void` | Remove column rules |
| `removeCellRules` | `(row: number, col: number): void` | Remove cell rules |
| `hasRules` | `(row: number, col: number): boolean` | True if column or cell rules exist for this position |
| `hasAnyRules` | `(): boolean` | True if any rules registered |
| `validate` | `(row: number, col: number, value: CellValue): ValidationResult` | Run all column + cell rules; returns first failure or `{ valid: true }` |
| `validateCell` | `(row: number, col: number): ValidationResult` | Reads current value from CellStore, validates, emits `cellValidation` event |
| `validateAll` | `(rowCount: number): void` | Validate all cells with registered rules |
| `clearAllRules` | `(): void` | Remove all column and cell rules |

`validateCell` sets cell metadata to `'error'` on failure and emits `cellStatusChange`.

### CellValidationEvent

```ts
interface CellValidationEvent {
  row: number;
  col: number;
  result: ValidationResult;
}
```

Payload for the `cellValidation` event.

---

## Merge

### MergedRegion

```ts
import { MergedRegion, MergeManager } from '@witqq/spreadsheet';

interface MergedRegion {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;   // inclusive
  readonly endCol: number;   // inclusive
}
```

### MergeManager

Manages merged cell regions with O(1) cell-to-region lookup via a spatial index.

```ts
const merges = new MergeManager();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `merge` | `(region: MergedRegion): boolean` | Add a merge; returns `false` on overlap, inverted coords, or < 2 cells |
| `unmerge` | `(startRow: number, startCol: number): boolean` | Remove by anchor position; returns `false` if not found |
| `getMergedRegion` | `(row: number, col: number): MergedRegion \| null` | Region containing this cell, or `null` |
| `isAnchorCell` | `(row: number, col: number): boolean` | True if cell is the top-left of a merged region |
| `isHiddenCell` | `(row: number, col: number): boolean` | True if cell is a non-anchor cell within a merge |
| `getAllRegions` | `(): ReadonlyArray<MergedRegion>` | All active merged regions |
| `clearAll` | `(): void` | Remove all regions |
| `hasAnyRegions` | `(): boolean` | True if any merges exist |
| `validateMerge` | `(region: MergedRegion, frozenRows: number, frozenCols: number): string \| null` | Returns error string or `null` (checks size, overlap, frozen pane crossings) |

---

## Context Menu

### Types

```ts
import {
  ContextMenuManager,
  ContextMenuItem,
  ContextMenuManagerConfig,
  MenuContext,
  MenuActionContext,
  createDefaultMenuItems,
} from '@witqq/spreadsheet';

type MenuContext = 'cell' | 'header' | 'row-number' | 'corner';

interface MenuActionContext {
  readonly row: number;
  readonly col: number;
  readonly region: string;
  readonly engine: SpreadsheetEngine;
}

interface ContextMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly shortcut?: string;
  readonly separator?: boolean;
  readonly contexts: ReadonlyArray<MenuContext>;
  readonly submenu?: ReadonlyArray<ContextMenuItem>;
  action?: (ctx: MenuActionContext) => void;
  isDisabled?: (ctx: MenuActionContext) => boolean;
  isVisible?: (ctx: MenuActionContext) => boolean;
}
```

### ContextMenuManagerConfig

```ts
interface ContextMenuManagerConfig {
  container: HTMLElement;
  engine: SpreadsheetEngine;
  eventBus: EventBus;
  theme: SpreadsheetTheme;
}
```

### ContextMenuManager

Subscribes to `gridContextMenu` events on construction. Renders a DOM-based context menu.

```ts
const menu = new ContextMenuManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `registerItem` | `(item: ContextMenuItem): void` | Register a menu item by id |
| `unregisterItem` | `(id: string): void` | Remove a menu item by id |
| `getItems` | `(): ReadonlyMap<string, ContextMenuItem>` | All registered items |
| `setTheme` | `(theme: SpreadsheetTheme): void` | Update theme at runtime |
| `setLocale` | `(locale: ResolvedLocale): void` | Replace default items with localized strings |
| `close` | `(): void` | Close menu if open |
| `destroy` | `(): void` | Full cleanup; unsubscribes from eventBus |

**Getter:** `isOpen: boolean`

### createDefaultMenuItems

```ts
function createDefaultMenuItems(locale?: ResolvedLocale): ContextMenuItem[]
```

Returns 8 default menu items:

| ID | Label | Contexts |
|----|-------|----------|
| `cut` | "Cut" | cell, header, row-number |
| `copy` | "Copy" | cell, header, row-number |
| `paste` | "Paste" | cell |
| `sort-asc` | "Sort Ascending" | header |
| `sort-desc` | "Sort Descending" | header |
| `insert-row-above` | "Insert Row Above" | row-number |
| `insert-row-below` | "Insert Row Below" | row-number |
| `delete-row` | "Delete Row" | row-number |

Labels are overridable via `locale.contextMenu` properties. The `paste` item is disabled when `navigator.clipboard.readText` is unavailable.

---

## Row Grouping

### Types

```ts
import {
  RowGroupManager,
  RowGroupDef,
  ColumnAggregate,
  AggregateFunction,
  AggregateResult,
} from '@witqq/spreadsheet';

type AggregateFunction = 'sum' | 'count' | 'average' | 'min' | 'max' | 'none';

interface ColumnAggregate {
  col: number;
  fn: AggregateFunction;
}

interface RowGroupDef {
  headerRow: number;
  childRows: number[];
  expanded?: boolean;  // default true
}

interface AggregateResult {
  row: number;
  col: number;
  value: number | string;
  label: string;  // e.g. "Sum: 42"
}
```

### RowGroupManager

```ts
const groups = new RowGroupManager();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setCellStore` | `(cellStore: CellStore): void` | Set CellStore reference for aggregate computation |
| `setLocale` | `(locale: ResolvedLocale): void` | Set locale for aggregate labels |
| `setAggregates` | `(aggregates: ColumnAggregate[]): void` | Configure per-column aggregate functions |
| `getAggregates` | `(): readonly ColumnAggregate[]` | Current aggregate configuration |
| `setGroups` | `(groups: RowGroupDef[]): void` | Replace all groups; throws if a child belongs to multiple groups |
| `hasGroups` | `(): boolean` | Any groups defined |
| `getGroup` | `(headerRow: number): { expanded: boolean; childRows: number[] } \| undefined` | Internal group state for a header row |
| `isGroupHeader` | `(physicalRow: number): boolean` | Is this row a group header |
| `isGroupChild` | `(physicalRow: number): boolean` | Is this row a child of any group |
| `getParentHeader` | `(physicalRow: number): number \| undefined` | Parent header for a child row |
| `getDepth` | `(headerRow: number): number` | Nesting depth (top-level = 0) |
| `isExpanded` | `(headerRow: number): boolean` | Is group expanded |
| `isHiddenByAncestor` | `(physicalRow: number): boolean` | Is row hidden by any collapsed ancestor |
| `toggleGroup` | `(headerRow: number): boolean` | Toggle expand/collapse; returns new expanded state |
| `expandGroup` | `(headerRow: number): void` | Expand a specific group |
| `collapseGroup` | `(headerRow: number): void` | Collapse a specific group |
| `expandAll` | `(): void` | Expand all groups |
| `collapseAll` | `(): void` | Collapse all groups |
| `getGroupHeaders` | `(): number[]` | All header row indices |
| `getAllGroups` | `(): ReadonlyMap<number, { expanded: boolean; childRows: number[] }>` | All group states |
| `getLeafDescendants` | `(headerRow: number): number[]` | All non-header descendants (recursive) |
| `filterCollapsed` | `(physicalIndices: number[]): number[]` | Filter out rows hidden by collapsed groups |
| `computeAggregates` | `(headerRow: number): AggregateResult[]` | Compute aggregates for a header using leaf descendants |
| `clear` | `(): void` | Clear all groups |

---

## Pivot

### Types

```ts
import {
  PivotEngine,
  PivotConfig,
  PivotMeasure,
  PivotAggregateFunction,
  PivotResult,
  PivotColumnDef,
} from '@witqq/spreadsheet';

type PivotAggregateFunction = 'sum' | 'count' | 'average' | 'min' | 'max';

interface PivotMeasure {
  field: string;
  aggregate: PivotAggregateFunction;
  label?: string;  // defaults to "aggregate(field)"
}

interface PivotConfig {
  rowDimensions: string[];
  columnDimensions: string[];
  measures: PivotMeasure[];
}

interface PivotColumnDef {
  readonly key: string;
  readonly title: string;
  readonly width: number;
  readonly type?: CellType;
  readonly frozen?: boolean;
  readonly editable?: boolean;
}

interface PivotResult {
  columns: PivotColumnDef[];
  rows: Record<string, unknown>[];
  frozenColumns: number;  // equals rowDimensions.length
  sourceRowIndices: Map<string, number[]>;  // "outputRow:outputCol" → source indices
}
```

### PivotEngine

Transforms flat tabular data into a pivot table with row/column dimensions and aggregated measures.

```ts
const pivot = new PivotEngine();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `compute` | `(sourceData: Record<string, unknown>[], config: PivotConfig): PivotResult` | Compute pivot table; throws if `measures` is empty |
| `getDrillDownRows` | `(sourceData: Record<string, unknown>[], result: PivotResult, outputRow: number, outputCol: number): Record<string, unknown>[]` | Get source rows contributing to a specific output cell |

**Drill-down** uses `sourceRowIndices` from the result to map any output cell back to the original data rows.

---

## Autofill

### Types

```ts
import {
  AutofillManager,
  AutofillManagerConfig,
  FillDirection,
  detectPattern,
  extendPattern,
  DetectedPattern,
  PatternType,
} from '@witqq/spreadsheet';

type FillDirection = 'down' | 'up' | 'right' | 'left';

type PatternType = 'number-sequence' | 'number-increment' | 'date-sequence' | 'text-repeat';

interface DetectedPattern {
  readonly type: PatternType;
  readonly step: number;
  readonly sourceValues: readonly CellValue[];
}
```

### AutofillManagerConfig

```ts
interface AutofillManagerConfig {
  cellStore: CellStore;
  dataView: DataView;
  selectionManager: SelectionManager;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  dirtyTracker: DirtyTracker;
  renderScheduler: RenderScheduler;
  container: HTMLElement;
  rowCount: number;
  colCount: number;
  mergeManager?: MergeManager;
}
```

### AutofillManager

Handles cell fill-handle drag to extend selection values using detected patterns.

```ts
const autofill = new AutofillManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(scrollContainer: HTMLElement): void` | Bind mousedown/mousemove to container |
| `detach` | `(): void` | Remove listeners, clean up drag state |
| `getFillRange` | `(): CellRange \| null` | Current fill preview range |
| `getFillDirection` | `(): FillDirection \| null` | Current fill direction |
| `getHandlePosition` | `(): { x: number; y: number } \| null` | Pixel position of fill handle; `null` if no selection |
| `isOnHandle` | `(offsetX: number, offsetY: number): boolean` | Hit-test within fill handle zone |

**Getter:** `isDragging: boolean`

Fill operations create a `BatchCellEditCommand` (undoable). Emits `autofillStart`, `autofillPreview`, and `autofillComplete` events.

### Pattern Detection Functions

```ts
function detectPattern(values: readonly CellValue[]): DetectedPattern
```

Detection priority: number sequence → date sequence → text repeat (fallback).

```ts
function extendPattern(pattern: DetectedPattern, count: number): CellValue[]
```

Produces `count` new values continuing the pattern. Number sequences add `step × i`, date sequences add `interval × i`, text repeat cycles through source values.

### Autofill Events

```ts
interface AutofillStartEvent {
  sourceRange: CellRange;
}

interface AutofillPreviewEvent {
  sourceRange: CellRange;
  fillRange: CellRange | null;
  direction: FillDirection | null;
}

interface AutofillCompleteEvent {
  sourceRange: CellRange;
  fillRange: CellRange;
  direction: FillDirection;
}
```

**Internal constant:** `HANDLE_SIZE = 7` (pixel size of fill handle square, not exported from package entry point)

---

## Resize

### ColumnResizeManagerConfig

```ts
import {
  ColumnResizeManager,
  ColumnResizeManagerConfig,
  ColumnStretchManager,
  ColumnStretchConfig,
  StretchMode,
  RowResizeManager,
  RowResizeManagerConfig,
} from '@witqq/spreadsheet';

interface ColumnResizeManagerConfig {
  layoutEngine: LayoutEngine;
  gridGeometry: GridGeometry;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  columns: ColumnDef[];
  container: HTMLElement;
  onResize: () => void;
}
```

### ColumnResizeManager

Handles column width resizing by dragging the right border of header cells.

```ts
const colResize = new ColumnResizeManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(scrollContainer: HTMLElement): void` | Attach mousedown/mousemove listeners |
| `detach` | `(): void` | Remove listeners, clean up |
| `getResizeColumnAt` | `(offsetX: number, offsetY: number): number` | Column index at mouse position, or `-1` |

**Getter:** `isDragging: boolean`

Creates `ResizeColumnCommand` on drag end. Emits `columnResizeStart`, `columnResize`, `columnResizeEnd`. Respects `minWidth`/`maxWidth` from `ColumnDef`.

### ColumnStretchManager

Distributes remaining container width across columns.

```ts
import { ColumnStretchManager, ColumnStretchConfig, StretchMode } from '@witqq/spreadsheet';

type StretchMode = 'all' | 'last';

interface ColumnStretchConfig {
  mode: StretchMode;
}
```

```ts
const stretch = new ColumnStretchManager(config, applyWidths);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `markManualResize` | `(visibleColIndex: number): void` | Exclude column from stretch |
| `clearManualResizes` | `(): void` | Reset manual resize marks |
| `calculate` | `(columns: ColumnDef[], containerWidth: number, frozenColumns: number, currentWidths: (colIndex: number) => number): Map<number, number> \| null` | Returns width map or `null` |
| `recalculate` | `(columns: ColumnDef[], containerWidth: number, frozenColumns: number, currentWidths: (colIndex: number) => number): void` | Calculate then apply |
| `destroy` | `(): void` | Clear state |

**Getter:** `isDestroyed: boolean`

Mode `'all'` distributes extra space evenly (excluding frozen and manually resized columns). Mode `'last'` gives all remaining space to the last column.

### RowResizeManagerConfig

```ts
interface RowResizeManagerConfig {
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  container: HTMLElement;
  onResize: () => void;
}
```

### RowResizeManager

Handles row height resizing by dragging the bottom border of row-number cells.

```ts
const rowResize = new RowResizeManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `attach` | `(scrollContainer: HTMLElement): void` | Attach mousedown/mousemove listeners |
| `detach` | `(): void` | Remove listeners, clean up |
| `getResizeRowAt` | `(offsetX: number, offsetY: number): number` | Row index at mouse position, or `-1` |

**Getter:** `isDragging: boolean`

Creates `ResizeRowCommand` on drag end. Emits `rowResizeStart`, `rowResize`, `rowResizeEnd`. Clamps height to `[12, 400]`.

### Resize Events

```ts
interface ColumnResizeEvent {
  colIndex: number;
  oldWidth: number;
  newWidth: number;
}

interface RowResizeEvent {
  rowIndex: number;
  oldHeight: number;
  newHeight: number;
}
```

---

## Tooltip

### TooltipManagerConfig

```ts
import { TooltipManager, TooltipManagerConfig } from '@witqq/spreadsheet';

interface TooltipManagerConfig {
  container: HTMLElement;
  eventBus: EventBus;
  cellStore: CellStore;
  dataView: DataView;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
}
```

### TooltipManager

Shows error-message tooltips on hover over cells with `metadata.status === 'error'`. Listens for `gridMouseHover` events.

```ts
const tooltip = new TooltipManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setTheme` | `(theme: SpreadsheetTheme): void` | Update theme at runtime |
| `destroy` | `(): void` | Unsubscribe from events, remove DOM element |

---

## Themes

### SpreadsheetTheme

```ts
import { SpreadsheetTheme, lightTheme, darkTheme } from '@witqq/spreadsheet';

interface SpreadsheetTheme {
  name: string;
  colors: {
    gridLine: string;
    background: string;
    headerBackground: string;
    headerText: string;
    headerBorder: string;
    selectionFill: string;
    selectionBorder: string;
    activeCellBorder: string;
    fillHandle: string;
    cellText: string;
    cellBorder: string;
    cellEditBackground: string;
    alternateRowBackground: string;
    hoverRowBackground: string;
    frozenSeparator: string;
    scrollbarTrack: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
    errorBackground: string;
    warningBackground: string;
    changedIndicator: string;
    savedIndicator: string;
    cellPlaceholder: string;
  };
  fonts: {
    cell: string;
    header: string;
    cellSize: number;
    headerSize: number;
  };
  dimensions: {
    rowHeight: number;
    headerHeight: number;
    minColumnWidth: number;
    scrollbarWidth: number;
    cellPadding: number;
    borderWidth: number;
    rowNumberWidth: number;
  };
  borders: {
    gridLineWidth: number;
    selectionWidth: number;
    activeCellWidth: number;
    frozenPaneWidth: number;
  };
}
```

### Built-in Themes

```ts
const lightTheme: SpreadsheetTheme  // name: 'light'
const darkTheme: SpreadsheetTheme   // name: 'dark'
```

Both share identical `fonts`, `dimensions`, and `borders`:
- **fonts:** `cell`/`header` = `'Arial, sans-serif'`, `cellSize`/`headerSize` = `13`
- **dimensions:** `rowHeight` 28, `headerHeight` 32, `minColumnWidth` 40, `scrollbarWidth` 14, `cellPadding` 4, `borderWidth` 1, `rowNumberWidth` 50
- **borders:** `gridLineWidth` 1, `selectionWidth` 2, `activeCellWidth` 2, `frozenPaneWidth` 2

---

## Locale

### SpreadsheetLocale

```ts
import {
  SpreadsheetLocale,
  ResolvedLocale,
  resolveLocale,
  enLocale,
  ruLocale,
} from '@witqq/spreadsheet';
```

All fields are optional — missing values fall back to English defaults.

```ts
interface SpreadsheetLocale {
  formatLocale?: string;  // BCP 47 tag, e.g. 'en-US'
  contextMenu?: {
    cut?: string; copy?: string; paste?: string;
    sortAscending?: string; sortDescending?: string;
    insertRowAbove?: string; insertRowBelow?: string; deleteRow?: string;
  };
  datePicker?: {
    weekLabels?: [string, string, string, string, string, string, string];
    monthNames?: [string, string, string, string, string, string,
                  string, string, string, string, string, string];
    today?: string; ariaLabel?: string;
  };
  dateTimePicker?: {
    hour?: string; minute?: string; now?: string; ariaLabel?: string;
  };
  filter?: {
    equals?: string; notEquals?: string; contains?: string;
    startsWith?: string; endsWith?: string;
    greaterThan?: string; lessThan?: string;
    greaterOrEqual?: string; lessOrEqual?: string;
    between?: string; isEmpty?: string; isNotEmpty?: string;
    valuePlaceholder?: string; toValuePlaceholder?: string;
    apply?: string; clear?: string;
  };
  grouping?: {
    sum?: string; count?: string; avg?: string; min?: string; max?: string;
  };
  emptyState?: { noData?: string };
  print?: { showingRows?: string };      // template: "{shown} of {total}"
  aria?: {
    cellAnnouncement?: string;           // template: "{column}, Row {row}: {value}"
    cellEmpty?: string;
    sortCleared?: string; sortAscending?: string; sortDescending?: string;
    sortedBy?: string;                   // template: "{columns}"
    filterCleared?: string;
    filterActive?: string;               // template: "{visible} of {total}"
  };
}
```

### ResolvedLocale

```ts
type ResolvedLocale = Required<SpreadsheetLocale>;
```

All optional fields become required — guaranteed no `undefined` values at runtime.

### resolveLocale

```ts
function resolveLocale(locale?: SpreadsheetLocale): ResolvedLocale
```

Deep-merges a partial locale over `enLocale` defaults.

### Built-in Locales

```ts
const enLocale: Required<SpreadsheetLocale>  // formatLocale: 'en-US'
const ruLocale: Required<SpreadsheetLocale>  // formatLocale: 'ru-RU'
```

---

## Streaming

### StreamingAdapterOptions

```ts
import { StreamingAdapter, StreamingAdapterOptions } from '@witqq/spreadsheet';

interface StreamingAdapterOptions {
  throttleMs?: number;    // batch window in ms (default: 100)
  columnKeys: string[];   // column keys matching engine column indices
}
```

### StreamingAdapter

Bridges external data sources to the spreadsheet engine with throttled batch updates.

```ts
const stream = new StreamingAdapter(engine, options);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `pushRows` | `(rows: Record<string, unknown>[]): void` | Append rows to end of grid |
| `updateRow` | `(index: number, data: Record<string, unknown>): void` | Update existing row at logical index |
| `deleteRow` | `(index: number): void` | Delete row at logical index |
| `flush` | `(): void` | Immediately flush pending updates |
| `dispose` | `(): void` | Flush and prevent further scheduling |

**Getter:** `disposed: boolean`

---

## Print

### PrintManagerConfig

```ts
import { PrintManager, PrintManagerConfig } from '@witqq/spreadsheet';

interface PrintManagerConfig {
  container: HTMLElement;
  cellStore: CellStore;
  dataView: DataView;
  columns: ColumnDef[];
  rowStore: RowStore;
  theme: SpreadsheetTheme;
  maxPrintRows?: number;  // default: 10000
}
```

### PrintManager

Generates a DOM table from visible data and triggers browser print dialog.

```ts
const print = new PrintManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setLocale` | `(locale: ResolvedLocale): void` | Set locale for print labels |
| `attach` | `(): void` | Inject `@media print` CSS |
| `detach` | `(): void` | Remove print CSS |
| `print` | `(): void` | Generate print table, hide canvas, call `window.print()` |

---

## Benchmark

### Types

```ts
import {
  BenchmarkRunner,
  BenchmarkResult,
  BenchmarkMetric,
  BenchmarkSuiteResult,
  FPSCounter,
  FPSResult,
  TimingResult,
  RunStats,
  measureInitTime,
  measureMultiRun,
  measureThroughput,
  computeStats,
} from '@witqq/spreadsheet';

interface BenchmarkResult {
  initTimeMs: number;
  memoryMB?: number;
  rowCount: number;
  columnCount: number;
}

interface TimingResult {
  timeMs: number;
}

interface FPSResult {
  avgFPS: number;
  minFPS: number;
  maxFPS: number;
  frameCount: number;
  durationMs: number;
}

interface RunStats {
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  cv: number;        // coefficient of variation (stddev/mean)
  runs: number[];
}

interface BenchmarkMetric {
  name: string;
  dataset: string;   // e.g. "1K", "10K"
  stats: RunStats;
  unit: string;
}

interface BenchmarkSuiteResult {
  timestamp: string;
  metrics: BenchmarkMetric[];
}
```

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `measureInitTime` | `(factory: () => void): TimingResult` | Time a synchronous function |
| `measureMultiRun` | `(fn: () => void, runs?: number): RunStats` | Run N times (+ 1 warmup), return stats |
| `computeStats` | `(times: number[]): RunStats` | Compute statistical summary from timing array |
| `measureThroughput` | `(fn: () => void, iterations: number): { opsPerSec: number; totalMs: number }` | Operations per second measurement |

### FPSCounter

```ts
const fps = new FPSCounter();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `(): void` | Reset and begin counting |
| `tick` | `(): void` | Call on each requestAnimationFrame |
| `stop` | `(): FPSResult` | Stop and return FPS statistics |

### BenchmarkRunner

```ts
const runner = new BenchmarkRunner();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `record` | `(name: string, dataset: string, stats: RunStats, unit?: string): void` | Record a metric |
| `toJSON` | `(): BenchmarkSuiteResult` | Get all metrics as structured result |
| `reset` | `(): void` | Clear all collected metrics |

---

## ARIA Accessibility

### AriaManagerConfig

```ts
import { AriaManager, AriaManagerConfig } from '@witqq/spreadsheet';

interface AriaManagerConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  eventBus: EventBus;
  cellStore: CellStore;
  dataView: DataView;
  columns: ColumnDef[];
  rowCount: number;
}
```

### AriaManager

Provides screen reader support via ARIA attributes and a hidden live region for announcements.

```ts
const aria = new AriaManager(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setLocale` | `(locale: ResolvedLocale): void` | Set locale for announcements |
| `attach` | `(): void` | Set ARIA attributes on container, create live region, subscribe to events |
| `detach` | `(): void` | Remove ARIA attributes, remove live region, unsubscribe |
| `announce` | `(message: string): void` | Announce message to screen readers |
| `getLiveRegionText` | `(): string` | Current live region text (for testing) |

Subscribes to `selectionChange`, `sortChange`, `filterChange`, and `cellValidation` events. Announces cell content on selection change using the locale template `"{column}, Row {row}: {value}"`.

---

## Change Tracking

### ChangeTrackerConfig

```ts
import { ChangeTracker, ChangeTrackerConfig } from '@witqq/spreadsheet';

interface ChangeTrackerConfig {
  cellStore: CellStore;
  eventBus: EventBus;
}
```

### ChangeTracker

Tracks cell changes relative to a captured baseline, enabling "changed" / "saved" visual indicators.

```ts
const tracker = new ChangeTracker(config);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `captureBaseline` | `(): void` | Snapshot current cell values as the baseline |
| `handleCommandExecute` | `(command: Command): void` | Track changes from command execution |
| `handleCommandUndo` | `(command: Command): void` | Track changes from undo |
| `handleCommandRedo` | `(command: Command): void` | Track changes from redo |
| `setCellStatus` | `(row: number, col: number, status: CellMetadata['status'], errorMessage?: string): void` | Set cell metadata status and emit `cellStatusChange` |
| `getCellStatus` | `(row: number, col: number): CellMetadata['status'] \| undefined` | Get cell status |
| `getChangedCells` | `(): Array<{ row: number; col: number }>` | All cells changed since baseline |
| `clearChanges` | `(): void` | Clear all tracked changes |

---

## Auto Row Size

### Types

```ts
import {
  AutoRowSizeManager,
  AutoRowSizeConfig,
  ApplyHeightsCallback,
} from '@witqq/spreadsheet';

interface AutoRowSizeConfig {
  batchSize?: number;      // batch size for async measurement (default: 100)
  minRowHeight?: number;   // minimum row height (default: 28)
  cellPadding?: number;    // vertical padding per row (default: 8)
}

type ApplyHeightsCallback = (updates: Map<number, number>) => void;
```

### AutoRowSizeManager

Measures cell content height and auto-sizes rows. Supports both synchronous viewport measurement and asynchronous progressive measurement using `requestIdleCallback`.

```ts
const autoSize = new AutoRowSizeManager(config, applyHeights);
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setLayers` | `(layers: RenderLayer[]): void` | Set render layers for height measurement |
| `markDirtyRows` | `(rows: Iterable<number>): void` | Mark specific rows for re-measurement |
| `markAllDirty` | `(): void` | Mark all rows for re-measurement |
| `clearDirty` | `(): void` | Clear dirty state |
| `isRowDirty` | `(row: number): boolean` | Check if a specific row needs measurement |
| `measureViewport` | `(rc: RenderContext, rowStore: RowStore): number` | Measure visible rows synchronously; returns count |
| `startAsyncMeasurement` | `(totalRows: number, buildRenderContext: (startRow: number, endRow: number) => RenderContext \| null, rowStore: RowStore): void` | Start progressive background measurement |
| `startDirtyMeasurement` | `(buildRenderContext: (startRow: number, endRow: number) => RenderContext \| null, rowStore: RowStore): void` | Start async measurement for dirty rows only (more efficient than full sweep) |
| `cancelAsyncMeasurement` | `(): void` | Cancel ongoing async measurement |
| `destroy` | `(): void` | Cancel measurement, clear state |

**Getters:** `hasDirtyRows: boolean`, `dirtyRowCount: number`, `isAllDirty: boolean`, `isMeasuring: boolean`, `progress: number` (0–1)

---

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.dev/pricing](https://spreadsheet.witqq.dev/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
