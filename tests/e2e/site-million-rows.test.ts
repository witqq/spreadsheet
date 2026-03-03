import { test, expect } from '@playwright/test';

test.describe('Site: Million Rows Demo', () => {
  test('desktop shows 1M row count and loads', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/getting-started/performance/');
    await page.waitForLoadState('networkidle');

    // Pre-activation state: big number shows 1,000,000
    await expect(page.getByText('1,000,000', { exact: true })).toBeVisible();
    const loadBtn = page.getByRole('button', { name: /Load 1M Rows/i });
    await expect(loadBtn).toBeVisible();

    // Click load → progressive loading
    await loadBtn.click();

    // Canvas should appear
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });

    // Loading should complete (up to 90s for 1M rows)
    await expect(page.getByText(/Loaded in \d+ms/)).toBeVisible({ timeout: 90_000 });

    // Number formatting uses commas (Intl.NumberFormat), not spaces
    await expect(page.getByText(/Loaded in \d+ms · 1,000,000 rows/)).toBeVisible();
  });

  test('explanation section is present', async ({ page }) => {
    await page.goto('/getting-started/performance/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'How It Works' })).toBeVisible();
    await expect(page.getByText('ProgressiveLoaderPlugin').first()).toBeVisible();
  });
});
