// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

export { Spreadsheet } from './components/Spreadsheet';
export type { SpreadsheetProps, SpreadsheetRef, SpreadsheetCallbacks } from './components/Spreadsheet';

// Re-export core types for convenience
export type {
  CellData,
  CellValue,
  CellStyle,
  CellType,
  ColumnDef,
  Selection,
  SpreadsheetEvents,
  SpreadsheetPlugin,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';

// Re-export event types used in callbacks
export type {
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet';
