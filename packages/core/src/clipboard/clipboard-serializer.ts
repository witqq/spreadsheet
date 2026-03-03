// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Pure functions for clipboard data serialization and deserialization.
 *
 * TSV (tab-separated values) for plain text copy/paste.
 * HTML table for Excel/Google Sheets interop.
 */

import type { CellValue } from '../types/interfaces';

/**
 * Serialize a 2D array of cell values to TSV.
 * Rows separated by newlines, cells by tabs.
 */
export function serializeToTSV(data: CellValue[][]): string {
  return data.map((row) => row.map(formatCellValue).join('\t')).join('\n');
}

/**
 * Serialize a 2D array of cell values to an HTML table.
 * Compatible with Excel and Google Sheets paste.
 */
export function serializeToHTML(data: CellValue[][]): string {
  const rows = data
    .map((row) => {
      const cells = row.map((cell) => `<td>${escapeHTML(formatCellValue(cell))}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table>${rows}</table>`;
}

/**
 * Parse TSV string into a 2D array of cell values.
 * Handles \r\n and \n line endings. Trailing empty line is stripped.
 */
export function parseTSV(text: string): CellValue[][] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => line.split('\t').map(coerceValue));
}

/**
 * Parse an HTML table into a 2D array of cell values.
 * Handles Excel, Google Sheets, and standard HTML table formats.
 * Returns null if no table found.
 */
export function parseHTML(html: string): CellValue[][] | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const result: CellValue[][] = [];
  const rows = table.querySelectorAll('tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    const rowData: CellValue[] = [];
    for (const cell of cells) {
      rowData.push(coerceValue(cell.textContent?.trim() ?? ''));
    }
    result.push(rowData);
  }
  return result.length > 0 ? result : null;
}

function formatCellValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Coerce string to typed value: number, boolean, or string. Empty → null. */
function coerceValue(text: string): CellValue {
  if (text === '') return null;
  const num = Number(text);
  if (!isNaN(num) && text.trim() !== '') return num;
  const lower = text.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return text;
}
