// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { PivotConfig, PivotMeasure, PivotResult, PivotColumnDef } from './types';

const KEY_SEP = '\0';

export class PivotEngine {
  /**
   * Compute a pivot table from flat source data.
   * Groups rows by rowDimensions, cross-tabulates by columnDimensions,
   * and applies aggregation functions to measures.
   * Stores source row indices per output cell for drill-down.
   */
  compute(sourceData: Record<string, unknown>[], config: PivotConfig): PivotResult {
    const { rowDimensions, columnDimensions, measures } = config;

    if (measures.length === 0) {
      throw new Error('PivotEngine: at least one measure is required');
    }

    // Build pivot map: rowKey → colKey → source row indices
    const pivotMap = new Map<string, Map<string, number[]>>();
    const colKeySet = new Set<string>();

    for (let i = 0; i < sourceData.length; i++) {
      const row = sourceData[i];
      const rowKey = rowDimensions.map((d) => String(row[d] ?? '')).join(KEY_SEP);
      const colKey =
        columnDimensions.length > 0
          ? columnDimensions.map((d) => String(row[d] ?? '')).join(KEY_SEP)
          : '_total';

      colKeySet.add(colKey);

      let rowMap = pivotMap.get(rowKey);
      if (!rowMap) {
        rowMap = new Map();
        pivotMap.set(rowKey, rowMap);
      }

      let bucket = rowMap.get(colKey);
      if (!bucket) {
        bucket = [];
        rowMap.set(colKey, bucket);
      }
      bucket.push(i);
    }

    // Sort column keys for deterministic output
    const colKeys = Array.from(colKeySet).sort();

    // Build column definitions
    const columns: PivotColumnDef[] = [];

    for (const dim of rowDimensions) {
      columns.push({
        key: `_dim_${dim}`,
        title: dim,
        width: 130,
        frozen: true,
        editable: false,
      });
    }

    for (const colKey of colKeys) {
      const colLabel = colKey === '_total' ? '' : colKey.split(KEY_SEP).join(' / ');

      for (const measure of measures) {
        const measureLabel = measure.label ?? `${measure.aggregate}(${measure.field})`;
        const title = colLabel ? `${colLabel} — ${measureLabel}` : measureLabel;

        columns.push({
          key: `_val_${colKey}${KEY_SEP}${measure.field}${KEY_SEP}${measure.aggregate}`,
          title,
          width: 130,
          type: 'number',
          editable: false,
        });
      }
    }

    // Build output rows and source row index map
    const rowKeys = Array.from(pivotMap.keys()).sort();
    const rows: Record<string, unknown>[] = [];
    const sourceRowIndices = new Map<string, number[]>();
    const numDimCols = rowDimensions.length;

    for (let outputRow = 0; outputRow < rowKeys.length; outputRow++) {
      const rowKey = rowKeys[outputRow];
      const outputRowData: Record<string, unknown> = {};
      const rowValues = rowKey.split(KEY_SEP);

      for (let i = 0; i < rowDimensions.length; i++) {
        outputRowData[`_dim_${rowDimensions[i]}`] = rowValues[i];
      }

      const rowMap = pivotMap.get(rowKey)!;
      let outputCol = numDimCols;

      for (const colKey of colKeys) {
        const indices = rowMap.get(colKey) ?? [];
        const matchingRows = indices.map((idx) => sourceData[idx]);

        for (const measure of measures) {
          const key = `_val_${colKey}${KEY_SEP}${measure.field}${KEY_SEP}${measure.aggregate}`;
          outputRowData[key] = this.aggregate(matchingRows, measure);

          // Store source row indices for drill-down (all measures in same group share indices)
          sourceRowIndices.set(`${outputRow}:${outputCol}`, indices);
          outputCol++;
        }
      }

      rows.push(outputRowData);
    }

    return {
      columns,
      rows,
      frozenColumns: rowDimensions.length,
      sourceRowIndices,
    };
  }

  /**
   * Get source rows for a drill-down cell.
   * Returns the subset of sourceData that contributed to the aggregate at (row, col).
   */
  getDrillDownRows(
    sourceData: Record<string, unknown>[],
    result: PivotResult,
    outputRow: number,
    outputCol: number,
  ): Record<string, unknown>[] {
    const indices = result.sourceRowIndices.get(`${outputRow}:${outputCol}`);
    if (!indices) return [];
    return indices.map((idx) => sourceData[idx]);
  }

  private aggregate(rows: Record<string, unknown>[], measure: PivotMeasure): number | null {
    if (rows.length === 0) return null;

    if (measure.aggregate === 'count') {
      return rows.length;
    }

    const values: number[] = [];
    for (const r of rows) {
      const v = r[measure.field];
      if (typeof v === 'number' && !isNaN(v)) {
        values.push(v);
      }
    }

    if (values.length === 0) return null;

    switch (measure.aggregate) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return values.reduce((a, b) => (a < b ? a : b));
      case 'max':
        return values.reduce((a, b) => (a > b ? a : b));
      default:
        return null;
    }
  }
}
