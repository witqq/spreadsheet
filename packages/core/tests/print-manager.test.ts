// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrintManager } from '../src/print/print-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import { RowStore } from '../src/model/row-store';
import { lightTheme } from '../src/themes/built-in-themes';
import type { ColumnDef } from '../src/types/column-def';

function makeColumns(count: number): ColumnDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width: 100,
  }));
}

function createPrintManager(opts?: {
  rowCount?: number;
  columns?: ColumnDef[];
  data?: Array<{ row: number; col: number; value: string }>;
  maxPrintRows?: number;
}) {
  const container = document.createElement('div');
  const cellStore = new CellStore();
  const rowCount = opts?.rowCount ?? 5;
  const dataView = new DataView({ totalRowCount: rowCount });
  const rowStore = new RowStore();
  const columns = opts?.columns ?? makeColumns(3);

  if (opts?.data) {
    for (const { row, col, value } of opts.data) {
      cellStore.setValue(row, col, value);
    }
  }

  const pm = new PrintManager({
    container,
    cellStore,
    dataView,
    columns,
    rowStore,
    theme: lightTheme,
    ...(opts?.maxPrintRows !== undefined && { maxPrintRows: opts.maxPrintRows }),
  });

  return { pm, container, cellStore, dataView, rowStore, columns };
}

describe('PrintManager', () => {
  let originalPrint: typeof window.print;

  beforeEach(() => {
    originalPrint = window.print;
    window.print = vi.fn();
  });

  afterEach(() => {
    window.print = originalPrint;
  });

  describe('attach/detach', () => {
    it('injects @media print stylesheet on attach', () => {
      const { pm } = createPrintManager();
      pm.attach();

      const style = document.querySelector('style[data-wit-print]');
      expect(style).not.toBeNull();
      expect(style!.textContent).toContain('@media print');
      expect(style!.textContent).toContain('data-wit-print-hide');
      expect(style!.textContent).toContain('data-wit-print-table');

      pm.detach();
    });

    it('removes stylesheet on detach', () => {
      const { pm } = createPrintManager();
      pm.attach();
      expect(document.querySelector('style[data-wit-print]')).not.toBeNull();

      pm.detach();
      expect(document.querySelector('style[data-wit-print]')).toBeNull();
    });

    it('cleans up print table on detach', () => {
      const { pm } = createPrintManager({
        rowCount: 2,
        data: [{ row: 0, col: 0, value: 'A' }],
      });
      pm.attach();
      pm.print();

      expect(document.querySelector('table[data-wit-print-table]')).not.toBeNull();

      pm.detach();
      expect(document.querySelector('table[data-wit-print-table]')).toBeNull();
    });
  });

  describe('print', () => {
    it('generates a table with header row from column titles', () => {
      const { pm } = createPrintManager();
      pm.attach();
      pm.print();

      const table = document.querySelector('table[data-wit-print-table]');
      expect(table).not.toBeNull();

      const ths = table!.querySelectorAll('thead th');
      expect(ths).toHaveLength(3);
      expect(ths[0].textContent).toBe('Column 0');
      expect(ths[1].textContent).toBe('Column 1');
      expect(ths[2].textContent).toBe('Column 2');

      pm.detach();
    });

    it('generates data rows from cell store', () => {
      const { pm } = createPrintManager({
        rowCount: 3,
        data: [
          { row: 0, col: 0, value: 'A1' },
          { row: 0, col: 1, value: 'B1' },
          { row: 1, col: 0, value: 'A2' },
          { row: 2, col: 2, value: 'C3' },
        ],
      });
      pm.attach();
      pm.print();

      const rows = document.querySelectorAll('table[data-wit-print-table] tbody tr');
      expect(rows).toHaveLength(3);

      const row0Cells = rows[0].querySelectorAll('td');
      expect(row0Cells[0].textContent).toBe('A1');
      expect(row0Cells[1].textContent).toBe('B1');
      expect(row0Cells[2].textContent).toBe('');

      const row1Cells = rows[1].querySelectorAll('td');
      expect(row1Cells[0].textContent).toBe('A2');

      const row2Cells = rows[2].querySelectorAll('td');
      expect(row2Cells[2].textContent).toBe('C3');

      pm.detach();
    });

    it('skips hidden columns', () => {
      const columns: ColumnDef[] = [
        { key: 'a', title: 'Visible', width: 100 },
        { key: 'b', title: 'Hidden', width: 100, hidden: true },
        { key: 'c', title: 'Also Visible', width: 100 },
      ];
      const { pm } = createPrintManager({
        columns,
        rowCount: 1,
        data: [
          { row: 0, col: 0, value: 'V1' },
          { row: 0, col: 1, value: 'H1' },
          { row: 0, col: 2, value: 'V2' },
        ],
      });
      pm.attach();
      pm.print();

      const ths = document.querySelectorAll('table[data-wit-print-table] thead th');
      expect(ths).toHaveLength(2);
      expect(ths[0].textContent).toBe('Visible');
      expect(ths[1].textContent).toBe('Also Visible');

      const tds = document.querySelectorAll('table[data-wit-print-table] tbody td');
      expect(tds).toHaveLength(2);
      expect(tds[0].textContent).toBe('V1');
      expect(tds[1].textContent).toBe('V2');

      pm.detach();
    });

    it('skips hidden rows (height=0)', () => {
      const { pm, rowStore } = createPrintManager({
        rowCount: 3,
        data: [
          { row: 0, col: 0, value: 'Row0' },
          { row: 1, col: 0, value: 'Hidden' },
          { row: 2, col: 0, value: 'Row2' },
        ],
      });
      rowStore.setHeight(1, 0); // hide row 1
      pm.attach();
      pm.print();

      const rows = document.querySelectorAll('table[data-wit-print-table] tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0].querySelector('td')!.textContent).toBe('Row0');
      expect(rows[1].querySelector('td')!.textContent).toBe('Row2');

      pm.detach();
    });

    it('calls window.print()', () => {
      const { pm } = createPrintManager();
      pm.attach();
      pm.print();

      expect(window.print).toHaveBeenCalledOnce();

      pm.detach();
    });

    it('marks body children for hiding during print', () => {
      const { pm, container } = createPrintManager();
      document.body.appendChild(container);
      const sibling = document.createElement('div');
      sibling.id = 'other-content';
      document.body.appendChild(sibling);

      pm.attach();
      pm.print();

      expect(container.getAttribute('data-wit-print-hide')).toBe('true');
      expect(sibling.getAttribute('data-wit-print-hide')).toBe('true');

      pm.detach();
      container.remove();
      sibling.remove();
    });

    it('removes print-hide markers on cleanup', () => {
      const { pm, container } = createPrintManager();
      document.body.appendChild(container);

      pm.attach();
      pm.print();
      expect(container.getAttribute('data-wit-print-hide')).toBe('true');

      // Simulate afterprint event
      window.dispatchEvent(new Event('afterprint'));

      expect(container.getAttribute('data-wit-print-hide')).toBeNull();

      pm.detach();
      container.remove();
    });

    it('cleans up previous print table on second print call', () => {
      const { pm } = createPrintManager({
        rowCount: 1,
        data: [{ row: 0, col: 0, value: 'test' }],
      });
      pm.attach();

      pm.print();
      const firstTable = document.querySelector('table[data-wit-print-table]');
      expect(firstTable).not.toBeNull();

      pm.print();
      const tables = document.querySelectorAll('table[data-wit-print-table]');
      expect(tables).toHaveLength(1);

      pm.detach();
    });

    it('uses displayValue when available', () => {
      const { pm, cellStore } = createPrintManager({
        rowCount: 1,
      });
      cellStore.set(0, 0, { value: 1234.5, displayValue: '$1,234.50' });
      pm.attach();
      pm.print();

      const td = document.querySelector('table[data-wit-print-table] tbody td');
      expect(td!.textContent).toBe('$1,234.50');

      pm.detach();
    });

    it('uses column key as fallback when title is missing', () => {
      const columns: ColumnDef[] = [
        { key: 'myKey', width: 100 },
      ];
      const { pm } = createPrintManager({ columns, rowCount: 1 });
      pm.attach();
      pm.print();

      const th = document.querySelector('table[data-wit-print-table] thead th');
      expect(th!.textContent).toBe('myKey');

      pm.detach();
    });

    it('respects DataView sort/filter order', () => {
      const { pm, dataView, cellStore } = createPrintManager({
        rowCount: 3,
      });
      cellStore.setValue(0, 0, 'Physical0');
      cellStore.setValue(1, 0, 'Physical1');
      cellStore.setValue(2, 0, 'Physical2');

      // Reverse the logical order: logical 0→physical 2, 1→1, 2→0
      dataView.recompute([2, 1, 0]);

      pm.attach();
      pm.print();

      const tds = document.querySelectorAll('table[data-wit-print-table] tbody tr td:first-child');
      expect(tds[0].textContent).toBe('Physical2');
      expect(tds[1].textContent).toBe('Physical1');
      expect(tds[2].textContent).toBe('Physical0');

      pm.detach();
    });

    it('limits rows to maxPrintRows and shows truncation notice', () => {
      const { pm } = createPrintManager({
        rowCount: 100,
        maxPrintRows: 10,
        data: Array.from({ length: 100 }, (_, i) => ({ row: i, col: 0, value: `Row${i}` })),
      });
      pm.attach();
      pm.print();

      const rows = document.querySelectorAll('table[data-wit-print-table] tbody tr');
      expect(rows).toHaveLength(10);

      const tfoot = document.querySelector('table[data-wit-print-table] tfoot td');
      expect(tfoot).not.toBeNull();
      expect(tfoot!.textContent).toContain('10');
      expect(tfoot!.textContent).toContain('100');

      pm.detach();
    });

    it('does not show truncation notice when all rows fit', () => {
      const { pm } = createPrintManager({
        rowCount: 5,
        maxPrintRows: 100,
        data: [{ row: 0, col: 0, value: 'A' }],
      });
      pm.attach();
      pm.print();

      const tfoot = document.querySelector('table[data-wit-print-table] tfoot');
      expect(tfoot).toBeNull();

      pm.detach();
    });
  });
});
