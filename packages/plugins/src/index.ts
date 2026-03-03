// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

// @witqq/spreadsheet-plugins — barrel export
// Plugins are loaded lazily; import from subdirectories directly.
export {
  createContextMenuPlugin,
  registerMenuItem,
  unregisterMenuItem,
  CONTEXT_MENU_PLUGIN_NAME,
} from '../context-menu/src/index';
export type { ContextMenuPluginState } from '../context-menu/src/index';
export { FormulaPlugin, FORMULA_PLUGIN_NAME } from '../formula/src/index';
export { evaluateFormula } from '../formula/src/index';
export {
  ConditionalFormattingPlugin,
  ConditionalFormatLayer,
  CONDITIONAL_FORMAT_PLUGIN_NAME,
  ICON_SETS,
  toNumber,
  evaluateComparison,
  interpolateColor,
} from '../conditional-format/src/index';
export { ExcelPlugin, EXCEL_PLUGIN_NAME } from '../excel/src/index';
export type { ExcelImportResult, ExcelExportOptions } from '../excel/src/index';
export {
  CollaborationPlugin,
  transform as otTransform,
  transformAgainstAll,
  MockTransport,
  WebSocketTransport,
  RemoteCursorLayer,
} from './collaboration/index';
export type {
  CollaborationPluginConfig,
  TransformResult,
  OTOperation,
  SetCellValueOp,
  InsertRowOp,
  DeleteRowOp,
  VersionedOperation,
  OTTransport,
  WebSocketTransportConfig,
  CursorInfo,
  RemoteCursor,
} from './collaboration/index';
export {
  ProgressiveLoaderPlugin,
  ProgressOverlay,
  PROGRESSIVE_LOADER_PLUGIN_NAME,
} from '../progressive-loader/src/index';
export type { ProgressiveLoaderConfig } from '../progressive-loader/src/index';
