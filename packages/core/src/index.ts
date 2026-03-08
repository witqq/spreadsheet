// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * @witqq/spreadsheet — Canvas-based spreadsheet engine
 *
 * Framework-agnostic core with zero external dependencies.
 * Use @witqq/spreadsheet-react for React integration.
 */

// Engine
export { SpreadsheetEngine } from './engine/spreadsheet-engine';
export type { SpreadsheetEngineConfig } from './engine/spreadsheet-engine';

// Constants
export { LINE_HEIGHT_MULTIPLIER } from './constants';

// Auto Row Size
export { AutoRowSizeManager } from './auto-row-size/auto-row-size-manager';
export type {
  AutoRowSizeConfig,
  ApplyHeightsCallback,
} from './auto-row-size/auto-row-size-manager';

// Commands
export type { Command } from './commands/command';
export { CellEditCommand } from './commands/cell-edit-command';
export { BatchCellEditCommand } from './commands/batch-cell-edit-command';
export type { CellEdit } from './commands/batch-cell-edit-command';
export { ResizeColumnCommand } from './commands/resize-column-command';
export { MergeCellsCommand, UnmergeCellsCommand } from './commands/merge-commands';
export { CommandManager } from './commands/command-manager';
export type { CommandManagerConfig, CommandCallback } from './commands/command-manager';

// Clipboard
export { ClipboardManager } from './clipboard/clipboard-manager';
export type { ClipboardManagerConfig } from './clipboard/clipboard-manager';
export {
  serializeToTSV,
  serializeToHTML,
  parseTSV,
  parseHTML,
} from './clipboard/clipboard-serializer';

// Types
export type {
  CellData,
  CellValue,
  CellStyle,
  CellType,
  CellAddress,
  CellRange,
  CellRect,
  CellMetadata,
  ColumnDef,
  Selection,
  MergedRegion,
  ValidationRule,
  ValidationResult,
  ConditionalFormatRule,
  ConditionalFormatCondition,
  ValueCondition,
  GradientScaleCondition,
  GradientStop,
  DataBarCondition,
  IconSetCondition,
  IconSetThreshold,
  IconSetName,
  ComparisonOperator,
  CellChange,
  CellStyleRef,
  SelectionType,
  BorderStyle,
} from './types/interfaces';

// Events
export { EventBus } from './events/event-bus';
export { EventTranslator } from './events/event-translator';
export type { EventTranslatorConfig } from './events/event-translator';
export type {
  SpreadsheetEvents,
  CellEvent,
  CellChangeEvent,
  CommandEvent,
  ClipboardDataEvent,
  ColumnResizeEvent,
  RowResizeEvent,
  CellStatusChangeEvent,
  CellValidationEvent,
  SelectionChangeEvent,
  ScrollEvent,
  GridMouseEvent,
  GridKeyboardEvent,
  HitTestResult,
  HitRegion,
  RowGroupToggleEvent,
  RowGroupChangeEvent,
} from './events/event-types';

// Plugins
export type { SpreadsheetPlugin, PluginAPI } from './plugins/plugin-types';

// Renderer
export { CanvasManager } from './renderer/canvas-manager';
export type { CanvasManagerConfig } from './renderer/canvas-manager';
export { GridRenderer } from './renderer/grid-renderer';
export type { GridRenderConfig } from './renderer/grid-renderer';
export { GridGeometry } from './renderer/grid-geometry';
export type { GridGeometryConfig } from './renderer/grid-geometry';
export { LayoutEngine } from './renderer/layout-engine';
export type { LayoutEngineConfig } from './renderer/layout-engine';
export { ViewportManager } from './renderer/viewport-manager';
export type {
  ViewportRange,
  ViewportConfig,
  FrozenViewportRanges,
} from './renderer/viewport-manager';
export { RenderScheduler } from './renderer/render-scheduler';
export { DirtyTracker } from './renderer/dirty-tracker';
export type { DirtyRegion, DirtyCell, DirtyRect } from './renderer/dirty-tracker';
export { ScrollManager } from './renderer/scroll-manager';
export type { ScrollManagerConfig } from './renderer/scroll-manager';
export { RenderPipeline } from './renderer/render-pipeline';
export type { FrozenPaneConfig } from './renderer/render-pipeline';
export type { RenderLayer, RenderContext, PaneRegion } from './renderer/render-layer';
export { CellTextLayer } from './renderer/layers/cell-text-layer';
export { TextMeasureCache } from './renderer/text-measure-cache';
export type { RenderMode } from './renderer/render-layer';

// Data Model
export { CellStore } from './model/cell-store';
export { RowStore } from './model/row-store';
export { ColStore } from './model/col-store';
export { StylePool } from './model/style-pool';

// DataView
export { DataView } from './dataview/data-view';
export type { DataViewConfig } from './dataview/data-view';

// Sort
export { SortEngine, compareCellValues } from './sort/sort-engine';
export type { SortColumn, SortDirection, SortEngineConfig } from './sort/sort-engine';
export type { SortChangeEvent, SortRejectedEvent } from './events/event-types';

// Filter
export { FilterEngine, evaluateCondition } from './filter/filter-engine';
export type { FilterCondition, FilterOperator, FilterEngineConfig } from './filter/filter-engine';
export { FilterPanel } from './filter/filter-panel';
export type { FilterPanelConfig } from './filter/filter-panel';
export type { FilterChangeEvent } from './events/event-types';

// Pivot
export { PivotEngine } from './pivot/pivot-engine';
export type {
  PivotConfig,
  PivotMeasure,
  PivotAggregateFunction,
  PivotResult,
  PivotColumnDef,
} from './pivot/types';

// Grouping
export { RowGroupManager } from './grouping/row-group-manager';
export type {
  RowGroupDef,
  ColumnAggregate,
  AggregateFunction,
  AggregateResult,
} from './grouping/row-group-manager';
export { RowGroupToggleLayer } from './renderer/layers/row-group-toggle-layer';

// Editing
export { InlineEditor } from './editing/inline-editor';
export type { InlineEditorConfig, EditorCloseReason } from './editing/inline-editor';
export { DatePickerOverlay } from './editing/date-picker-overlay';
export type { DatePickerConfig } from './editing/date-picker-overlay';
export { DatePickerEditor } from './editing/date-picker-editor';
export { DateTimeEditor } from './editing/date-time-editor';
export { CellEditorRegistry } from './editing/cell-editor-registry';
export type {
  CellEditor,
  CellEditorContext,
  CellEditorCommit,
  CellEditorClose,
  CellEditorMatcher,
  CellEditorRegistration,
} from './editing/cell-editor';

// Selection
export { SelectionManager } from './selection/selection-manager';
export type { SelectionManagerConfig } from './selection/selection-manager';
export { KeyboardNavigator } from './selection/keyboard-navigator';
export type { KeyboardNavigatorConfig } from './selection/keyboard-navigator';

// Cell Types
export { CellTypeRegistry } from './types/cell-type-registry';
export type { CellTypeRenderer, CellAlignment } from './types/cell-type-registry';

// Themes
export type { SpreadsheetTheme } from './themes/theme-types';
export { lightTheme, darkTheme } from './themes/built-in-themes';

// Resize
export { ColumnResizeManager } from './resize/column-resize-manager';
export type { ColumnResizeManagerConfig } from './resize/column-resize-manager';
export { ColumnStretchManager } from './resize/column-stretch-manager';
export type { ColumnStretchConfig, StretchMode } from './resize/column-stretch-manager';
export { RowResizeManager } from './resize/row-resize-manager';
export type { RowResizeManagerConfig } from './resize/row-resize-manager';
export { ResizeRowCommand } from './commands/resize-row-command';

// Render Layers
export { CellStatusLayer } from './renderer/layers/cell-status-layer';
export { EmptyStateLayer } from './renderer/layers/empty-state-layer';
export { FillHandleLayer } from './renderer/layers/fill-handle-layer';

// Tooltip
export { TooltipManager } from './tooltip/tooltip-manager';
export type { TooltipManagerConfig } from './tooltip/tooltip-manager';

// Autofill
export { AutofillManager } from './autofill/autofill-manager';
export type { AutofillManagerConfig, FillDirection } from './autofill/autofill-manager';
export { detectPattern, extendPattern } from './autofill/pattern-detector';
export type { DetectedPattern, PatternType } from './autofill/pattern-detector';

// Autofill Events
export type {
  AutofillStartEvent,
  AutofillPreviewEvent,
  AutofillCompleteEvent,
} from './events/event-types';

// Change Tracking
export { ChangeTracker } from './tracking/change-tracker';
export type { ChangeTrackerConfig } from './tracking/change-tracker';

// Validation
export { ValidationEngine } from './validation/validation-engine';
export type {
  ValidationEngineConfig,
  SpreadsheetValidationRule,
  RequiredRule,
  RangeRule,
  RegexRule,
  CustomRule,
} from './validation/validation-engine';

// Merge
export { MergeManager } from './merge/merge-manager';

// Context Menu
export { ContextMenuManager } from './context-menu/context-menu-manager';
export type {
  ContextMenuItem,
  MenuContext,
  MenuActionContext,
  ContextMenuManagerConfig,
} from './context-menu/context-menu-manager';
export { createDefaultMenuItems } from './context-menu/default-items';

// ARIA Accessibility
export { AriaManager } from './aria/aria-manager';
export type { AriaManagerConfig } from './aria/aria-manager';

export { PrintManager } from './print/print-manager';
export type { PrintManagerConfig } from './print/print-manager';

// Row Commands
export { InsertRowCommand, DeleteRowCommand } from './commands/row-commands';
export type { RowCommandDeps } from './commands/row-commands';

// Streaming
export { StreamingAdapter } from './streaming/streaming-adapter';
export type { StreamingAdapterOptions } from './streaming/streaming-adapter';

// Benchmark
export {
  measureInitTime,
  measureMultiRun,
  measureThroughput,
  computeStats,
  FPSCounter,
  BenchmarkRunner,
} from './benchmark/performance-benchmark';
export type {
  BenchmarkResult,
  FPSResult,
  TimingResult,
  RunStats,
  BenchmarkMetric,
  BenchmarkSuiteResult,
} from './benchmark/performance-benchmark';

// Locale
export type { SpreadsheetLocale } from './locale/locale-types';
export type { ResolvedLocale } from './locale/resolve-locale';
export { resolveLocale } from './locale/resolve-locale';
export { enLocale } from './locale/en';
export { ruLocale } from './locale/ru';
