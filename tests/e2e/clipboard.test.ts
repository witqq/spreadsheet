import { test, expect } from '@playwright/test';

const waitForRender = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  );

const getCellValue = (page: import('@playwright/test').Page, row: number, col: number) =>
  page.evaluate(
    ({ r, c }) => (window as any).__witEngine?.getCellStore().get(r, c)?.value ?? null,
    { r: row, c: col },
  );

/**
 * Click a cell in the grid. Coordinates based on:
 * - rowNumberWidth: 50px
 * - headerHeight: 32px
 * - rowHeight: 28px
 * - col 0 (ID): 60px wide → x: 50..110
 * - col 1 (First Name): 120px wide → x: 110..230
 */
function cellPosition(row: number, col: number) {
  const rowNumberWidth = 50;
  const headerHeight = 32;
  const rowHeight = 28;
  const colWidths = [60, 120, 120, 200, 80, 100]; // ID, First, Last, Email, Age, Active
  let x = rowNumberWidth;
  for (let i = 0; i < col; i++) x += colWidths[i] ?? 100;
  x += (colWidths[col] ?? 100) / 2;
  const y = headerHeight + row * rowHeight + rowHeight / 2;
  return { x, y };
}

test('clipboard: internal copy-paste cycle', async ({ page, context }) => {
  // Grant clipboard permissions for Chromium
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  } catch {
    // Firefox doesn't support grantPermissions for clipboard — use programmatic approach
  }

  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Verify source cell (0, 1) = "Alice"
  expect(await getCellValue(page, 0, 1)).toBe('Alice');

  // Click cell (0, 1) to select it
  const pos01 = cellPosition(0, 1);
  await scrollContainer.click({ position: pos01 });
  await waitForRender(page);

  // Programmatically copy (dispatch copy event on scroll container)
  const copiedTSV = await page.evaluate(() => {
    const container = document.querySelector('div[style*="overflow: auto"]');
    if (!container) return null;
    const event = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    container.dispatchEvent(event);
    return event.clipboardData!.getData('text/plain');
  });
  expect(copiedTSV).toBe('Alice');

  // Navigate to cell (5, 1) and click to select
  const pos51 = cellPosition(5, 1);
  await scrollContainer.click({ position: pos51 });
  await waitForRender(page);

  // Programmatically paste the copied TSV
  await page.evaluate((tsv) => {
    const container = document.querySelector('div[style*="overflow: auto"]');
    if (!container) return;
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    event.clipboardData!.setData('text/plain', tsv);
    container.dispatchEvent(event);
  }, copiedTSV!);
  await waitForRender(page);

  // Verify the pasted value
  expect(await getCellValue(page, 5, 1)).toBe('Alice');

  // Original should be unchanged
  expect(await getCellValue(page, 0, 1)).toBe('Alice');
});

test('clipboard: paste from external HTML table', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Click cell (5, 1) to set active cell
  const pos = cellPosition(5, 1);
  await scrollContainer.click({ position: pos });
  await waitForRender(page);

  // Programmatically dispatch a paste event with HTML table data
  await page.evaluate(() => {
    const container = document.querySelector('div[style*="overflow: auto"]');
    if (!container) return;

    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    event.clipboardData!.setData(
      'text/html',
      '<table><tr><td>Revenue</td><td>1000</td></tr><tr><td>Cost</td><td>500</td></tr></table>',
    );
    event.clipboardData!.setData('text/plain', 'Revenue\t1000\nCost\t500');
    container.dispatchEvent(event);
  });
  await waitForRender(page);

  // Verify HTML table was parsed and pasted
  expect(await getCellValue(page, 5, 1)).toBe('Revenue');
  expect(await getCellValue(page, 5, 2)).toBe(1000);
  expect(await getCellValue(page, 6, 1)).toBe('Cost');
  expect(await getCellValue(page, 6, 2)).toBe(500);
});

test('clipboard: undo after paste restores original values', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Read original values at (0, 1) and (0, 2)
  const orig01 = await getCellValue(page, 0, 1);
  const orig02 = await getCellValue(page, 0, 2);

  // Click cell (0, 1) to set active cell
  await scrollContainer.click({ position: cellPosition(0, 1) });
  await waitForRender(page);

  // Paste data over existing cells
  await page.evaluate(() => {
    const container = document.querySelector('div[style*="overflow: auto"]');
    if (!container) return;
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    event.clipboardData!.setData('text/plain', 'Overwritten1\tOverwritten2');
    container.dispatchEvent(event);
  });
  await waitForRender(page);

  expect(await getCellValue(page, 0, 1)).toBe('Overwritten1');
  expect(await getCellValue(page, 0, 2)).toBe('Overwritten2');

  // Undo — should restore originals
  await page.keyboard.press('Control+z');
  await waitForRender(page);

  expect(await getCellValue(page, 0, 1)).toBe(orig01);
  expect(await getCellValue(page, 0, 2)).toBe(orig02);
});
