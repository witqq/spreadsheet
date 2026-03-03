import { test, expect } from '@playwright/test';

test.describe('Performance: 1M rows', () => {
  test('1M row toggle button exists and switches modes', async ({ page }) => {
    await page.goto('/demo/');
    const toggle = page.locator('[data-testid="row-toggle"]');
    await expect(toggle).toBeVisible();
    // Initial state: button offers to switch to 1M
    await expect(toggle).toContainText('1M Rows');
  });

  test('1M row mode initializes and renders', async ({ page }) => {
    test.setTimeout(120_000); // 1M rows needs more time

    await page.goto('/demo/');
    const toggle = page.locator('[data-testid="row-toggle"]');

    // Click to switch to 1M
    await toggle.click();

    // Button should immediately show "100K Rows" (current mode is 1M)
    await expect(toggle).toContainText('100K Rows');

    // Status should show init time (may take a while for 1M generation)
    const status = page.locator('[data-testid="excel-status"]');
    await expect(status).toContainText(/Loaded 1M rows in \d+ms/, { timeout: 60_000 });

    // Canvas should still be visible
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('scroll works at 1M rows', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/demo/');
    const toggle = page.locator('[data-testid="row-toggle"]');
    await toggle.click();

    // Wait for load
    const status = page.locator('[data-testid="excel-status"]');
    await expect(status).toContainText(/Loaded 1M rows/, { timeout: 60_000 });

    // Wait for the engine to update the scroll spacer
    await page.waitForTimeout(500);

    // Get scroll height from the engine's scroll container
    const scrollInfo = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return { error: 'no engine' };
      const scrollMgr = engine.getScrollManager?.();
      // Find the overflow:auto div inside the WitTable container
      const container = document.querySelector('div[tabindex="0"]');
      if (!container) return { error: 'no container' };
      const overflowDiv = container.querySelector('div[style*="overflow"]') as HTMLElement;
      if (!overflowDiv) return { error: 'no overflow div' };
      const spacer = overflowDiv.firstElementChild as HTMLElement;
      return {
        scrollHeight: overflowDiv.scrollHeight,
        spacerHeight: spacer?.style?.height,
        clientHeight: overflowDiv.clientHeight,
      };
    });

    // Spacer height should be ~28M (1M × 28px rowHeight + 32px header)
    expect(scrollInfo).not.toHaveProperty('error');
    const spacerPx = parseFloat(String(scrollInfo.spacerHeight));
    expect(spacerPx).toBeGreaterThan(20_000_000);

    // Scroll down to middle and verify no crash
    await page.evaluate(() => {
      const container = document.querySelector('div[tabindex="0"]');
      const overflowDiv = container?.querySelector('div[style*="overflow"]') as HTMLElement;
      if (overflowDiv) overflowDiv.scrollTop = 14_000_000;
    });
    await page.waitForTimeout(500);

    // Should still be responsive
    const box = await page.locator('canvas').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
  });

  test('can toggle back to 100K from 1M', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/demo/');
    const toggle = page.locator('[data-testid="row-toggle"]');

    // Go to 1M
    await toggle.click();
    await expect(page.locator('[data-testid="excel-status"]')).toContainText(/1M rows/, { timeout: 60_000 });

    // Back to 100K
    await toggle.click();
    await expect(page.locator('[data-testid="excel-status"]')).toContainText(/100K rows/, { timeout: 30_000 });
    await expect(toggle).toContainText('1M Rows');
  });
});
