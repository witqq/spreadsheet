import { test, expect } from '@playwright/test';

/**
 * Helper: wait for canvas render to complete.
 */
const waitForRender = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/**
 * Helper: read cell value from the engine via window.__witEngine.
 */
const getCellValue = (page: import('@playwright/test').Page, row: number, col: number) =>
  page.evaluate(
    ({ r, c }) => (window as any).__witEngine?.getCellStore().get(r, c)?.value ?? null,
    { r: row, c: col },
  );

test('undo/redo: edit a cell, Ctrl+Z restores, Ctrl+Y reapplies', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();

  // Wait for engine to be exposed
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Read the original value of cell (0, 1) — "First Name" column, row 0 = "Alice"
  const originalValue = await getCellValue(page, 0, 1);
  expect(originalValue).toBe('Alice');

  // Click cell (0,1) to select it: rowNumberWidth=50, col0(ID)=60, so col1 starts at x=110
  // Row 0: y = headerHeight(32) + 14 = 46
  await scrollContainer.click({ position: { x: 130, y: 46 } });
  await waitForRender(page);

  // Double-click to open inline editor
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  await waitForRender(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // Type new value and commit with Enter
  await textarea.fill('UndoTest');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  // Verify the new value is committed
  expect(await getCellValue(page, 0, 1)).toBe('UndoTest');

  // Undo with Ctrl+Z — should restore original value
  await page.keyboard.press('Control+z');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Alice');

  // Redo with Ctrl+y — should reapply the edit
  await page.keyboard.press('Control+y');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('UndoTest');
});

test('undo/redo: multiple edits undo in correct order', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Edit cell (0,1): "Alice" → "Edit1"
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });
  await textarea.fill('Edit1');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  // Edit same cell again: "Edit1" → "Edit2"
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  await expect(textarea).toBeVisible({ timeout: 2000 });
  await textarea.fill('Edit2');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  expect(await getCellValue(page, 0, 1)).toBe('Edit2');

  // Undo first: "Edit2" → "Edit1"
  await page.keyboard.press('Control+z');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Edit1');

  // Undo second: "Edit1" → "Alice"
  await page.keyboard.press('Control+z');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Alice');

  // Redo both back
  await page.keyboard.press('Control+y');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Edit1');

  await page.keyboard.press('Control+y');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Edit2');
});

test('undo/redo: Ctrl+Shift+Z also redoes', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Edit cell (0,1)
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });
  await textarea.fill('ShiftTest');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  // Undo
  await page.keyboard.press('Control+z');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('Alice');

  // Redo with Ctrl+Shift+Z
  await page.keyboard.press('Control+Shift+z');
  await waitForRender(page);
  expect(await getCellValue(page, 0, 1)).toBe('ShiftTest');
});
