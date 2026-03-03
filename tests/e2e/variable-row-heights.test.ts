import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3150';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForFunction(
    () => {
      const engine = (window as any).__witEngine;
      return engine && typeof engine.getSortColumns === 'function';
    },
    null,
    { timeout: 15000 },
  );
});

test('setRowHeight changes scroll height', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Get initial scroll height (100K rows × 28px + 32px header)
  const initialScrollHeight = await scrollContainer.evaluate(
    (el: HTMLDivElement) => el.scrollHeight,
  );
  expect(initialScrollHeight).toBeGreaterThan(2_800_000);

  // Set row 2 to 100px (default is 28px, delta = +72)
  await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    engine.setRowHeight(2, 100);
  });

  // Wait for rAF render cycle
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  const newScrollHeight = await scrollContainer.evaluate(
    (el: HTMLDivElement) => el.scrollHeight,
  );
  expect(newScrollHeight).toBe(initialScrollHeight + 72);
});

test('variable row heights: layout engine reports correct positions', async ({ page }) => {
  // Set row 0 to 60px, row 1 to 10px (very small), row 2 to 200px (very large)
  await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    engine.setRowHeight(0, 60);
    engine.setRowHeight(1, 10);
    engine.setRowHeight(2, 200);
  });

  // Verify via layout engine that positions are correct
  const positions = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    const layout = engine.getLayoutEngine();
    return {
      row0Y: layout.getRowY(0),
      row0H: layout.getRowHeight(0),
      row1Y: layout.getRowY(1),
      row1H: layout.getRowHeight(1),
      row2Y: layout.getRowY(2),
      row2H: layout.getRowHeight(2),
      row3Y: layout.getRowY(3),
      row3H: layout.getRowHeight(3),
    };
  });

  expect(positions.row0Y).toBe(0);
  expect(positions.row0H).toBe(60);
  expect(positions.row1Y).toBe(60);
  expect(positions.row1H).toBe(10);
  expect(positions.row2Y).toBe(70);
  expect(positions.row2H).toBe(200);
  expect(positions.row3Y).toBe(270);
  expect(positions.row3H).toBe(28); // default
});

test('clicking cell after row resize selects correct cell', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Set row 0 to 80px
  await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    engine.setRowHeight(0, 80);
  });

  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

  // Click in row 1 area: headerHeight(32) + row0(80) + half of row1(14) = 126
  // x: rowNumberWidth(50) + 10 = 60 (col 0)
  await scrollContainer.click({ position: { x: 60, y: 126 } });

  // Verify selection is on row 1, col 0
  const selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    const sel = engine.getSelection();
    return sel?.activeCell ?? null;
  });

  expect(selection).not.toBeNull();
  expect(selection!.row).toBe(1);
  expect(selection!.col).toBe(0);
});
