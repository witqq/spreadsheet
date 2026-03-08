# @witqq/spreadsheet-plugins

Plugins for `@witqq/spreadsheet`. Peer dependency on `@witqq/spreadsheet`.

```bash
npm install @witqq/spreadsheet-plugins @witqq/spreadsheet
```

## Exports

### Value Exports (25)

| Export | Kind | Plugin |
|--------|------|--------|
| `createContextMenuPlugin` | function | Context Menu |
| `registerMenuItem` | function | Context Menu |
| `unregisterMenuItem` | function | Context Menu |
| `CONTEXT_MENU_PLUGIN_NAME` | `"context-menu"` | Context Menu |
| `FormulaPlugin` | class | Formula |
| `FORMULA_PLUGIN_NAME` | `"formula"` | Formula |
| `evaluateFormula` | function | Formula |
| `ConditionalFormattingPlugin` | class | Conditional Format |
| `ConditionalFormatLayer` | class | Conditional Format |
| `CONDITIONAL_FORMAT_PLUGIN_NAME` | `"conditional-format"` | Conditional Format |
| `ICON_SETS` | const object | Conditional Format |
| `toNumber` | function | Conditional Format |
| `evaluateComparison` | function | Conditional Format |
| `interpolateColor` | function | Conditional Format |
| `ExcelPlugin` | class | Excel |
| `EXCEL_PLUGIN_NAME` | `"excel"` | Excel |
| `CollaborationPlugin` | class | Collaboration |
| `otTransform` | function | Collaboration |
| `transformAgainstAll` | function | Collaboration |
| `MockTransport` | class | Collaboration |
| `WebSocketTransport` | class | Collaboration |
| `RemoteCursorLayer` | class | Collaboration |
| `ProgressiveLoaderPlugin` | class | Progressive Loader |
| `ProgressOverlay` | class | Progressive Loader |
| `PROGRESSIVE_LOADER_PLUGIN_NAME` | `"progressive-loader"` | Progressive Loader |

### Type Exports (15)

| Type | Plugin |
|------|--------|
| `ContextMenuPluginState` | Context Menu |
| `ExcelImportResult` | Excel |
| `ExcelExportOptions` | Excel |
| `CollaborationPluginConfig` | Collaboration |
| `TransformResult` | Collaboration |
| `OTOperation` | Collaboration |
| `SetCellValueOp` | Collaboration |
| `InsertRowOp` | Collaboration |
| `DeleteRowOp` | Collaboration |
| `VersionedOperation` | Collaboration |
| `OTTransport` | Collaboration |
| `WebSocketTransportConfig` | Collaboration |
| `CursorInfo` | Collaboration |
| `RemoteCursor` | Collaboration |
| `ProgressiveLoaderConfig` | Progressive Loader |

---

## Context Menu Plugin

Wraps the built-in `ContextMenuManager` as a `SpreadsheetPlugin`. Provides registration API for other plugins to add custom menu items.

### Registration

```typescript
import { createContextMenuPlugin } from '@witqq/spreadsheet-plugins';
import type { ContextMenuItem } from '@witqq/spreadsheet';

// Pass initial items at creation (optional)
const items: ContextMenuItem[] = [
  { id: 'copy-cell', label: 'Copy', action: (ctx) => { /* ... */ } },
];
const plugin = createContextMenuPlugin(items);
engine.installPlugin(plugin);
```

### `createContextMenuPlugin(items?: ContextMenuItem[]): SpreadsheetPlugin`

Factory function. Returns a `SpreadsheetPlugin` with `name: "context-menu"`.

- `items` — optional initial `ContextMenuItem[]` to register on install.
- On install: registers all initial items via `engine.registerContextMenuItem()`.
- On destroy: unregisters all tracked items via `engine.unregisterContextMenuItem()`.

### `registerMenuItem(api: PluginAPI, item: ContextMenuItem): void`

Register an additional menu item after plugin installation. Throws `"Context menu plugin is not installed"` if plugin is not installed.

### `unregisterMenuItem(api: PluginAPI, itemId: string): void`

Unregister a menu item by ID. Throws `"Context menu plugin is not installed"` if plugin is not installed.

### `ContextMenuPluginState`

```typescript
interface ContextMenuPluginState {
  registeredItems: string[];  // IDs of all registered items
}
```

Stored via `api.setPluginState<ContextMenuPluginState>('state', state)`.

---

## Formula Plugin

Spreadsheet formula engine with tokenizer, parser, evaluator, and dependency graph. Supports synchronous evaluation (default) and Web Worker offloading.

### Registration

```typescript
import { FormulaPlugin } from '@witqq/spreadsheet-plugins';

// Sync mode (default)
const plugin = new FormulaPlugin();
engine.installPlugin(plugin);

// Worker mode
const worker = new Worker(new URL('./formula-worker.js', import.meta.url));
const plugin = new FormulaPlugin({ worker });
engine.installPlugin(plugin);

// Set formula — plugin evaluates automatically
engine.setCellValue(0, 2, '=SUM(A1:B1)');
```

### `new FormulaPlugin(options?: FormulaPluginOptions)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `worker` | `Worker` | — | Pre-created Worker for off-main-thread evaluation |
| `syncOnly` | `boolean` | `false` | Force synchronous mode even if Worker provided |

### Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `isUsingWorker` | `(): boolean` | Whether currently using Web Worker for evaluation |
| `getDependencyGraph` | `(): DependencyGraph` | Get the dependency graph (sync mode only) |

### Behavior

- Listens to `cellChange`, `commandUndo`, `commandRedo` events on the engine EventBus.
- When a cell value starts with `=`: tokenizes, parses, extracts dependencies, evaluates, stores result.
- Circular references detected via `DependencyGraph.setDependencies()` — returns `#REF!`.
- After evaluation, cascades to all dependent cells in topological order.
- On undo/redo: full recalculation of all formula cells.
- Worker mode: falls back to sync on Worker error.

### `evaluateFormula(formula: string, resolver: CellValueResolver): FormulaResult`

Standalone evaluation function. Strips leading `=`, tokenizes, parses, evaluates.

```typescript
import { evaluateFormula } from '@witqq/spreadsheet-plugins';

const resolver = {
  getCellValue(row: number, col: number): unknown {
    return data[row]?.[col] ?? null;
  },
};
const result = evaluateFormula('=SUM(A1:A10)', resolver);
```

**Return type:** `FormulaResult = number | string | boolean | FormulaError`

### Supported Functions (19)

| Category | Functions |
|----------|-----------|
| Math | `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MIN`, `MAX`, `ABS`, `ROUND` |
| Logic | `IF`, `AND`, `OR`, `NOT` |
| Text | `CONCATENATE`, `LEN`, `UPPER`, `LOWER`, `LEFT`, `RIGHT` |
| Date | `TODAY` |

**Operators:** `+`, `-`, `*`, `/`, `^`, `&` (concatenation), `=`, `<>`, `<`, `>`, `<=`, `>=`, `%` (percent)

**Cell references:** `A1`, `$A$1` (absolute), `A1:B10` (range)

### Formula Types

```typescript
interface CellValueResolver {
  getCellValue(row: number, col: number): unknown;
}

type FormulaResult = number | string | boolean | FormulaError;

enum FormulaErrorType {
  REF   = '#REF!',
  VALUE = '#VALUE!',
  DIV0  = '#DIV/0!',
  NAME  = '#NAME?',
  NUM   = '#NUM!',
  NULL  = '#NULL!',
}
```

> `FormulaError`, `FormulaErrorType`, and other formula internals (`tokenize`, `parse`, `evaluate`, `DependencyGraph`, AST node types) are exported from the formula sub-package but **not** from the top-level barrel. They are available if you import directly from the build output.

---

## Conditional Formatting Plugin

Renders cell backgrounds, data bars, and icon sets based on rules. Uses a custom `RenderLayer` with source-over compositing.

### Registration

```typescript
import { ConditionalFormattingPlugin } from '@witqq/spreadsheet-plugins';

const plugin = new ConditionalFormattingPlugin();
engine.installPlugin(plugin);
```

### Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addRule` | `(rule: ConditionalFormatRule): void` | Add a formatting rule |
| `removeRule` | `(ruleId: string): void` | Remove rule by ID |
| `clearRules` | `(): void` | Remove all rules |
| `getRules` | `(): readonly ConditionalFormatRule[]` | Get current rules |
| `getLayer` | `(): ConditionalFormatLayer \| null` | Get the render layer |

### Static Factory Methods

Four convenience methods that create `ConditionalFormatRule` objects:

#### `ConditionalFormattingPlugin.createValueRule(range, operator, value, bgColor, options?)`

```typescript
const rule = ConditionalFormattingPlugin.createValueRule(
  { startRow: 0, startCol: 1, endRow: 99, endCol: 1 },
  'greaterThan',
  50,
  '#c6efce',
  { textColor: '#006100', priority: 1, stopIfTrue: true, value2: 100 },
);
plugin.addRule(rule);
```

| Param | Type | Description |
|-------|------|-------------|
| `range` | `CellRange` | `{ startRow, startCol, endRow, endCol }` |
| `operator` | `ComparisonOperator` | See operators below |
| `value` | `number` | Threshold value |
| `bgColor` | `string` | Background color (hex) |
| `options.value2` | `number` | Second value for `between`/`notBetween` |
| `options.priority` | `number` | Rule priority (lower = first) |
| `options.textColor` | `string` | Text color (hex) |
| `options.stopIfTrue` | `boolean` | Stop processing subsequent rules |

**`ComparisonOperator`:** `'greaterThan'` | `'lessThan'` | `'greaterThanOrEqual'` | `'lessThanOrEqual'` | `'equal'` | `'notEqual'` | `'between'` | `'notBetween'`

#### `ConditionalFormattingPlugin.createGradientScale(range, stops, options?)`

```typescript
const rule = ConditionalFormattingPlugin.createGradientScale(
  { startRow: 0, startCol: 2, endRow: 99, endCol: 2 },
  [
    { value: 0, color: '#ff0000' },
    { value: 50, color: '#ffff00' },
    { value: 100, color: '#00ff00' },
  ],
);
plugin.addRule(rule);
```

Renders cells with interpolated background color at 50% opacity.

#### `ConditionalFormattingPlugin.createDataBar(range, color, options?)`

```typescript
const rule = ConditionalFormattingPlugin.createDataBar(
  { startRow: 0, startCol: 3, endRow: 99, endCol: 3 },
  '#3b82f6',
  { minValue: 0, maxValue: 100, showValue: true },
);
plugin.addRule(rule);
```

Renders horizontal bar at 30% opacity proportional to cell value.

#### `ConditionalFormattingPlugin.createIconSet(range, iconSet, options?)`

```typescript
const rule = ConditionalFormattingPlugin.createIconSet(
  { startRow: 0, startCol: 4, endRow: 99, endCol: 4 },
  'arrows',
  { showValue: false },
);
plugin.addRule(rule);
```

### `ICON_SETS`

Built-in icon set definitions:

| Set | Icons | Thresholds |
|-----|-------|------------|
| `arrows` | `▲` `▶` `▼` | 67, 33, 0 |
| `circles` | `🟢` `🟡` `🔴` | 67, 33, 0 |
| `flags` | `🟩` `🟨` `🟥` | 67, 33, 0 |
| `stars` | `★★★` `★★☆` `★☆☆` `☆☆☆` | 80, 60, 40, 0 |

### Helper Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `toNumber` | `(value: CellValue): number \| null` | Convert cell value to number |
| `evaluateComparison` | `(cellValue: CellValue, operator: ComparisonOperator, threshold: number, threshold2?: number): boolean` | Evaluate comparison |
| `interpolateColor` | `(value: number, stops: readonly { value: number; color: string }[]): string` | Interpolate color between stops |

---

## Excel Plugin

Import/export `.xlsx` files via SheetJS (lazy-loaded from CDN on first use).

### Registration

```typescript
import { ExcelPlugin } from '@witqq/spreadsheet-plugins';

const plugin = new ExcelPlugin();
engine.installPlugin(plugin);
```

### `plugin.importExcel(buffer: ArrayBuffer, sheetIndex?: number): Promise<ExcelImportResult>`

Parse `.xlsx` buffer, populate `CellStore`, derive columns from header row.

```typescript
const file = await fetch('/data.xlsx').then(r => r.arrayBuffer());
const result = await plugin.importExcel(file);
// result: { columns: ColumnDef[], rowCount: number, sheetName: string }
```

- First row treated as header → column titles.
- Column types inferred from first 10 data rows (`number`, `date`, `boolean`, `string`).
- Column widths read from `!cols` metadata (clamped to 50–300px).
- Merged regions preserved via `engine.mergeCells()`.
- Clears existing `CellStore` data and merges before import.

### `plugin.exportExcel(options?: ExcelExportOptions): Promise<ArrayBuffer>`

Build workbook from `CellStore`, return `.xlsx` ArrayBuffer.

```typescript
const buffer = await plugin.exportExcel({ sheetName: 'Data', includeHeaders: true });
const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
```

### `ExcelExportOptions`

```typescript
interface ExcelExportOptions {
  sheetName?: string;        // Default: 'Sheet1'
  includeHeaders?: boolean;  // Default: true
  maxRows?: number;          // Default: all (browser memory limits apply)
}
```

### `ExcelImportResult`

```typescript
interface ExcelImportResult {
  columns: ColumnDef[];
  rowCount: number;
  sheetName: string;
}
```

> **Note:** SheetJS is lazy-loaded from CDN (`https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`). If `globalThis.XLSX` is already present (e.g., from a `<script>` tag), that instance is reused.

---

## Collaboration Plugin

Real-time collaborative editing via Operational Transformation (OT). Captures local cell edits, transforms against concurrent remote operations, and applies remote changes to `CellStore`.

### Registration

```typescript
import {
  CollaborationPlugin,
  WebSocketTransport,
  RemoteCursorLayer,
} from '@witqq/spreadsheet-plugins';

const cursorLayer = new RemoteCursorLayer();

const transport = new WebSocketTransport({
  url: 'wss://your-server/ws',
  onInit: ({ clientId, color, revision, cursors }) => { /* ... */ },
  onCursor: (info) => cursorLayer.setCursor(info.clientId, {
    clientId: info.clientId,
    color: info.color,
    name: info.name,
    row: info.cursor?.row ?? 0,
    col: info.cursor?.col ?? 0,
  }),
  onLeave: ({ clientId }) => cursorLayer.removeCursor(clientId),
});

await transport.connect();

const plugin = new CollaborationPlugin({
  clientId: 'user-123',
  transport,
  cursorLayer,
  sendCursor: (cursor) => transport.sendCursor(cursor),
});

engine.installPlugin(plugin);
```

### `CollaborationPluginConfig`

```typescript
interface CollaborationPluginConfig {
  clientId: string;
  transport: OTTransport;
  cursorLayer?: RemoteCursorLayer;
  sendCursor?: (cursor: { row: number; col: number } | null) => void;
}
```

### `CollaborationPlugin` Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getPendingCount` | `(): number` | Count of unacknowledged local operations |
| `getRevision` | `(): number` | Current server revision number |

### OT Operation Types

```typescript
type OTOperation = SetCellValueOp | InsertRowOp | DeleteRowOp;

interface SetCellValueOp {
  type: 'setCellValue';
  row: number;
  col: number;
  value: unknown;
  oldValue?: unknown;
}

interface InsertRowOp {
  type: 'insertRow';
  row: number;
  count: number;
}

interface DeleteRowOp {
  type: 'deleteRow';
  row: number;
  count: number;
}

interface VersionedOperation {
  clientId: string;
  revision: number;
  op: OTOperation;
}
```

### OT Transform Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `otTransform` | `(opA: OTOperation, opB: OTOperation): TransformResult` | Transform opA against opB. Returns `[opA', opB']` |
| `transformAgainstAll` | `(localOp: OTOperation, serverOps: OTOperation[]): OTOperation \| null` | Transform local op against list of server ops |

`TransformResult = [OTOperation | null, OTOperation | null]` — `null` means the operation became a no-op.

Invariant: `apply(apply(state, opA), opB') === apply(apply(state, opB), opA')`

### `OTTransport` Interface

```typescript
interface OTTransport {
  send(op: VersionedOperation): void;
  onReceive(handler: (op: VersionedOperation) => void): void;
  onAck(handler: (revision: number) => void): void;
  disconnect(): void;
}
```

### `WebSocketTransport`

```typescript
interface WebSocketTransportConfig {
  url: string;
  onInit?: (data: { clientId: string; color: string; revision: number; cursors: CursorInfo[] }) => void;
  onCursor?: (info: CursorInfo) => void;
  onJoin?: (info: { clientId: string; color: string; name: string }) => void;
  onLeave?: (info: { clientId: string }) => void;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `(): Promise<void>` | Open WebSocket connection |
| `send` | `(op: VersionedOperation): void` | Send operation |
| `sendCursor` | `(cursor: { row: number; col: number } \| null): void` | Send cursor position |
| `disconnect` | `(): void` | Close connection |
| `getClientId` | `(): string` | Get assigned client ID |

Server message types: `init`, `op`, `ack`, `cursor`, `join`, `leave`.

### `MockTransport`

For testing. Connects two clients directly without a server.

```typescript
const [transportA, transportB] = MockTransport.createPair();
```

### `RemoteCursorLayer`

Render layer that draws colored cell overlays with name labels for remote users.

```typescript
interface RemoteCursor {
  clientId: string;
  color: string;
  name: string;
  row: number;
  col: number;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setCursor` | `(clientId: string, cursor: RemoteCursor \| null): void` | Set or clear a remote cursor |
| `removeCursor` | `(clientId: string): void` | Remove a remote cursor |
| `getCursors` | `(): RemoteCursor[]` | Get all active remote cursors |

### `CursorInfo`

```typescript
interface CursorInfo {
  clientId: string;
  color: string;
  name: string;
  cursor: { row: number; col: number } | null;
}
```

---

## Progressive Loader Plugin

Non-blocking data loader for large datasets. Loads rows in async chunks using `scheduler.yield()` (Chrome 129+) or `MessageChannel` fallback. CSS progress overlay stays smooth regardless of data size.

### Registration

```typescript
import { ProgressiveLoaderPlugin } from '@witqq/spreadsheet-plugins';

const plugin = new ProgressiveLoaderPlugin({
  totalRows: 1_000_000,
  columnKeys: columns.map(c => c.key),
  generateRow: (index) => ({
    id: index,
    name: `Row ${index}`,
    value: Math.random() * 1000,
  }),
  onProgress: (loaded, total) => console.log(`${loaded}/${total}`),
  onComplete: (ms) => console.log(`Loaded in ${ms}ms`),
  chunkBudgetMs: 50,
});

engine.installPlugin(plugin);
plugin.start();
```

### `ProgressiveLoaderConfig`

```typescript
interface ProgressiveLoaderConfig {
  totalRows: number;
  columnKeys: string[];
  generateRow: (index: number) => Record<string, unknown>;
  onProgress?: (loaded: number, total: number) => void;
  onComplete?: (loadTimeMs: number) => void;
  chunkBudgetMs?: number;  // Default: 50
}
```

### Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `(): void` | Begin progressive loading |
| `cancel` | `(): void` | Cancel ongoing loading |
| `getProgress` | `(): number` | Fraction loaded (0–1) |
| `isLoading` | `(): boolean` | Whether loading is in progress |
| `getLoadedRows` | `(): number` | Count of rows loaded so far |

### `ProgressOverlay`

DOM-based progress overlay showing percentage, progress bar with shimmer animation, and row count. Mounts into the engine container.

| Method | Signature | Description |
|--------|-----------|-------------|
| `mount` | `(container: HTMLElement): void` | Mount overlay into container |
| `setProgress` | `(loaded: number, total: number): void` | Update progress display |
| `setPhase` | `(phase: 'loading' \| 'processing' \| 'done'): void` | Set display phase |
| `destroy` | `(): void` | Remove overlay from DOM |

Phases: `loading` (determinate bar + shimmer) → `processing` (indeterminate animation) → `done` (fade out, auto-destroy after 600ms).

Supports light/dark themes via `data-theme="light"` on `<html>`.

---

## Plugin Registration Pattern

All plugins implement `SpreadsheetPlugin`:

```typescript
interface SpreadsheetPlugin {
  name: string;
  version: string;
  install(api: PluginAPI): void;
  destroy(): void;
}
```

Install via `engine.installPlugin(plugin)`, remove via `engine.removePlugin(pluginName)`.

## License

[Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE). Free for non-commercial use. Commercial use requires a paid license. Change Date: 2030-03-01 → Apache License 2.0.
