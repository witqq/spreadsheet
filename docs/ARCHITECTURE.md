# Architecture

## Overview

`@witqq/spreadsheet` is a canvas-based spreadsheet engine. It renders everything on a single `<canvas>` element using a layered rendering pipeline. The engine is framework-agnostic — framework wrappers (React, Vue, Angular) are thin adapters.

## Monorepo Packages

| Package | npm name | Purpose |
|---------|----------|---------|
| `packages/core` | `@witqq/spreadsheet` | Engine: rendering, data, editing, selection, commands. Zero external deps. |
| `packages/react` | `@witqq/spreadsheet-react` | React wrapper (`<Spreadsheet>` component) |
| `packages/vue` | `@witqq/spreadsheet-vue` | Vue wrapper |
| `packages/angular` | `@witqq/spreadsheet-angular` | Angular wrapper |
| `packages/widget` | `@witqq/spreadsheet-widget` | Single-file IIFE/UMD bundle for embedding |
| `packages/plugins` | `@witqq/spreadsheet-plugins` | Official plugins (formulas, collaboration, context menu, etc.) |
| `packages/demo` | `@witqq/spreadsheet-demo` | Demo app (React + Vite, private) |
| `packages/server` | — | Collaboration WebSocket server |
| `packages/site` | — | Documentation site (Astro + Starlight) |

## Core Engine Architecture

### Entry Point

`SpreadsheetEngine` (`packages/core/src/engine/spreadsheet-engine.ts`) is the main class. It orchestrates ~30 subsystems and uses two-phase initialization:

- **Constructor** (headless) — creates CellStore, ColStore, RowStore, EventBus, CommandManager, LayoutEngine, and other non-DOM subsystems
- **mount()** — creates DOM-dependent subsystems: CanvasManager, ScrollManager, RenderPipeline, InlineEditor, SelectionManager

---

## Rendering Pipeline

*Source: `packages/core/src/renderer/`*

### RenderScheduler

*Source: `render-scheduler.ts`*

Classic RAF coalescing with a boolean dirty flag. When `requestRender()` is called:

1. If `dirty` is already `true`, return immediately (coalescing — any number of calls per frame collapse to one)
2. Set `dirty = true`, schedule a single `requestAnimationFrame`
3. Inside the RAF callback: reset `dirty = false`, invoke `renderCallback()`

The coalescing is O(1) — the first `requestRender()` in a frame wins the RAF slot, all subsequent calls are no-ops. No queue, no debounce timer, no priority system.

### RenderPipeline

*Source: `render-pipeline.ts`*

Orchestrates layer rendering. Layers are stored in an ordered array.

**Non-frozen render cycle:**
1. `ctx.clearRect(0, 0, canvasWidth, canvasHeight)` — wipe entire canvas
2. Iterate layers in order, call `layer.render(renderContext)` with viewport/scroll/theme/geometry

**Default layer order** (from GridRenderer, `grid-renderer.ts`):
1. BackgroundLayer — cell backgrounds
2. CellTextLayer — cell values, formatted text
3. CellStatusLayer — validation icons, status indicators
4. EmptyStateLayer — placeholder when no data
5. GridLinesLayer — grid borders (if enabled), per-cell border overrides (solid/dashed/dotted with conflict resolution)
6. HeaderLayer — column/row headers
7. RowNumberLayer — row numbers (if enabled)
8. SelectionOverlayLayer — selection highlight, active cell (always last)

Plugin layers are inserted before GridLinesLayer (or before SelectionOverlayLayer if no grid lines), ensuring plugins render above cell text but below the grid overlay.

### Frozen Pane Rendering

When frozen rows or columns are configured, the pipeline switches to a 4-region compositing model:

| Region | Clip Area | Scrolls With | Cache Strategy |
|--------|-----------|-------------|----------------|
| **corner** | Top-left intersection | Neither axis | Rendered once, cached as ImageData |
| **frozenRow** | Top strip, scrollable columns | Horizontal scroll only | Cached, re-rendered when scrollX changes |
| **frozenCol** | Left strip, scrollable rows | Vertical scroll only | Cached, re-rendered when scrollY changes |
| **main** | Remaining area | Both axes | Re-rendered every frame |

For each layer × each region: `ctx.save()` → clip to region rect → `layer.render()` → `ctx.restore()`.

**ImageData caching:** After rendering, regions are captured via `ctx.getImageData()` at DPR-scaled coordinates. On subsequent frames, unchanged regions are restored via `ctx.putImageData()` instead of re-rendering all layers. Five caches are maintained: corner, frozenRow, frozenCol, frozenRowHeaders, frozenColRowNumbers.

Cache invalidation occurs on theme change, data change, or structural change (column/row add/remove).

### Key Layer Implementations

**BackgroundLayer** (`background-layer.ts`) — fills entire canvas with `theme.colors.background`, then renders per-cell `bgColor` from `CellStyle`. Uses lazy clipping (only clips when drawing individual cell backgrounds) and supports merged cells by drawing backgrounds for the full merged region at the anchor cell. Always the first layer.

**CellTextLayer** (`cell-text-layer.ts`) — the most complex layer:
1. Clips to cell area (excluding headers and row number gutter)
2. Collects visible cells, handling merge anchors that may be off-screen
3. For each cell, resolves the cell type from column definition, cell data, or auto-detection
4. Applies per-cell `textColor` and font properties (`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`) from `CellStyle`, falling back to theme defaults
5. Applies per-cell `textAlign` (`left`/`center`/`right`) from `CellStyle`, falling back to `renderer.align` (cell type default)
6. Applies per-cell `verticalAlign` (`top`/`middle`/`bottom`) by computing text Y position within the cell
7. Applies per-cell `textWrap` from `CellStyle` with bidirectional override: `cellStyle?.textWrap ?? col.wrapText ?? false` — per-cell can enable or disable wrapping regardless of column setting
8. Applies per-cell `indent` — shifts text position and reduces available width by `indent * padding` pixels
9. Collects applicable `CellDecorator` instances from `CellTypeRegistry.getDecorators()` and renders in order: underlay → left → right → text/custom → overlay. Left/right decorators reserve horizontal space, shifting text inward.
10. Custom renderer path: delegates to `renderer.render()` if the cell type provides one
11. Wrap text path: uses `TextMeasureCache.getWrappedLines()` for word breaking, draws each line with proper alignment and vertical alignment
12. Single-line path: uses `TextMeasureCache.truncateText()` with ellipsis, draws via `ctx.fillText()`
13. Also provides `measureHeights()` for the auto row-size system, accounting for per-cell textWrap, indent, decorator widths, and custom fonts

**GridLinesLayer** (`grid-lines-layer.ts`) — draws uniform grid lines for all visible rows/columns, skipping segments inside merged regions. After the default grid stroke, iterates visible cells and draws per-cell border overrides (`borderTop`, `borderRight`, `borderBottom`, `borderLeft`) from `CellStyle`. Each border specifies `width`, `color`, and line `style` (`solid`/`dashed`/`dotted`). Shared borders between adjacent cells are resolved: thicker border wins; equal thickness → rightmost/bottommost cell's border takes precedence. Edges are grouped by visual style to minimise canvas state changes.

**SelectionOverlayLayer** (`selection-overlay-layer.ts`) — draws selection fills (translucent rectangles) and borders for each range, plus the active cell border with merge-awareness.

### CanvasManager

*Source: `canvas-manager.ts`*

Manages the `<canvas>` element with DPI-aware scaling:
- Sets physical canvas size to `cssWidth × dpr` by `cssHeight × dpr`
- Sets CSS display size to match container
- Applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so all drawing uses CSS pixel coordinates while rendering at native resolution

Detects browser zoom (DPR changes) via `matchMedia(\`(resolution: ${dpr}dppx)\`)` and re-syncs canvas size on change.

---

## Data Model

*Source: `packages/core/src/model/`*

### CellStore

*Source: `cell-store.ts`*

Sparse map storage: `Map<string, CellData>` keyed by `"row:col"` string (e.g. `"5:3"`). Only non-empty cells are stored.

**Version tracking:** `_version` counter incremented on every `set()`, `delete()`, `clear()`. Bulk methods (`bulkLoadChunk`, `bulkGenerate`) increment version once at the end for efficiency.

**CellData interface** (`types/interfaces.ts`):
- `value: CellValue` — raw value (`string | number | boolean | Date | null`)
- `displayValue?: string` — formatted override
- `formula?: string` — e.g. `"=SUM(A1:A10)"`
- `style?: CellStyleRef` — `{ ref: string, style: CellStyle }`
- `type?: CellType` — rendering/editing behavior
- `metadata?: CellMetadata` — status, errors, links, comments
- `custom?: Record<string, unknown>` — extensible user-defined data

All CellData fields are `readonly`.

**CellType union:** `'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'dynamicSelect' | 'formula' | 'link' | 'image' | 'progressBar' | 'rating' | 'badge' | 'custom'`

**Key methods:** `get/set/has/delete` (O(1)), `setValue()` (merges with existing data), `setMetadata()`, `iterateRange()` (generator over bounds), `bulkLoad()` / `bulkGenerate()` (progressive loading).

CellStore has no row-shift logic — row insertion/deletion is handled externally by RowStore.

### ColStore

*Source: `col-store.ts`*

Ordered array of `ColumnDef[]` plus `Set<number>` for hidden columns. Each ColumnDef contains: `key`, `title`, `width`, `minWidth?`, `maxWidth?`, `type?: CellType`, `frozen?`, `sortable?`, `filterable?`, `editable?`, `resizable?`, `hidden?`, `wrapText?`, `validation?`.

Version-tracked like CellStore.

### RowStore

*Source: `row-store.ts`*

Three sparse collections:
- `manualHeightOverrides: Map<number, number>` — user drag-resized heights
- `autoHeightOverrides: Map<number, number>` — auto-measured heights
- `hiddenRows: Set<number>`

**Height resolution priority:** hidden → 0, manual override → auto override → defaultHeight.

`setAutoHeightsBatch()` only updates rows without manual overrides and uses epsilon comparison (0.01) to avoid unnecessary version bumps.

`shiftRowsUp(deletedRow)` rebuilds all three collections, shifting indices down by 1.

### DataView

*Source: `dataview/data-view.ts`*

Provides logical (visible/sorted/filtered) ↔ physical (CellStore) row index mapping.

**Passthrough mode:** When no sort or filter is active, mapping is `null` — all lookups return identity. Zero overhead.

**Active mapping:** `_mapping: number[]` where `mapping[logicalRow] = physicalRow`, plus `_reverseMapping: Map<number, number>` for physical → logical lookups.

`recompute(physicalIndices[])` rebuilds mapping from sorted/filtered index array. `reset()` returns to passthrough.

---

## Layout Engine

*Source: `packages/core/src/renderer/layout-engine.ts`*

All position data stored in `Float64Array` typed arrays for cache-friendly memory access and 64-bit precision:

| Array | Size | Purpose |
|-------|------|---------|
| `colPositions` | visibleCols + 1 | Cumulative x-offsets (prefix sum) |
| `colWidths` | visibleCols | Per-column widths |
| `rowPositions` | rowCount + 1 | Cumulative y-offsets (prefix sum) |
| `rowHeights` | rowCount | Per-row heights |

### Construction

Filters hidden columns, then builds prefix-sum arrays in a single linear pass. The "+1" entry stores the total dimension (e.g. `colPositions[n] = totalWidth`).

### getCellRect — O(1)

Pure array index lookups:
```
x = rowNumberWidth + colPositions[colIndex]
y = headerHeight + rowPositions[rowIndex]
width = colWidths[colIndex]
height = rowHeights[rowIndex]
```

No computation beyond array indexing. Returns `{0,0,0,0}` for out-of-bounds inputs.

### Hit-testing — O(log n) binary search

`getRowAtY(y)` and `getColAtX(x)` both use binary search on the cumulative positions array to find which cell a pixel coordinate falls within. Returns -1 if outside content bounds.

### Mutation

- `setRowHeight(row, h)` — updates height, recomputes cumulative positions from that row onward: O(n−row)
- `setRowHeightsBatch(Map<row, h>)` — applies all changes, single recompute pass from minimum changed index: much faster than N individual calls
- `setRowCount(count)` — if exceeding current capacity, reallocates new Float64Array instances and copies old data via `.set(subarray)` (memcpy-speed)

### Frozen pane helpers

`getFrozenRowsHeight(count)` and `getFrozenColsWidth(count)` are O(1) prefix-sum lookups.

### ViewportManager

*Source: `viewport-manager.ts`*

Determines visible cells by binary-searching scroll position against LayoutEngine's cumulative arrays:

1. `layout.getRowAtY(scrollY)` → first visible row
2. `layout.getRowAtY(scrollY + viewportHeight)` → last visible row
3. Same for columns

Applies render buffers: 10 extra rows and 5 extra columns beyond the visible area for smooth scrolling.

For frozen panes, computes 4 separate viewport ranges (corner, frozenRow, frozenCol, main), each with appropriate scroll offsets.

### ScrollManager

*Source: `scroll-manager.ts`*

Uses a transparent absolutely-positioned `<div>` with `overflow: auto` overlaying the canvas. A spacer div inside is sized to the total content dimensions, creating native scrollbars without rendering content. The scroll listener uses `{ passive: true }` for performance and syncs `scrollLeft`/`scrollTop` to the rendering pipeline.

---

## Editing

*Source: `packages/core/src/editing/`*

### Two-Tier Architecture

The editing system has a two-tier design:

1. **InlineEditor** — built-in textarea fallback for free-text editing (text, number)
2. **CellEditorRegistry** + **CellEditor** interface — dispatches to specialized overlay editors (date pickers, etc.) for specific column types

The engine method `openCellEditor()` is the central dispatch point: it queries the registry first, falls back to InlineEditor if no match.

### InlineEditor

*Source: `editing/inline-editor.ts`*

A `<textarea>` element positioned absolutely over the target cell at `z-index: 20`.

**Positioning:** Gets the cell rect from `LayoutEngine.getCellRect()`, subtracts scroll offsets (skipped for frozen cells). For merged cells, computes the spanning rect across the merge region.

**Triggers:**
- **F2** → opens editor, selects all existing content
- **Double-click** → same as F2
- **Type-to-edit** (any printable character) → opens editor with typed character as initial text, replaces cell value. Only for non-overlay types — overlay editors (date, datetime) are opened without initial text.

**Commit/Cancel:**
| Key | Behavior |
|-----|----------|
| Enter | Commit, move cursor down |
| Shift+Enter | Commit, move cursor up |
| Tab | Commit, move cursor right |
| Shift+Tab | Commit, move cursor left |
| Escape | Cancel without saving |
| Scroll | Commit and close (except frozen corner cells) |
| Click outside | Commit and close |

**Value coercion:** On commit, attempts to parse the string back to the original type — numbers are parsed via `Number()`, booleans via string comparison.

### CellEditorRegistry

*Source: `editing/cell-editor-registry.ts`*

Maps cell types to editor factories. Entries are sorted by priority (highest first) for O(n) first-match resolution.

- `register(editor, matcher, priority)` — adds a `{editor, matcher, priority}` entry
- `registerForType(editor, type, priority)` — convenience; creates a type-equality matcher
- `resolve(column, value)` — returns the first matching editor, or `null` (engine falls back to InlineEditor)

**CellEditor interface** (`editing/cell-editor.ts`):
- `open(context, commitFn, closeFn)` — receives a rich context including row, col, value, column, container, layout engine, theme, locale, merge manager
- `close(reason)` — editor removes its DOM and calls closeFn
- `setTheme()` / `setLocale()` — runtime updates
- `destroy()` — full cleanup

### Overlay Editors

**DatePickerOverlay** (`editing/date-picker-overlay.ts`) — calendar popup positioned below the cell (or above if no room below) at `z-index: 50`. Pure DOM calendar grid with month navigation, keyboard support (arrows, Enter, Escape), and a "Today" footer button.

**DatePickerEditor** (`editing/date-picker-editor.ts`) — adapter implementing `CellEditor` that wraps DatePickerOverlay. Registered for column type `'date'`.

**DateTimeEditor** (`editing/date-time-editor.ts`) — directly implements `CellEditor`. Adds hour/minute spin controls below the calendar. Has a `FocusSection` state machine (`'calendar' | 'hour' | 'minute'`) for Tab cycling between sections. Commits ISO datetime strings. Registered for column type `'datetime'`.

### Command Integration

*Source: `packages/core/src/commands/`*

The editing→command data flow:

```
Editor commit → engine onCommit callback
  → dataView.getPhysicalRow(logicalRow)   // handle sorting/filtering
  → new CellEditCommand(cellStore, physRow, col, old, new)
  → commandManager.execute(command)        // pushes to undo stack
  → eventBus.emit('cellChange', ...)       // notify listeners
  → renderScheduler.requestRender()        // schedule repaint
```

**CellEditCommand** (`commands/cell-edit-command.ts`) — stores row, col, oldValue, newValue. `execute()` calls `cellStore.setValue()`, `undo()` restores the old value.

**BatchCellEditCommand** (`commands/batch-cell-edit-command.ts`) — for multi-cell operations (paste, autofill). Undo applies changes in reverse order.

**CommandManager** (`commands/command-manager.ts`) — classic dual-stack undo/redo with configurable `historyLimit` (default 100). `execute()` pushes to undo stack and clears redo stack.

Key design: logical→physical row translation happens at commit time, not in the command — commands store physical rows so undo works correctly even after re-sorting.

---

## Event System

*Source: `packages/core/src/events/`*

### Architecture

```
DOM Events → EventTranslator → EventBus → Handlers
```

### EventBus

*Source: `events/event-bus.ts`*

Minimal typed pub/sub: `Map<string, Set<EventHandler>>`. Methods: `on(event, handler)`, `off(event, handler)`, `emit(event, ...args)`, `destroy()`.

The `Set` storage provides O(1) add/delete and prevents double-registration. Emit is synchronous — no error boundaries, no priority ordering, no async support. `destroy()` calls `listeners.clear()`.

### EventTranslator

*Source: `events/event-translator.ts`*

Bridges DOM events to grid-domain events. Attaches 9 DOM listeners on the scroll container: `mousedown`, `mousemove`, `mouseup`, `dblclick`, `keydown`, `contextmenu`, `touchstart`, `touchmove`, `touchend`.

**Core method — `hitTest(offsetX, offsetY)`:** Converts pixel coordinates to `{ region, row, col, hitZone?, hitZoneCursor? }`:
1. Reads scroll position and frozen pane boundaries
2. Determines region by quadrant: header, row-number, corner, or cell
3. Header region further subdivides into `header-sort-icon` / `header-filter-icon` by checking the rightmost 28px
4. Row-number region checks for row-group-toggle via RowGroupManager
5. Cell region delegates to `layoutEngine.getRowAtY()` / `getColAtX()`
6. For cell hits, resolves sub-cell hit zones via `resolveHitZone()` if CellTypeRegistry is provided

**Sub-cell hit zone resolution — `resolveHitZone(row, col, contentX, contentY)`:**
1. Looks up cell type renderer via CellTypeRegistry
2. Calls `renderer.getHitZones(value, width, height, theme)` if defined
3. Converts content coordinates to cell-relative coordinates
4. Tests point-in-rect against each declared zone
5. Returns `{ id, cursor }` of the matching zone, or undefined

**Hit regions:** `'cell' | 'header' | 'header-sort-icon' | 'header-filter-icon' | 'row-number' | 'row-group-toggle' | 'corner' | 'outside'`

**Touch support:** Implements tap/double-tap detection with thresholds (10px movement, 300ms duration, 300ms interval). Creates synthetic MouseEvent objects for downstream compatibility.

### Event Categories

| Category | Events |
|----------|--------|
| Public | `cellClick`, `cellDoubleClick`, `cellHover`, `cellChange`, `selectionChange`, `scroll`, `ready`, `destroy` |
| Command | `commandExecute`, `commandUndo`, `commandRedo` |
| Clipboard | `clipboardCopy`, `clipboardCut`, `clipboardPaste` |
| Resize | `columnResize`/`Start`/`End`, `rowResize`/`Start`/`End` |
| Data | `cellStatusChange`, `cellValidation`, `sortChange`, `sortRejected`, `filterChange`, `themeChange`, autofill events, row group events |
| Internal | `gridMouseDown`, `gridMouseMove`, `gridMouseUp`, `gridMouseHover`, `gridContextMenu`, `gridKeyDown` |

### Lifecycle

1. EventBus created in constructor
2. EventTranslator created during `mount()`, calls `attach()` to bind DOM listeners
3. Engine and sub-managers subscribe to internal events
4. On `destroy()`: sub-managers destroyed first (can still emit during teardown), then EventTranslator detached, then EventBus destroyed last

---

## Selection & Navigation

- **SelectionManager** — single/multi selection, ranges, keyboard extend
- **KeyboardNavigator** — arrow keys, Tab, Enter, Home/End, Ctrl+combinations

---

## Plugin System

*Source: `packages/core/src/plugins/plugin-types.ts`*

### Plugin Interface

```typescript
interface SpreadsheetPlugin {
  readonly name: string;            // unique ID
  readonly version: string;         // semver
  readonly dependencies?: string[]; // plugins that must be installed first
  install(api: PluginAPI): void;    // called on registration
  destroy?(): void;                 // cleanup hook
}
```

Only two lifecycle hooks: `install` and `destroy`. Plugins extend behavior by subscribing to the EventBus and adding render layers during `install`.

### Plugin Management

Plugin management is embedded in SpreadsheetEngine (no separate PluginManager class). Two parallel Maps: `plugins: Map<string, SpreadsheetPlugin>` and `pluginAPIs: Map<string, SpreadsheetPluginAPI>`.

**Registration:** `installPlugin(plugin)` — throws if already installed or if dependencies are missing. Dependencies are validated via linear check (all entries in `plugin.dependencies` must exist in the plugins map). No topological sort — caller must install in correct order.

**Deferred install:** Plugins registered before `mount()` are batch-installed during mount, after the `'ready'` event.

**Removal:** `removePlugin(name)` — blocks removal if other installed plugins depend on it, then calls `destroy()` and clears state.

**Destroy order:** All plugins destroyed in reverse installation order during engine teardown.

### Plugin API

Each plugin receives a `PluginAPI` instance with:

- **State isolation:** Private `Map<string, unknown>` per plugin via `getPluginState<T>(key)` / `setPluginState<T>(key, value)`. State is cleared on removal.
- **Engine access:** `api.engine` provides full access to all engine internals — data stores, event bus, render layers, command manager, selection, layout, etc. This is a "full trust" model with no sandboxing.

### Plugin Patterns

**Render layer plugin** (e.g. ConditionalFormatPlugin):
- `install()`: create custom RenderLayer, call `engine.addRenderLayer(layer, 'content')`
- `destroy()`: call `engine.removeRenderLayer(layer)`

**Event-driven plugin** (e.g. CollaborationPlugin):
- `install()`: subscribe to EventBus events (`cellChange`, `selectionChange`), add RemoteCursorLayer
- `destroy()`: unsubscribe all events, remove layer, disconnect transport

**Context menu plugin** (e.g. ContextMenuPlugin):
- `install()`: register menu items via `engine.registerContextMenuItem()`, store IDs in plugin state
- `destroy()`: iterate stored IDs and unregister each

## Features

| Feature | Module | Description |
|---------|--------|-------------|
| Auto Row Height | `auto-row-size/` | Measures text and adjusts row heights automatically |
| Column Stretch | `resize/column-stretch-manager.ts` | Stretches columns to fill container width |
| Text Wrapping | Via AutoRowSize | Word wrap with automatic row height calculation, per-cell or per-column |
| Merge Cells | `merge/` | Cell merging with MergeManager |
| Frozen Panes | `viewport/frozen-panes.ts` | Freeze rows/columns |
| Sorting | `sort/` | Column sort with SortEngine |
| Filtering | `filter/` | Column filters with FilterEngine + FilterPanel |
| Validation | `validation/` | Cell validation rules |
| Context Menu | `context-menu/` | Right-click menu with submenu support |
| Clipboard | `clipboard/` | Copy/paste with TSV/HTML serialization |
| Autofill | `autofill/` | Drag-fill with pattern detection |
| Print | `print/` | Print support via PrintManager |
| Themes | `themes/` | Light/dark themes, custom theming |
| Locale | `locale/` | i18n — UI labels, date formats, number formats |
| Grouping | `grouping/` | Row groups (expand/collapse) |
| Pivot | `pivot/` | Pivot table engine |
| Streaming | `streaming/` | Progressive data loading |
| Accessibility | `aria/` | ARIA live regions, screen reader support |
| Tooltips | `tooltip/` | Cell tooltips |

## Official Plugins

*Source: `packages/plugins/`*

| Plugin | Description |
|--------|-------------|
| FormulaPlugin | Excel-compatible formulas (SUM, AVERAGE, IF, etc.) |
| FormulaWorker | Web Worker offload for formula calculation |
| ContextMenuPlugin | Standard context menu (cut, copy, paste, insert/delete) |
| ConditionalFormatPlugin | Conditional formatting rules |
| ExcelPlugin | .xlsx import/export |
| ProgressiveLoaderPlugin | Lazy data loading |
| CollaborationPlugin | Real-time collaboration via OT |

## Cell Type System

*Source: `packages/core/src/types/cell-type-registry.ts`*

### Type Resolution

Cell type is resolved via a 3-tier priority chain:
1. **Column definition** (`ColumnDef.type`) — highest priority
2. **Cell-level override** (`CellData.type`) — per-cell override
3. **Auto-detection** (`CellTypeRegistry.detectType()`) — runtime inference: numbers → `'number'`, booleans → `'boolean'`, Date instances → `'date'`, everything else → `'string'`

### CellType Union

14 built-in types: `'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'dynamicSelect' | 'formula' | 'link' | 'image' | 'progressBar' | 'rating' | 'badge' | 'custom'`

### Built-in Renderers

CellTypeRegistry registers renderers that control formatting (value → display string) and rendering:

| Type | Format | Align | Custom Render |
|------|--------|-------|---------------|
| `string` | `String(value)` | left | No — default `fillText` |
| `number` | `toLocaleString()` | right | No |
| `boolean` | `String(value)` | center | Yes — checkbox square with checkmark stroke |
| `date` | `toLocaleDateString()`, parses strings | left | No |

The remaining 10 types (`datetime`, `select`, `dynamicSelect`, `formula`, `link`, `image`, `progressBar`, `rating`, `badge`, `custom`) have no built-in renderers — they fall back to the string renderer via `get()` fallback. They exist as type identifiers for custom renderer registration and editor resolution.

### Custom Type Registration

**Custom rendering:**
```typescript
engine.getCellTypeRegistry().register('progressBar', {
  format: (v) => `${v}%`,
  align: 'left',
  render: (ctx, value, x, y, w, h, theme) => { /* draw bar */ },
  measureHeight: (ctx, value, w, theme) => 30, // optional, for auto row height
});
```

**Sub-cell hit zones:**
```typescript
engine.getCellTypeRegistry().register('boolean', {
  format: (v) => String(v),
  align: 'center',
  render: (ctx, value, x, y, w, h, theme) => { /* draw checkbox */ },
  getHitZones: (value, width, height, theme) => {
    const size = Math.min(14, height - 6);
    return [{
      id: 'checkbox',
      x: (width - size) / 2,
      y: (height - size) / 2,
      width: size,
      height: size,
      cursor: 'pointer',
    }];
  },
});
// cellClick/cellHover events include hitZone: 'checkbox' when zone is hit
```

**Custom editing:** Via `CellEditorRegistry.registerForType(editor, 'progressBar')` or `register(editor, matcherFn, priority)` for arbitrary predicate matching.

### Rendering Dispatch

In CellTextLayer:
- If the resolved renderer has a `render()` method → call it with full canvas control (ctx save/restore around each call)
- Otherwise → call `format(value)`, then either:
  - **Wrap text path:** `TextMeasureCache.getWrappedLines()` → multi-line with vertical centering
  - **Single-line path:** `TextMeasureCache.truncateText()` with ellipsis → `ctx.fillText()`

Alignment is driven by per-cell `cellStyle?.textAlign`, falling back to `renderer.align` → sets `ctx.textAlign` + computes x-position. Vertical alignment (`cellStyle?.verticalAlign`) adjusts text Y position within the cell for both single-line and wrapped modes. Indent shifts the text start position and reduces available width.

### Locale-aware Formatting

`CellTypeRegistry.setFormatLocale(locale)` dynamically replaces number and date renderers with locale-specific formatting using the BCP 47 tag from `locale.formatLocale`.

---

## Public API Surface

*Source: `packages/core/src/index.ts`*

The package exports runtime classes/functions and type-only definitions, grouped by domain:

### Engine
- **`SpreadsheetEngine`** — main entry point class
- `SpreadsheetEngineConfig` — configuration type

### Data Model
- **`CellStore`**, **`RowStore`**, **`ColStore`**, **`StylePool`** — storage classes
- **`DataView`** + `DataViewConfig` — filtered/sorted view
- Types: `CellData`, `CellValue`, `CellStyle`, `CellType`, `CellAddress`, `CellRange`, `CellRect`, `CellMetadata`, `ColumnDef`, `Selection`, `MergedRegion`, `CellChange`, validation types, conditional format types

### Rendering
- **`CanvasManager`**, **`GridRenderer`**, **`GridGeometry`**, **`LayoutEngine`**, **`ViewportManager`**, **`RenderScheduler`**, **`DirtyTracker`**, **`ScrollManager`**, **`RenderPipeline`**, **`TextMeasureCache`**
- Layers: **`CellTextLayer`**, **`CellStatusLayer`**, **`EmptyStateLayer`**, **`FillHandleLayer`**, **`RowGroupToggleLayer`**
- Types: `RenderLayer`, `RenderContext`, `PaneRegion`, `RenderMode`, `ViewportRange`, `FrozenViewportRanges`, dirty tracking types

### Editing
- **`InlineEditor`**, **`DatePickerOverlay`**, **`DatePickerEditor`**, **`DateTimeEditor`**, **`CellEditorRegistry`**
- Types: `CellEditor`, `CellEditorContext`, `CellEditorCommit`, `CellEditorClose`, `CellEditorMatcher`

### Commands
- **`CommandManager`**, **`CellEditCommand`**, **`BatchCellEditCommand`**, **`ResizeColumnCommand`**, **`ResizeRowCommand`**, **`MergeCellsCommand`**, **`UnmergeCellsCommand`**, **`InsertRowCommand`**, **`DeleteRowCommand`**
- Types: `Command`, `CellEdit`, `CommandManagerConfig`

### Events
- **`EventBus`**, **`EventTranslator`**
- Types: `SpreadsheetEvents`, `CellEvent`, `CellChangeEvent`, `GridMouseEvent`, `GridKeyboardEvent`, `HitTestResult`, `HitRegion`, all event types

### Selection & Navigation
- **`SelectionManager`**, **`KeyboardNavigator`**

### Sort / Filter / Pivot / Grouping
- **`SortEngine`**, **`FilterEngine`**, **`FilterPanel`**, **`PivotEngine`**, **`RowGroupManager`**
- Utility functions: `compareCellValues`, `evaluateCondition`, `detectPattern`, `extendPattern`

### Utilities
- **`ClipboardManager`** + serializers (`serializeToTSV`, `serializeToHTML`, `parseTSV`, `parseHTML`)
- **`AutofillManager`**, **`AutoRowSizeManager`**, **`ColumnResizeManager`**, **`ColumnStretchManager`**, **`RowResizeManager`**
- **`TooltipManager`**, **`ContextMenuManager`** + `createDefaultMenuItems`
- **`ChangeTracker`**, **`ValidationEngine`**, **`MergeManager`**, **`AriaManager`**, **`PrintManager`**, **`StreamingAdapter`**
- Benchmark: `measureInitTime`, `measureMultiRun`, `measureThroughput`, `computeStats`, **`FPSCounter`**, **`BenchmarkRunner`**

### Theme / Locale
- **`CellTypeRegistry`** + `CellTypeRenderer`, `CellAlignment`
- `SpreadsheetTheme` type, **`lightTheme`**, **`darkTheme`**
- `SpreadsheetLocale` type, `ResolvedLocale` type, `resolveLocale` function, **`enLocale`**, **`ruLocale`**
- `LINE_HEIGHT_MULTIPLIER` constant

### Plugins
- Types only: `SpreadsheetPlugin`, `PluginAPI`

---

## Configuration Reference

*Source: `SpreadsheetEngineConfig` in `packages/core/src/engine/spreadsheet-engine.ts`*

Defaults are applied inline using nullish coalescing (`??`) in the constructor and `mount()` method — there is no separate defaults file.

### Layout Options

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `columns` | `ColumnDef[]` | **required** | Column definitions |
| `rowCount` | `number` | `data.length` | Total rows |
| `width` | `number \| string` | container size | Container width |
| `height` | `number \| string` | container size | Container height |
| `rowHeight` | `number` | `28` (from theme) | Default row height in px |
| `headerHeight` | `number` | `32` (from theme) | Header row height in px |
| `frozenRows` | `number` | `0` | Rows frozen at top |
| `frozenColumns` | `number` | `0` | Columns frozen at left |

### Data Options

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `data` | `Record<string, unknown>[]` | `[]` | Initial row data, bulk-loaded into CellStore on mount |

### Feature Flags

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `editable` | `boolean` | `false` | Enable inline cell editing |
| `sortable` | `boolean` | `false` | Enable column header click-to-sort |
| `showGridLines` | `boolean` | `true` | Show grid lines between cells |
| `showRowNumbers` | `boolean` | `true` | Show row number column (width: 50px from theme) |
| `autoRowHeight` | `boolean \| AutoRowSizeConfig` | `false` | Auto-measure row heights from content |
| `stretchColumns` | `'all' \| 'last'` | `undefined` (off) | `'all'` distributes extra space evenly; `'last'` gives remainder to last column |

### AutoRowSizeConfig (when `autoRowHeight` is an object)

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `batchSize` | `number` | `100` | Off-screen async measurement batch size |
| `minRowHeight` | `number` | `28` (from theme) | Floor height to prevent row collapse |
| `cellPadding` | `number` | `8` | Extra vertical padding added to measured height |

### Theme

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `theme` | `SpreadsheetTheme` | `lightTheme` | Full visual theme (also ships `darkTheme`) |

**`theme.colors`** — 23 color tokens: `gridLine`, `background`, `headerBackground`, `headerText`, `headerBorder`, `selectionFill`, `selectionBorder`, `activeCellBorder`, `fillHandle`, `cellText`, `cellBorder`, `cellEditBackground`, `alternateRowBackground`, `hoverRowBackground`, `frozenSeparator`, `scrollbarTrack`, `scrollbarThumb`, `scrollbarThumbHover`, `errorBackground`, `warningBackground`, `changedIndicator`, `savedIndicator`, `cellPlaceholder`

**`theme.fonts`** — `cell` / `header`: font family (default `'Arial, sans-serif'`), `cellSize` / `headerSize`: font size in px (default `13`)

**`theme.dimensions`** — `rowHeight: 28`, `headerHeight: 32`, `minColumnWidth: 40`, `scrollbarWidth: 14`, `cellPadding: 4`, `borderWidth: 1`, `rowNumberWidth: 50`

**`theme.borders`** — `gridLineWidth: 1`, `selectionWidth: 2`, `activeCellWidth: 2`, `frozenPaneWidth: 2`

### Locale

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `locale` | `SpreadsheetLocale` | English defaults | UI string translations; missing keys fall back to English |

`SpreadsheetLocale` sections: `formatLocale` (BCP 47 tag for number/date formatting), `contextMenu`, `datePicker`, `dateTimePicker`, `filter`, `grouping`, `emptyState`, `print`, `aria`.

---

## Demo App

- **Stack**: React 19 + Vite
- **Entry**: `packages/demo/src/main.tsx`
- **URL**: `http://localhost:3150` (via Docker)
- **Start**: `npm run dev` (Docker) or `cd packages/demo && npm run dev` (Vite on 5173)

## Documentation Site

- **Stack**: Astro + Starlight
- **Content**: `packages/site/src/content/docs/` (55 MDX files)
- **API reference**: TypeDoc → `docs/api/` (auto-generated HTML)
- **In-package docs**: `scripts/generate-npm-docs.ts` converts site MDX → clean MD, included in npm packages under `docs/`. Each package gets a compact navigator README and relevant doc subset. Generated via `npm run docs:npm` or automatically during `prepublishOnly`.

## Development

```bash
npm run build          # Build core + react + plugins
npm test               # Vitest unit tests
npm run test:e2e       # Playwright E2E tests
npm run dev            # Docker demo on :3150
npm run lint           # ESLint
npm run docs:npm       # Generate npm package docs from site MDX
```
