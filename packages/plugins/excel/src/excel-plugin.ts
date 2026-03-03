// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ExcelPlugin — SpreadsheetPlugin for Excel import/export via SheetJS.
 *
 * SheetJS (xlsx) is lazy-loaded from CDN on first use.
 * Import: parse .xlsx ArrayBuffer, populate CellStore and derive columns.
 * Export: build workbook from CellStore with values, widths, and merges.
 */

import type { SpreadsheetPlugin, PluginAPI, ColumnDef } from '@witqq/spreadsheet';

export const EXCEL_PLUGIN_NAME = 'excel';

const SHEETJS_CDN_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

// SheetJS global type (minimal subset we use)
interface SheetJSWorkbook {
  SheetNames: string[];
  Sheets: Record<string, SheetJSWorksheet>;
}

interface SheetJSWorksheet {
  [cellRef: string]: SheetJSCell | unknown;
  '!ref'?: string;
  '!cols'?: Array<{ wch?: number; wpx?: number } | undefined>;
  '!merges'?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
}

interface SheetJSCell {
  t: string; // 's'=string, 'n'=number, 'b'=boolean, 'd'=date
  v: unknown; // raw value
  w?: string; // formatted text
  z?: string; // number format
}

interface SheetJSLib {
  read(data: ArrayBuffer, opts?: Record<string, unknown>): SheetJSWorkbook;
  write(wb: SheetJSWorkbook, opts?: Record<string, unknown>): ArrayBuffer;
  utils: {
    decode_range(range: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_range(range: { s: { r: number; c: number }; e: { r: number; c: number } }): string;
    encode_cell(cell: { r: number; c: number }): string;
    decode_cell(cellRef: string): { r: number; c: number };
    book_new(): SheetJSWorkbook;
    book_append_sheet(wb: SheetJSWorkbook, ws: SheetJSWorksheet, name: string): void;
    aoa_to_sheet(data: unknown[][]): SheetJSWorksheet;
  };
}

let xlsxLib: SheetJSLib | null = null;
let loadPromise: Promise<SheetJSLib> | null = null;

async function loadSheetJS(): Promise<SheetJSLib> {
  if (xlsxLib) return xlsxLib;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<SheetJSLib>((resolve, reject) => {
    // Check if already loaded (e.g. from a previous script tag)
    if ((globalThis as Record<string, unknown>).XLSX) {
      xlsxLib = (globalThis as Record<string, unknown>).XLSX as unknown as SheetJSLib;
      resolve(xlsxLib);
      return;
    }

    const script = document.createElement('script');
    script.src = SHEETJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      xlsxLib = (globalThis as Record<string, unknown>).XLSX as unknown as SheetJSLib;
      if (xlsxLib) {
        resolve(xlsxLib);
      } else {
        reject(new Error('SheetJS loaded but XLSX global not found'));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error(`Failed to load SheetJS from ${SHEETJS_CDN_URL}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface ExcelImportResult {
  columns: ColumnDef[];
  rowCount: number;
  sheetName: string;
}

export interface ExcelExportOptions {
  sheetName?: string;
  includeHeaders?: boolean;
  /** Maximum rows to export (default: all, but browser memory limits apply) */
  maxRows?: number;
}

export class ExcelPlugin implements SpreadsheetPlugin {
  readonly name = EXCEL_PLUGIN_NAME;
  readonly version = '1.0.0';

  private api: PluginAPI | null = null;

  install(api: PluginAPI): void {
    this.api = api;
  }

  destroy(): void {
    this.api = null;
  }

  /**
   * Import an .xlsx file buffer into the grid.
   * Populates CellStore with values and derives ColumnDef from sheet columns.
   * Returns metadata about the imported sheet.
   */
  async importExcel(buffer: ArrayBuffer, sheetIndex = 0): Promise<ExcelImportResult> {
    const engine = this.getEngine();
    const XLSX = await loadSheetJS();

    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) {
      throw new Error(`Sheet index ${sheetIndex} not found (${wb.SheetNames.length} sheets available)`);
    }

    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) {
      throw new Error(`Sheet "${sheetName}" is empty`);
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRow = range.s.r;
    const dataStartRow = headerRow + 1;
    const colCount = range.e.c - range.s.c + 1;
    const dataRowCount = range.e.r - dataStartRow + 1;

    // Derive columns from header row
    const columns: ColumnDef[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
      const cell = ws[cellRef] as SheetJSCell | undefined;
      const headerText = cell?.w ?? cell?.v?.toString() ?? `Column ${c + 1}`;

      // Check a few data cells to infer type
      const colType = inferColumnType(ws, XLSX, dataStartRow, c, Math.min(dataRowCount, 10));

      // Get column width from !cols metadata
      const colMeta = ws['!cols']?.[c];
      const width = colMeta?.wpx ?? (colMeta?.wch ? colMeta.wch * 7 : 100);

      columns.push({
        key: `col_${c}`,
        title: headerText,
        width: Math.max(50, Math.min(300, width)),
        type: colType,
      });
    }

    // Clear existing data and merges
    const cellStore = engine.getCellStore();
    cellStore.clear();
    engine.getMergeManager().clearAll();

    // Set row count
    engine.setRowCount(Math.max(dataRowCount, 0));

    // Populate cell data
    for (let r = dataStartRow; r <= range.e.r; r++) {
      const dataRow = r - dataStartRow;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef] as SheetJSCell | undefined;
        if (!cell) continue;

        const value = convertCellValue(cell);
        if (value !== null) {
          cellStore.setValue(dataRow, c - range.s.c, value);
        }
      }
    }

    // Handle merged regions
    if (ws['!merges'] && ws['!merges'].length > 0) {
      for (const merge of ws['!merges']) {
        // Adjust for header row offset
        const startRow = merge.s.r - dataStartRow;
        const endRow = merge.e.r - dataStartRow;
        if (startRow < 0) continue; // Skip header merges

        engine.mergeCells({
          startRow,
          startCol: merge.s.c - range.s.c,
          endRow,
          endCol: merge.e.c - range.s.c,
        });
      }
    }

    engine.requestRender();

    return { columns, rowCount: dataRowCount, sheetName };
  }

  /**
   * Export the current grid data to an .xlsx ArrayBuffer.
   */
  async exportExcel(options?: ExcelExportOptions): Promise<ArrayBuffer> {
    const engine = this.getEngine();
    const XLSX = await loadSheetJS();

    const config = engine.getConfig();
    const columns = config.columns;
    const cellStore = engine.getCellStore();
    const includeHeaders = options?.includeHeaders !== false;
    const headerOffset = includeHeaders ? 1 : 0;

    // Build worksheet directly from sparse cells (avoids huge 2D array)
    const ws: SheetJSWorksheet = {};

    // Header row
    if (includeHeaders) {
      for (let c = 0; c < columns.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        ws[cellRef] = { t: 's', v: columns[c].title };
      }
    }

    // Data cells — write directly from sparse cellStore
    const rowLimit = options?.maxRows ?? 1048576;
    let maxRow = -1;
    let maxCol = columns.length - 1;
    for (const { row, col, data } of cellStore.entries()) {
      if (data.value == null || row >= rowLimit) continue;
      const r = row + headerOffset;
      const c = col;
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const v = data.value;
      if (typeof v === 'number') {
        ws[cellRef] = { t: 'n', v };
      } else if (typeof v === 'boolean') {
        ws[cellRef] = { t: 'b', v };
      } else {
        ws[cellRef] = { t: 's', v: String(v) };
      }
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }

    // Set sheet range
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRow + headerOffset, c: maxCol },
    });

    // Set column widths
    ws['!cols'] = columns.map((col) => ({
      wpx: col.width,
    }));

    // Set merged regions
    const mergeManager = engine.getMergeManager();
    const regions = mergeManager.getAllRegions();
    if (regions.length > 0) {
      ws['!merges'] = regions.map((region) => ({
        s: { r: region.startRow + headerOffset, c: region.startCol },
        e: { r: region.endRow + headerOffset, c: region.endCol },
      }));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName ?? 'Sheet1');

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }

  private getEngine() {
    if (!this.api) {
      throw new Error('ExcelPlugin not installed');
    }
    return this.api.engine;
  }
}

// ─── Utility functions ────────────────────────────────────────

function inferColumnType(
  ws: SheetJSWorksheet,
  XLSX: SheetJSLib,
  startRow: number,
  col: number,
  sampleSize: number,
): 'number' | 'date' | 'boolean' | 'string' {
  let numberCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  let total = 0;

  for (let r = startRow; r < startRow + sampleSize; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: col });
    const cell = ws[cellRef] as SheetJSCell | undefined;
    if (!cell) continue;
    total++;

    switch (cell.t) {
      case 'n':
        numberCount++;
        break;
      case 'd':
        dateCount++;
        break;
      case 'b':
        boolCount++;
        break;
    }
  }

  if (total === 0) return 'string';
  if (numberCount / total >= 0.7) return 'number';
  if (dateCount / total >= 0.7) return 'date';
  if (boolCount / total >= 0.7) return 'boolean';
  return 'string';
}

function convertCellValue(cell: SheetJSCell): string | number | boolean | null {
  switch (cell.t) {
    case 'n':
      return typeof cell.v === 'number' ? cell.v : null;
    case 's':
      return typeof cell.v === 'string' ? cell.v : String(cell.v ?? '');
    case 'b':
      return typeof cell.v === 'boolean' ? cell.v : null;
    case 'd':
      // Return date as ISO string
      return cell.v instanceof Date ? cell.v.toISOString().split('T')[0] : String(cell.v ?? '');
    default:
      return cell.v != null ? String(cell.v) : null;
  }
}
