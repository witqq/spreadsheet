// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Core type definitions for witqq spreadsheet.
 */

// --- Cell Types ---

/** Primitive value types supported by cells. */
export type CellValue = string | number | boolean | Date | null;

/** Data stored in a single cell. */
export interface CellData {
  /** The raw cell value. */
  readonly value: CellValue;
  /** Formatted display string (overrides default rendering). */
  readonly displayValue?: string;
  /** Formula expression (e.g. `"=SUM(A1:A10)"`). */
  readonly formula?: string;
  /** Reference to a shared style in the StylePool. */
  readonly style?: CellStyleRef;
  /** Cell type controlling rendering and editing behavior. */
  readonly type?: CellType;
  /** Optional metadata (status indicators, links, comments). */
  readonly metadata?: CellMetadata;
}

/** Optional metadata attached to a cell. */
export interface CellMetadata {
  /** Change-tracking status for server sync workflows. */
  readonly status?: 'changed' | 'error' | 'saving' | 'saved';
  /** Error message displayed as tooltip on hover. */
  readonly errorMessage?: string;
  /** Hyperlink rendered in the cell. */
  readonly link?: { url: string; label?: string };
  /** Comment text shown on hover. */
  readonly comment?: string;
}

/** Built-in and custom cell type identifiers. */
export type CellType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'dynamicSelect'
  | 'formula'
  | 'link'
  | 'image'
  | 'progressBar'
  | 'rating'
  | 'badge'
  | 'custom';

// --- Style Types ---

/** Visual styling properties for a cell. */
export interface CellStyle {
  /** Background color (CSS color string). */
  readonly bgColor?: string;
  /** Text color (CSS color string). */
  readonly textColor?: string;
  /** Font family name. */
  readonly fontFamily?: string;
  /** Font size in pixels. */
  readonly fontSize?: number;
  /** Font weight. */
  readonly fontWeight?: 'normal' | 'bold';
  /** Font style. */
  readonly fontStyle?: 'normal' | 'italic';
  /** Horizontal text alignment. */
  readonly textAlign?: 'left' | 'center' | 'right';
  /** Vertical text alignment. */
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
  /** Top border style. */
  readonly borderTop?: BorderStyle;
  /** Right border style. */
  readonly borderRight?: BorderStyle;
  /** Bottom border style. */
  readonly borderBottom?: BorderStyle;
  /** Left border style. */
  readonly borderLeft?: BorderStyle;
  /** Number format pattern (e.g. `"#,##0.00"`). */
  readonly numberFormat?: string;
  /** Enable text wrapping within cell. */
  readonly textWrap?: boolean;
  /** Text indentation level. */
  readonly indent?: number;
}

/** Reference to a shared style stored in StylePool. */
export interface CellStyleRef {
  /** Unique style reference key. */
  readonly ref: string;
  /** The resolved style object. */
  readonly style: CellStyle;
}

/** Border styling for a cell edge. */
export interface BorderStyle {
  readonly width: number;
  readonly color: string;
  readonly style: 'solid' | 'dashed' | 'dotted';
}

// --- Geometry Types ---

/** Row and column address of a single cell. */
export interface CellAddress {
  readonly row: number;
  readonly col: number;
}

/** Rectangular range of cells defined by start and end positions. */
export interface CellRange {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
}

/** Pixel-space rectangle for a cell on canvas. */
export interface CellRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// --- Column Types ---

/** Definition of a single table column. */
export interface ColumnDef {
  /** Unique column identifier used for data binding. */
  readonly key: string;
  /** Display title rendered in the header. */
  readonly title: string;
  /** Column width in pixels. */
  readonly width: number;
  /** Minimum width constraint for resize. */
  readonly minWidth?: number;
  /** Maximum width constraint for resize. */
  readonly maxWidth?: number;
  /** Cell type for this column (determines rendering and editing). */
  readonly type?: CellType;
  /** Pin column to frozen pane. */
  readonly frozen?: boolean;
  /** Enable sorting by clicking this column header. */
  readonly sortable?: boolean;
  /** Enable filtering on this column. */
  readonly filterable?: boolean;
  /** Allow inline editing of cells in this column. */
  readonly editable?: boolean;
  /** Allow drag-to-resize this column. */
  readonly resizable?: boolean;
  /** Hide this column from display and print. */
  readonly hidden?: boolean;
  /** Enable text wrapping for cells in this column. */
  readonly wrapText?: boolean;
  /** Validation rules applied to all cells in this column. */
  readonly validation?: import('../validation/validation-engine').SpreadsheetValidationRule[];
}

// --- Selection Types ---

/** Selection mode based on user interaction. */
export type SelectionType = 'cell' | 'range' | 'row' | 'column' | 'all';

/** Current selection state including active cell and selected ranges. */
export interface Selection {
  readonly type: SelectionType;
  readonly ranges: readonly CellRange[];
  readonly activeCell: CellAddress;
  readonly anchorCell: CellAddress;
}

// --- Merge Types ---

/** Rectangular region of merged cells (inclusive bounds). */
export interface MergedRegion {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number; // inclusive
  readonly endCol: number; // inclusive
}

// --- Validation Types ---

/** Rule for validating cell input. */
export interface ValidationRule {
  readonly type: string;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

/** Result of validating a cell value against a rule. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly message?: string;
  readonly severity?: 'error' | 'warning' | 'info';
}

// --- Conditional Format Types ---

export type ComparisonOperator =
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'equal'
  | 'notEqual'
  | 'between'
  | 'notBetween';

export interface ValueCondition {
  readonly type: 'value';
  readonly operator: ComparisonOperator;
  readonly value: number;
  readonly value2?: number; // for between/notBetween
}

export interface GradientStop {
  readonly value: number;
  readonly color: string;
}

export interface GradientScaleCondition {
  readonly type: 'gradientScale';
  readonly stops: readonly GradientStop[];
}

export interface DataBarCondition {
  readonly type: 'dataBar';
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly color: string;
  readonly showValue?: boolean;
}

export type IconSetName = 'arrows' | 'circles' | 'flags' | 'stars';

export interface IconSetThreshold {
  readonly value: number;
  readonly icon: string;
}

export interface IconSetCondition {
  readonly type: 'iconSet';
  readonly iconSet: IconSetName;
  readonly thresholds: readonly IconSetThreshold[];
  readonly showValue?: boolean;
}

export type ConditionalFormatCondition =
  | ValueCondition
  | GradientScaleCondition
  | DataBarCondition
  | IconSetCondition;

/** Conditional formatting rule applied to a cell range. */
export interface ConditionalFormatRule {
  readonly id: string;
  readonly priority: number;
  readonly range: CellRange;
  readonly condition: ConditionalFormatCondition;
  readonly style?: Partial<CellStyle>;
  readonly stopIfTrue?: boolean;
}

// --- Change Tracking Types ---

/** Record of a cell value change for undo/redo and sync. */
export interface CellChange {
  readonly row: number;
  readonly col: number;
  readonly oldValue: CellValue;
  readonly newValue: CellValue;
  readonly timestamp: number;
  readonly userId?: string;
  readonly source: string;
}
