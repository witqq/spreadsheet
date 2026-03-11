# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `CellData.custom` field: extensible `Record<string, unknown>` for user-defined data, preserved through `setValue()` and `setMetadata()`
- `CellDecorator` methods now receive optional `row` and `col` parameters: `render()`, `getWidth()`, `getHitZones()`
- `CellStore.bulkLoadCellData()`: bulk load complete `CellData` objects from a 2D array, storing value, type, style, metadata, and custom fields in one pass
- `SpreadsheetEngine.bulkLoadCellData()`: public API for bulk loading complete cell data with dirty tracking and render scheduling
- `@witqq/spreadsheet-react`: all public engine events exposed as React callback props (`onCellClick`, `onCellDoubleClick`, `onCellHover`, `onDestroy`, `onCommandExecute`, `onCommandUndo`, `onCommandRedo`, `onClipboardCopy`, `onClipboardCut`, `onClipboardPaste`, `onColumnResize`, `onColumnResizeStart`, `onColumnResizeEnd`, `onRowResize`, `onRowResizeStart`, `onRowResizeEnd`, `onCellStatusChange`, `onCellValidation`, `onAutofillStart`, `onAutofillPreview`, `onAutofillComplete`, `onSortRejected`, `onRowGroupToggle`, `onRowGroupChange`, `onThemeChange`)
- `@witqq/spreadsheet-react`: re-exports all event types (`CellEvent`, `CommandEvent`, `ClipboardDataEvent`, `ColumnResizeEvent`, `RowResizeEvent`, `CellStatusChangeEvent`, `CellValidationEvent`, `AutofillStartEvent`, `AutofillPreviewEvent`, `AutofillCompleteEvent`, `SortRejectedEvent`, `RowGroupToggleEvent`, `RowGroupChangeEvent`)
- `@witqq/spreadsheet`: exports `AutofillStartEvent`, `AutofillPreviewEvent`, `AutofillCompleteEvent` from package index

### Changed
- **BREAKING:** `CellTypeRenderer.render()` second parameter changed from `CellValue` to `CellData` (full cell data object); optional `row` and `col` trailing parameters added
- **BREAKING:** `CellTypeRenderer.measureHeight()` second parameter changed from `CellValue` to `CellData`; optional `row` and `col` trailing parameters added
- **BREAKING:** `CellTypeRenderer.getHitZones()` first parameter changed from `CellValue` to `CellData`; optional `row` and `col` trailing parameters added
- `CellTypeRenderer.format()` now accepts optional trailing `cellData`, `row`, `col` parameters (backward compatible)

## [0.3.0] — 2026-03-11

### Added
- Cell Decorator API: `CellDecorator`, `CellDecoratorPosition`, `CellDecoratorRegistration` interfaces for composable rendering addons
- `CellTypeRegistry.addDecorator()` and `removeDecorator()` for managing cell decorators with `appliesTo` predicates
- `CellTypeRegistry.getDecorators()` returns applicable decorators for a given cell
- Decorator rendering pipeline in `CellTextLayer`: underlay → left → right → text/custom → overlay position order
- Left/right decorators reserve horizontal width, shifting cell text inward; `measureHeights()` accounts for decorator widths
- Decorator hit zone resolution in `EventTranslator.resolveHitZone()` with position-aware coordinate translation
- Sub-cell hit testing API: `HitZone` interface for declaring interactive zones within cells
- `CellTypeRenderer.getHitZones()` optional method for cell types to declare rectangular hit zones with custom cursor styles
- `HitTestResult.hitZone` and `HitTestResult.hitZoneCursor` fields for sub-cell zone identification
- `CellEvent.hitZone` optional field on `cellClick`, `cellDoubleClick`, and `cellHover` events
- `cellHover` public event emitted on mousemove over cells (no buttons pressed)
- `EventTranslator.resolveHitZone()` — point-in-rect resolution using cell-relative coordinates
- Cursor management: hit zones with `cursor` property automatically set the container cursor on hover
- Per-cell `bgColor` rendering in `BackgroundLayer` with lazy clipping and merged cell support
- Per-cell `textColor` and font properties (`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`) rendering in `CellTextLayer`
- Per-cell `textAlign` (`left`/`center`/`right`) rendering in `CellTextLayer`, overriding cell type defaults
- Per-cell `verticalAlign` (`top`/`middle`/`bottom`) rendering in `CellTextLayer` for single-line and wrapped text
- Per-cell `textWrap` bidirectional override in `CellTextLayer` — cell-level wrap enables or disables wrapping regardless of `ColumnDef.wrapText`
- Per-cell `indent` rendering in `CellTextLayer` — shifts text position and reduces available width
- Per-cell border rendering in `GridLinesLayer` — `borderTop`, `borderRight`, `borderBottom`, `borderLeft` with color, width, and line style (solid/dashed/dotted)
- Shared border conflict resolution: thicker border wins; equal thickness → rightmost/bottommost cell takes precedence
- `ConditionalFormatLayer` now renders `textColor` from conditional format rules
- E2E Playwright tests for per-cell style rendering (`tests/e2e/per-cell-style.test.ts`)
- Comprehensive API reference in all package READMEs (`packages/*/README.md`) for LLM/agent consumption from node_modules — 325 exports documented across core (220), react (18), vue (19), angular (13), plugins (40), widget (12), server (3)
- Root README rewritten as LLM navigation hub with package decision tree and API overview
- Re-exported `CellStyleRef`, `SelectionType`, `BorderStyle` types from `packages/core/src/index.ts`
- Performance benchmark suite with `BenchmarkRunner`, `measureMultiRun`, `computeStats`, `measureThroughput` utilities
- `npm run benchmark` script for running performance benchmarks
- Baseline metrics for 6 categories across 1K/10K/100K row datasets
- `TextMeasureCache.measureEmHeight()` for font em-height measurement
- `TextMeasureCache.getWrappedLines()` for word-boundary text wrapping with character-level fallback
- `TextMeasureCache.countWrappedLines()` and `measureWrappedHeight()` for wrapped text height computation
- `ColumnDef.wrapText` option to enable word-wrap rendering per column
- Multi-line wrapped text rendering in `CellTextLayer` when `wrapText` is enabled
- E2E Playwright test for word-wrap visual verification (`tests/e2e/word-wrap.test.ts`)
- `LINE_HEIGHT_MULTIPLIER` shared constant (1.2) for consistent line-height across text rendering
- `RowStore` auto/manual height separation: `setAutoHeight()`, `setAutoHeightsBatch()`, `clearAutoHeight()`, `clearAllAutoHeights()`, `isManual()`, `isAuto()`
- `LayoutEngine.setRowHeightsBatch()` for O(n) batch row height updates (vs O(n²) for individual calls)
- `CellTypeRenderer.measureHeight()` optional method for custom cell type height measurement
- `RenderLayer.measureHeights()` optional method for bulk row height measurement by render layers
- `CellTextLayer.measureHeights()` implementation for measuring wrapped text row heights
- `SpreadsheetEngine.setAutoRowHeights()` for batch auto-measured height updates with manual-always-wins priority
- `AutoRowSizeManager` class: orchestrates automatic row height measurement with viewport-first sync strategy and off-screen async measurement via `requestIdleCallback`
- `SpreadsheetEngineConfig.autoRowHeight` option to enable auto row height (`boolean` or `AutoRowSizeConfig` with `batchSize`, `minRowHeight`, `cellPadding`)
- `SpreadsheetEngine.getAutoRowSizeManager()` accessor for the auto row size manager instance
- `AutoRowSizeManager` dirty tracking: `markDirtyRows()`, `markAllDirty()`, `clearDirty()`, `hasDirtyRows`, `isRowDirty()`, `isAllDirty`, `dirtyRowCount`
- `AutoRowSizeManager.startDirtyMeasurement()` for efficient re-measurement of only dirty rows
- Scroll compensation in `setAutoRowHeights()`: adjusts scroll position when row heights change above viewport to prevent visual jumping
- `SpreadsheetEngine.markAutoRowHeightDirty()` and `markAllAutoRowHeightDirty()` public API for triggering dirty re-measurement
- Auto row height integration with `setCell()`: cell value changes mark the row dirty for re-measurement
- Auto row height integration with column resize: resizing a wrap-enabled column triggers full re-measurement
- `ColumnStretchManager` class: distributes available container width across columns with two modes ('all' and 'last')
- `SpreadsheetEngineConfig.stretchColumns` option: `'all'` distributes extra space evenly among stretchable columns, `'last'` gives remaining space to the last visible column
- `LayoutEngine.setColumnWidthsBatch()` for efficient batch column width updates (single recomputation pass)
- Column stretch recalculation on container resize via existing `ResizeObserver`
- Manual column resize exclusion: manually resized columns are excluded from stretch distribution in 'all' mode
- Frozen column handling: frozen columns are excluded from stretch distribution
- `DatePickerOverlay` class: pure-DOM calendar widget for date-type cell editing, positioned below target cell
- `CellEditor` interface and `CellEditorRegistry` for extensible cell editing with type-based editor resolution
- `DatePickerEditor` adapter wrapping `DatePickerOverlay` as a `CellEditor` implementation
- `DateTimeEditor` class: combined date+time picker (calendar + hour/minute spin controls) for `datetime` columns, commits ISO `YYYY-MM-DDTHH:mm` format
- `'datetime'` added to `CellType` union type
- `dateTimePicker` section added to `SpreadsheetLocale` interface (hour, minute, now, ariaLabel) with EN and RU translations
- Date picker opens on double-click, F2, or type-to-edit for columns with `type: 'date'`
- Calendar month/year navigation, day grid with keyboard navigation (arrows, Enter, Escape, Tab)
- Date selection commits value in YYYY-MM-DD format via command system (undo/redo supported)
- Grid scroll and outside click close the date picker
- Today button for quick date selection
- ARIA attributes on date picker overlay (role=dialog, aria-label)
- `ContextMenuItem.submenu` optional field for recursive nested submenus
- Submenu chevron indicator (`▸`) on items with submenus
- Submenu opens on hover (200ms delay) or ArrowRight key, closes on ArrowLeft or Escape
- Nested submenus supported recursively to arbitrary depth
- Empty menu prevention: parent items with all invisible submenu children are hidden
- Keyboard navigation within submenus (ArrowUp/Down), Escape closes one level at a time
- Interactive demo page with sidebar layout showcasing all library features
- Demo sidebar sections: Display (theme, stretch, auto row height), Data (1M rows, progressive load, streaming), Views (grouping, pivot), Import/Export (Excel, print), Collaboration
- Demo feature badges showing active engine configuration
- Demo context menu items with Insert and Format submenus for submenu showcase
