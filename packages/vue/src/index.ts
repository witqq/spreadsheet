export { Spreadsheet } from './Spreadsheet';
export type { SpreadsheetExposed } from './Spreadsheet';

export type {
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet';

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

export { SpreadsheetEngine, lightTheme, darkTheme } from '@witqq/spreadsheet';
