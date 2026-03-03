// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { ColumnDef } from '../types/interfaces';
import type { RowStore } from '../model/row-store';
import type { SpreadsheetTheme } from '../themes/theme-types';

/**
 * PrintManager — generates a print-friendly HTML table and injects @media print CSS.
 *
 * On print: hides canvas/scroll UI, shows a temporary DOM <table> with all visible data.
 * Cleans up after the print dialog closes.
 */

export interface PrintManagerConfig {
  container: HTMLElement;
  cellStore: CellStore;
  dataView: DataView;
  columns: ColumnDef[];
  rowStore: RowStore;
  theme: SpreadsheetTheme;
  /** Maximum rows to include in print output (default: 10000). */
  maxPrintRows?: number;
}

export class PrintManager {
  private config: PrintManagerConfig;
  private styleElement: HTMLStyleElement | null = null;
  private printTable: HTMLTableElement | null = null;
  private afterPrintHandler: (() => void) | null = null;

  constructor(config: PrintManagerConfig) {
    this.config = config;
  }

  /** Inject @media print CSS that hides canvas UI and shows print table. */
  attach(): void {
    this.styleElement = document.createElement('style');
    this.styleElement.setAttribute('data-wit-print', 'true');
    this.styleElement.textContent = `
@media print {
  [data-wit-print-hide] {
    display: none !important;
  }
  [data-wit-print-table] {
    display: table !important;
    width: 100%;
    border-collapse: collapse;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
  }
  [data-wit-print-table] th,
  [data-wit-print-table] td {
    border: 1px solid #999;
    padding: 4px 6px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
  [data-wit-print-table] th {
    background-color: #f0f0f0 !important;
    font-weight: 600;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  [data-wit-print-table] tr:nth-child(even) td {
    background-color: #fafafa !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
    document.head.appendChild(this.styleElement);
  }

  /** Remove @media print CSS and clean up. */
  detach(): void {
    this.cleanupPrintTable();
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    if (this.afterPrintHandler) {
      window.removeEventListener('afterprint', this.afterPrintHandler);
      this.afterPrintHandler = null;
    }
  }

  /**
   * Trigger print: generates a DOM table from all visible data,
   * marks canvas elements for hiding, and calls window.print().
   */
  print(): void {
    this.cleanupPrintTable();

    const { cellStore, dataView, columns, rowStore, theme } = this.config;
    const visibleCols = columns
      .map((col, i) => ({ col, index: i }))
      .filter(({ col }) => !col.hidden);

    const table = document.createElement('table');
    table.setAttribute('data-wit-print-table', 'true');
    table.style.display = 'none';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const { col } of visibleCols) {
      const th = document.createElement('th');
      th.textContent = col.title ?? col.key;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows (capped at maxPrintRows to prevent browser crash)
    const tbody = document.createElement('tbody');
    const totalVisibleRows = dataView.visibleRowCount;
    const maxRows = this.config.maxPrintRows ?? 10_000;
    const rowCount = Math.min(totalVisibleRows, maxRows);
    const defaultHeight = theme.dimensions?.rowHeight ?? 28;

    for (let logicalRow = 0; logicalRow < rowCount; logicalRow++) {
      const physicalRow = dataView.getPhysicalRow(logicalRow);
      const height = rowStore.getHeight(physicalRow, defaultHeight);
      if (height === 0) continue; // skip hidden rows

      const tr = document.createElement('tr');
      for (const { index: colIdx } of visibleCols) {
        const td = document.createElement('td');
        const cell = cellStore.get(physicalRow, colIdx);
        if (cell) {
          const text = cell.displayValue ?? (cell.value != null ? String(cell.value) : '');
          td.textContent = text;
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    // Truncation notice
    if (totalVisibleRows > rowCount) {
      const tfoot = document.createElement('tfoot');
      const footRow = document.createElement('tr');
      const footCell = document.createElement('td');
      footCell.colSpan = visibleCols.length;
      footCell.style.fontStyle = 'italic';
      footCell.style.textAlign = 'center';
      footCell.textContent = `Showing ${rowCount.toLocaleString()} of ${totalVisibleRows.toLocaleString()} rows`;
      footRow.appendChild(footCell);
      tfoot.appendChild(footRow);
      table.appendChild(tfoot);
    }

    // Mark all direct children of body for hiding during print
    const bodyChildren = document.body.children;
    for (let i = 0; i < bodyChildren.length; i++) {
      bodyChildren[i].setAttribute('data-wit-print-hide', 'true');
    }

    // Insert print table directly into body for clean page-level print
    document.body.appendChild(table);
    this.printTable = table;

    // Clean up after print
    this.afterPrintHandler = () => {
      this.cleanupPrintTable();
    };
    window.addEventListener('afterprint', this.afterPrintHandler, { once: true });

    window.print();
  }

  private cleanupPrintTable(): void {
    if (this.printTable) {
      this.printTable.remove();
      this.printTable = null;
    }

    // Remove print-hide markers from body children
    document.querySelectorAll('[data-wit-print-hide]').forEach((el) => {
      el.removeAttribute('data-wit-print-hide');
    });
  }
}
