// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellType } from '../types/interfaces';

export type PivotAggregateFunction = 'sum' | 'count' | 'average' | 'min' | 'max';

export interface PivotMeasure {
  /** Source data field to aggregate */
  field: string;
  /** Aggregation function */
  aggregate: PivotAggregateFunction;
  /** Display label (defaults to `aggregate(field)`) */
  label?: string;
}

export interface PivotConfig {
  /** Fields for row grouping (left side of pivot) */
  rowDimensions: string[];
  /** Fields for column grouping (top of pivot) */
  columnDimensions: string[];
  /** Value measures with aggregation */
  measures: PivotMeasure[];
}

export interface PivotColumnDef {
  readonly key: string;
  readonly title: string;
  readonly width: number;
  readonly type?: CellType;
  readonly frozen?: boolean;
  readonly editable?: boolean;
}

export interface PivotResult {
  /** Column definitions for the pivot output */
  columns: PivotColumnDef[];
  /** Flat rows of pivoted data */
  rows: Record<string, unknown>[];
  /** Number of frozen columns (= rowDimensions.length) */
  frozenColumns: number;
  /** Map from "outputRow:outputCol" → indices into sourceData for drill-down */
  sourceRowIndices: Map<string, number[]>;
}
