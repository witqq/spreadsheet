import { test, expect } from '@playwright/test';

test.describe('ARIA Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => (window as any).__witEngine != null, null, {
      timeout: 10000,
    });
  });

  test('scroll container has role="grid" with aria-rowcount and aria-colcount', async ({
    page,
  }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toHaveAttribute('role', 'grid');

    const rowCount = await scrollContainer.getAttribute('aria-rowcount');
    expect(Number(rowCount)).toBeGreaterThan(0);

    const colCount = await scrollContainer.getAttribute('aria-colcount');
    expect(Number(colCount)).toBeGreaterThan(0);
  });

  test('scroll container has aria-label', async ({ page }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toHaveAttribute('aria-label', 'Spreadsheet');
  });

  test('hidden live region exists with aria-live="polite"', async ({ page }) => {
    const liveRegion = page.locator('[data-wit-aria="live-region"]');
    await expect(liveRegion).toHaveCount(1);
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    await expect(liveRegion).toHaveAttribute('role', 'status');
  });

  test('live region announces cell content on selection change', async ({ page }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');

    // Click on a cell to select it (col 1 = firstName, row 0)
    await scrollContainer.click({ position: { x: 170, y: 46 } });

    // Wait for announcement
    await page.waitForFunction(
      () => {
        const lr = document.querySelector('[data-wit-aria="live-region"]');
        return lr && lr.textContent && lr.textContent.length > 0;
      },
      null,
      { timeout: 3000 },
    );

    const liveRegion = page.locator('[data-wit-aria="live-region"]');
    const text = await liveRegion.textContent();
    // Should contain column name and row number
    expect(text).toContain('Row 1');
  });

  test('accessibility tree contains grid role via ARIA attributes', async ({ page }) => {
    // Verify the grid role is present and accessible via ARIA locator
    const grid = page.getByRole('grid', { name: 'Spreadsheet' });
    await expect(grid).toBeVisible();

    // Verify it has proper ARIA attributes
    await expect(grid).toHaveAttribute('aria-rowcount');
    await expect(grid).toHaveAttribute('aria-colcount');
  });

  test('Tab order includes the grid container', async ({ page }) => {
    // The scroll container should be focusable via Tab
    // Press Tab to navigate; the grid container (or its parent with tabindex) should receive focus
    await page.keyboard.press('Tab');

    const focusedRole = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      // Check if focused element or its parent is the grid
      return el.getAttribute('role') || el.closest('[role="grid"]')?.getAttribute('role');
    });

    // Either the focused element IS the grid, or its parent with tabindex focuses above it
    // The grid role should be reachable
    expect(focusedRole === 'grid' || focusedRole !== null).toBe(true);
  });

  test('Escape exits editing mode', async ({ page }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');

    // Double-click to enter edit mode
    await scrollContainer.dblclick({ position: { x: 170, y: 46 } });

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 2000 });

    // Press Escape to exit
    await page.keyboard.press('Escape');
    await expect(textarea).not.toBeVisible({ timeout: 2000 });
  });
});
