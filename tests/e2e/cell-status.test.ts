import { test, expect } from '@playwright/test';

/**
 * E2E tests for cell status indicators and validation.
 *
 * Tests visual indicators for 'error', 'changed', and 'saved' statuses,
 * and validates the Age column range rule (18-65) set in the demo.
 */

// Age column (col 4) center position
// Row number width=50, col widths: ID=60, firstName=120, lastName=120, email=200, age=60
// Age x range: 550-610, center x=580
// Row 0 y center: headerHeight(32) + rowHeight(28)/2 = 46
// Row 1 y center: 74

const AGE_COL_CENTER_X = 580;
const FIRST_NAME_COL_CENTER_X = 170;
const ROW_0_CENTER_Y = 46;
const ROW_1_CENTER_Y = 74;

function waitForRender(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve()),
          ),
        ),
      ),
  );
}

test.describe('cell status indicators', () => {
  test('editing a validated cell with invalid value shows error indicator', async ({
    page,
  }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 5000,
    });

    const canvas = page.locator('canvas').first();

    // Sample the Age cell area BEFORE editing — capture baseline pixel state
    const beforePixels = await canvas.evaluate(
      (el: HTMLCanvasElement, { x, y }: { x: number; y: number }) => {
        const ctx = el.getContext('2d');
        if (!ctx) return 0;
        const dpr = window.devicePixelRatio || 1;
        // Check top-right corner area of the cell (where error triangle renders)
        const px = Math.floor((x + 25) * dpr); // near right edge
        const py = Math.floor((y - 12) * dpr); // near top edge
        const data = ctx.getImageData(px, py, Math.ceil(8 * dpr), Math.ceil(8 * dpr)).data;
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          // Error red #e53935: R=229, G=57, B=53 — look for red-dominant pixels
          if (r > 180 && g < 100 && b < 100) colored++;
        }
        return colored;
      },
      { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    );

    // Double-click on Age cell (row 0) to open editor
    await scrollContainer.dblclick({
      position: { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await waitForRender(page);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    // Enter invalid age (> 65)
    await textarea.fill('999');
    await page.keyboard.press('Enter');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
    await waitForRender(page);

    // Verify the cell now has error status via engine API
    const hasErrorStatus = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return false;
      return engine.getCellStatus(0, 4) === 'error';
    });
    expect(hasErrorStatus).toBe(true);

    // Check that error indicator pixels appeared (red triangle)
    const afterPixels = await canvas.evaluate(
      (el: HTMLCanvasElement, { x, y }: { x: number; y: number }) => {
        const ctx = el.getContext('2d');
        if (!ctx) return 0;
        const dpr = window.devicePixelRatio || 1;
        const px = Math.floor((x + 25) * dpr);
        const py = Math.floor((y - 12) * dpr);
        const data = ctx.getImageData(px, py, Math.ceil(8 * dpr), Math.ceil(8 * dpr)).data;
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          // Error red #e53935: R=229, G=57, B=53
          if (r > 180 && g < 100 && b < 100) colored++;
        }
        return colored;
      },
      { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    );

    // After entering invalid value, there should be more red-ish pixels
    expect(afterPixels).toBeGreaterThan(beforePixels);
  });

  test('editing a non-validated cell shows changed indicator', async ({ page }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 5000,
    });

    // Double-click on First Name cell (row 0, col 1) — no validation rules
    await scrollContainer.dblclick({
      position: { x: FIRST_NAME_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await waitForRender(page);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    await textarea.fill('ChangedName');
    await page.keyboard.press('Enter');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
    await waitForRender(page);

    // Verify the cell now has 'changed' status
    const hasChangedStatus = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return false;
      return engine.getCellStatus(0, 1) === 'changed';
    });
    expect(hasChangedStatus).toBe(true);

    // Verify a blue dot is rendered by checking for blue pixels in top-right corner
    const canvas = page.locator('canvas').first();
    const bluePixels = await canvas.evaluate(
      (el: HTMLCanvasElement, { x, y }: { x: number; y: number }) => {
        const ctx = el.getContext('2d');
        if (!ctx) return 0;
        const dpr = window.devicePixelRatio || 1;
        // Top-right area of firstName cell
        const px = Math.floor((x + 55) * dpr);
        const py = Math.floor((y - 12) * dpr);
        const data = ctx.getImageData(px, py, Math.ceil(8 * dpr), Math.ceil(8 * dpr)).data;
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          // Blue indicator: #1a73e8 → R=26, G=115, B=232
          if (b > 150 && r < 100) colored++;
        }
        return colored;
      },
      { x: FIRST_NAME_COL_CENTER_X, y: ROW_0_CENTER_Y },
    );

    expect(bluePixels).toBeGreaterThan(0);
  });

  test('saved status shows green indicator via engine API', async ({ page }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 5000,
    });

    // Edit firstName cell to create a 'changed' status
    await scrollContainer.dblclick({
      position: { x: FIRST_NAME_COL_CENTER_X, y: ROW_1_CENTER_Y },
    });
    await waitForRender(page);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('SavedName');
    await page.keyboard.press('Enter');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
    await waitForRender(page);

    // Mark as saved via the public API
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setCellStatus(1, 1, 'saved');
    });
    await waitForRender(page);

    // Verify saved status
    const status = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCellStatus(1, 1);
    });
    expect(status).toBe('saved');

    // Verify green indicator is rendered
    const canvas = page.locator('canvas').first();
    const greenPixels = await canvas.evaluate(
      (el: HTMLCanvasElement, { x, y }: { x: number; y: number }) => {
        const ctx = el.getContext('2d');
        if (!ctx) return 0;
        const dpr = window.devicePixelRatio || 1;
        const px = Math.floor((x + 55) * dpr);
        const py = Math.floor((y - 12) * dpr);
        const data = ctx.getImageData(px, py, Math.ceil(8 * dpr), Math.ceil(8 * dpr)).data;
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          // Green indicator: #34a853 → R=52, G=168, B=83
          if (g > 120 && r < 100 && b < 130) colored++;
        }
        return colored;
      },
      { x: FIRST_NAME_COL_CENTER_X, y: ROW_1_CENTER_Y },
    );

    expect(greenPixels).toBeGreaterThan(0);
  });

  test('error tooltip appears on hover over error cell', async ({ page }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 5000,
    });

    // Create an error cell by editing Age with invalid value
    await scrollContainer.dblclick({
      position: { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await waitForRender(page);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('999');
    await page.keyboard.press('Enter');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
    await waitForRender(page);

    // Hover over the error cell
    await scrollContainer.hover({
      position: { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await page.waitForTimeout(200);

    // Check tooltip element appears with error message
    const tooltip = page.locator('[data-wit-tooltip]');
    await expect(tooltip).toBeVisible({ timeout: 2000 });
    await expect(tooltip).toContainText('Age must be between 18 and 65');
  });

  test('undo restores original value and removes error indicator', async ({ page }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 5000,
    });

    // Edit Age with invalid value
    await scrollContainer.dblclick({
      position: { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await waitForRender(page);

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });
    await textarea.fill('999');
    await page.keyboard.press('Enter');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
    await waitForRender(page);

    const errorBefore = await page.evaluate(() => {
      return (window as any).__witEngine.getCellStatus(0, 4);
    });
    expect(errorBefore).toBe('error');

    // Focus scroll container and undo
    await scrollContainer.click({
      position: { x: AGE_COL_CENTER_X, y: ROW_0_CENTER_Y },
    });
    await page.keyboard.press('Control+z');
    await waitForRender(page);

    // After undo, cell should revert to baseline → no status
    const statusAfter = await page.evaluate(() => {
      return (window as any).__witEngine.getCellStatus(0, 4);
    });
    expect(statusAfter).toBeUndefined();
  });
});
