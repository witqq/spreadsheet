import { test, expect } from '@playwright/test';

const waitForRender = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

const getCellValue = (page: import('@playwright/test').Page, row: number, col: number) =>
  page.evaluate(
    ({ r, c }) => (window as any).__witEngine?.getCellStore().get(r, c)?.value ?? null,
    { r: row, c: col },
  );

const getCellFormula = (page: import('@playwright/test').Page, row: number, col: number) =>
  page.evaluate(
    ({ r, c }) => (window as any).__witEngine?.getCellStore().get(r, c)?.formula ?? null,
    { r: row, c: col },
  );

test('formula: enter formula, see computed result in cell store', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Click on an empty cell area — use a cell far from demo data
  // Row 99, col 1: beyond 100K data rows, but let's use row 0 col 5 (Salary column)
  // Salary column starts at: rowNum(50) + ID(60) + FirstName(120) + LastName(120) + Email(200) = 550
  // Row 0: y = headerHeight(32) + 14 = 46
  // Instead, write a formula directly via engine
  await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    // Set A1 to 10, A2 to 20 (physical rows 0,1, col 0 = ID column)
    engine.getCellStore().set(0, 0, { value: 10 });
    engine.getCellStore().set(1, 0, { value: 20 });
  });

  // Double-click on row 2, col 0 (ID column) to open editor
  // rowNum=50, so col0 starts at x=50. Row 2: y = 32 + 2*28 + 14 = 102
  await scrollContainer.click({ position: { x: 70, y: 102 } });
  await waitForRender(page);
  await scrollContainer.dblclick({ position: { x: 70, y: 102 } });
  await waitForRender(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // Type formula
  await textarea.fill('=A1+A2');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  // Verify formula was evaluated: A1(10) + A2(20) = 30
  const value = await getCellValue(page, 2, 0);
  expect(value).toBe(30);

  // Verify formula string is stored
  const formula = await getCellFormula(page, 2, 0);
  expect(formula).toBe('=A1+A2');
});

test('formula: editing formula cell shows formula in editor', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

  // Set up a formula cell via the engine
  await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    engine.getCellStore().set(0, 0, { value: 100 });
    engine.getCellStore().set(1, 0, { value: 200 });
  });

  // Enter formula in row 2, col 0
  await scrollContainer.click({ position: { x: 70, y: 102 } });
  await waitForRender(page);
  await scrollContainer.dblclick({ position: { x: 70, y: 102 } });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });
  await textarea.fill('=A1+A2');
  await page.keyboard.press('Enter');
  await expect(textarea).not.toBeVisible({ timeout: 2000 });
  await waitForRender(page);

  // Verify computed value
  expect(await getCellValue(page, 2, 0)).toBe(300);

  // Re-open editor on the formula cell
  await scrollContainer.click({ position: { x: 70, y: 102 } });
  await waitForRender(page);
  await scrollContainer.dblclick({ position: { x: 70, y: 102 } });
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // Should show the formula string, not the computed value
  const editorValue = await textarea.inputValue();
  expect(editorValue).toBe('=A1+A2');

  await page.keyboard.press('Escape');
});
