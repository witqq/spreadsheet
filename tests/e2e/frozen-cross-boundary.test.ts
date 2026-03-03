import { test, expect } from '@playwright/test';

/**
 * E2E tests for cross-boundary selection, navigation, and editing in frozen panes.
 *
 * The demo app is configured with frozenRows=2, frozenColumns=1.
 * These tests verify that selection, keyboard navigation, inline editing,
 * and scroll-into-view work correctly across frozen/unfrozen boundaries.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/demo/');
  await page.waitForFunction(
    () => {
      const w = (window as unknown as { __witEngine: { getSortColumns: () => unknown } })
        .__witEngine;
      return w && w.getSortColumns();
    },
    null,
    { timeout: 15000 },
  );
});

test('clicking frozen row cell selects it without scrolling', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Scroll down first so we're not at top
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 500;
  });
  await page.waitForTimeout(200);

  // Click on row 0, col 1 (frozen row, non-frozen col)
  // headerHeight=32, row0 starts at y=32, col1 starts at x=50+100=150
  await scrollContainer.click({ position: { x: 160, y: 46 } });

  const selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });

  expect(selection).not.toBeNull();
  expect(selection.row).toBe(0); // Frozen row 0

  // Verify scroll position didn't change (frozen row click shouldn't scroll)
  const scrollTop = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollTop);
  expect(scrollTop).toBe(500);
});

test('clicking frozen column cell selects it without scrolling', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Scroll right first
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollLeft = 300;
  });
  await page.waitForTimeout(200);

  // Click on row 5, col 0 (non-frozen row, frozen col)
  // row 5: headerHeight(32) + 2*frozenRowHeight(28) + 3*28 = 32+56+84 = 172, middle at ~186
  // col 0: rowNumberWidth(50) + 50 = 100 (middle of col 0)
  await scrollContainer.click({ position: { x: 75, y: 186 } });

  const selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });

  expect(selection).not.toBeNull();
  expect(selection.col).toBe(0); // Frozen column 0

  // Verify scroll position didn't change horizontally
  const scrollLeft = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollLeft);
  expect(scrollLeft).toBe(300);
});

test('arrow key navigation crosses frozen boundary seamlessly', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Click on row 1, col 0 (frozen row, frozen col — corner region)
  // row 1: y = 32 + 28 + 14 = 74
  // col 0: x = 50 + 50 = 100
  await scrollContainer.click({ position: { x: 75, y: 74 } });

  let selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 1, col: 0 });

  // Press ArrowDown — should move from frozen row 1 to row 2 (first scrollable row)
  await scrollContainer.press('ArrowDown');
  selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 2, col: 0 });

  // Press ArrowRight — should move from frozen col 0 to col 1 (first scrollable col)
  await scrollContainer.press('ArrowRight');
  selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 2, col: 1 });

  // Press ArrowUp twice — should go back into frozen rows
  await scrollContainer.press('ArrowUp');
  await scrollContainer.press('ArrowUp');
  selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 0, col: 1 });
});

test('Tab navigation crosses frozen column boundary', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Click on row 2, col 0 (scrollable row, frozen col)
  // row 2: y = 32 + 56 + 14 = 102
  await scrollContainer.click({ position: { x: 75, y: 102 } });

  let selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 2, col: 0 });

  // Press Tab — should move from frozen col 0 to col 1
  await scrollContainer.press('Tab');
  selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 2, col: 1 });

  // Press Shift+Tab — should go back to frozen col 0
  await scrollContainer.press('Shift+Tab');
  selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 2, col: 0 });
});

test('editing frozen cell positions textarea correctly', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Scroll down to ensure frozen cells are truly frozen
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 300;
  });
  await page.waitForTimeout(200);

  // Click on row 0, col 0 (corner: frozen row + frozen col)
  await scrollContainer.click({ position: { x: 75, y: 46 } });
  await page.waitForTimeout(100);

  // Double-click to open editor
  await scrollContainer.dblclick({ position: { x: 75, y: 46 } });
  await page.waitForTimeout(200);

  // Check textarea exists and is positioned correctly
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();

  // The textarea should be near the top of the container (frozen row 0)
  // Not offset by scroll position
  const box = await textarea.boundingBox();
  expect(box).not.toBeNull();
  // Textarea top should be near the header area (around 32px from canvas top)
  // With 300px scroll, a non-frozen cell at row 0 would be off-screen
  expect(box!.y).toBeLessThan(200); // Should be near top, not scrolled away
});

test('scroll-into-view skips frozen cells', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Scroll to a non-zero position
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 500;
    el.scrollLeft = 200;
  });
  await page.waitForTimeout(200);

  const initialScrollTop = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollTop);
  const initialScrollLeft = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollLeft);

  // Navigate to a frozen cell (row 0, col 0) via Home keys
  // First click somewhere to have focus
  await scrollContainer.click({ position: { x: 200, y: 200 } });
  await page.waitForTimeout(100);

  // Ctrl+Home goes to row 0, col 0 (frozen corner)
  await scrollContainer.press('Control+Home');
  await page.waitForTimeout(200);

  const selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });
  expect(selection).toEqual({ row: 0, col: 0 });

  // Scroll should NOT have changed since frozen cell is always visible
  const finalScrollTop = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollTop);
  const finalScrollLeft = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollLeft);

  // For frozen row 0, scrollY should not change. For frozen col 0, scrollX should not change.
  expect(finalScrollTop).toBe(initialScrollTop);
  expect(finalScrollLeft).toBe(initialScrollLeft);
});

test('Enter after editing navigates across frozen boundary', async ({ page }) => {
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Click on row 1, col 1 (frozen row, non-frozen col)
  // row 1: y = 32 + 28 + 14 = 74
  // col 1: x = 50 + 100 + 50 = 200
  await scrollContainer.click({ position: { x: 200, y: 74 } });
  await page.waitForTimeout(100);

  // Press F2 to start editing
  await scrollContainer.press('F2');
  await page.waitForTimeout(200);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();

  // Press Enter to commit and move to next row (row 2 — crosses frozen boundary)
  await textarea.press('Enter');
  await page.waitForTimeout(200);

  const selection = await page.evaluate(() => {
    const engine = (window as any).__witEngine;
    return engine.getSelection()?.activeCell;
  });

  // Should have moved to row 2 (first non-frozen row)
  expect(selection).toEqual({ row: 2, col: 1 });
});
