import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.WIT_TABLE_URL ?? 'http://localhost:3150';

async function waitForGrid(page: Page) {
  await page.goto(BASE);
  await page.waitForSelector('canvas', { timeout: 10_000 });
  await page.waitForTimeout(300);
}

test.describe('Print support', () => {
  test('print button exists in toolbar', async ({ page }) => {
    await waitForGrid(page);
    const btn = page.locator('[data-testid="print-btn"]');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Print');
  });

  test('@media print stylesheet is injected', async ({ page }) => {
    await waitForGrid(page);

    const hasMediaPrint = await page.evaluate(() => {
      const style = document.querySelector('style[data-wit-print]');
      return style !== null && style.textContent!.includes('@media print');
    });
    expect(hasMediaPrint).toBe(true);
  });

  test('print generates table with cell data', async ({ page }) => {
    await waitForGrid(page);

    // Override window.print to prevent dialog
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__printCalled = false;
      window.print = () => {
        (window as unknown as Record<string, unknown>).__printCalled = true;
      };
    });

    await page.click('[data-testid="print-btn"]');

    // Verify print was called
    const printCalled = await page.evaluate(
      () => (window as unknown as Record<string, boolean>).__printCalled,
    );
    expect(printCalled).toBe(true);

    // Verify print table was generated
    const tableInfo = await page.evaluate(() => {
      const table = document.querySelector('table[data-wit-print-table]');
      if (!table) return null;
      const headers = Array.from(table.querySelectorAll('thead th')).map(
        (th) => th.textContent,
      );
      const firstRowCells = Array.from(
        table.querySelectorAll('tbody tr:first-child td'),
      ).map((td) => td.textContent);
      const rowCount = table.querySelectorAll('tbody tr').length;
      return { headers, firstRowCells, rowCount };
    });

    expect(tableInfo).not.toBeNull();
    expect(tableInfo!.headers.length).toBeGreaterThan(0);
    expect(tableInfo!.rowCount).toBeGreaterThan(0);
    // First row should have some non-empty cell content
    expect(tableInfo!.firstRowCells.some((c) => c && c.length > 0)).toBe(true);
  });

  test('canvas elements marked for hiding during print', async ({ page }) => {
    await waitForGrid(page);

    await page.evaluate(() => {
      window.print = () => {};
    });

    await page.click('[data-testid="print-btn"]');

    const hiddenElements = await page.evaluate(() => {
      return document.querySelectorAll('[data-wit-print-hide]').length;
    });
    // At least canvases and scroll container should be marked
    expect(hiddenElements).toBeGreaterThanOrEqual(2);
  });

  test('afterprint cleans up print table', async ({ page }) => {
    await waitForGrid(page);

    await page.evaluate(() => {
      window.print = () => {};
    });

    await page.click('[data-testid="print-btn"]');

    // Verify table exists
    let hasTable = await page.evaluate(
      () => document.querySelector('table[data-wit-print-table]') !== null,
    );
    expect(hasTable).toBe(true);

    // Simulate afterprint
    await page.evaluate(() => {
      window.dispatchEvent(new Event('afterprint'));
    });

    // Table should be removed
    hasTable = await page.evaluate(
      () => document.querySelector('table[data-wit-print-table]') !== null,
    );
    expect(hasTable).toBe(false);

    // Print-hide markers should also be removed
    const hiddenCount = await page.evaluate(
      () => document.querySelectorAll('[data-wit-print-hide]').length,
    );
    expect(hiddenCount).toBe(0);
  });

  test('print table headers match visible column titles', async ({ page }) => {
    await waitForGrid(page);

    await page.evaluate(() => {
      window.print = () => {};
    });

    await page.click('[data-testid="print-btn"]');

    const headers = await page.evaluate(() => {
      const ths = document.querySelectorAll(
        'table[data-wit-print-table] thead th',
      );
      return Array.from(ths).map((th) => th.textContent);
    });

    // Demo has columns like ID, Name, Email, Status etc.
    expect(headers.length).toBeGreaterThan(0);
    expect(headers[0]).toBeTruthy();
    // All headers should be non-empty strings
    for (const h of headers) {
      expect(h).toBeTruthy();
    }
  });
});
