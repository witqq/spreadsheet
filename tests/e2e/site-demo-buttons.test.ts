import { test, expect } from '@playwright/test';

test.describe('Site Demo Buttons', () => {
  test('DemoButton renders on plugin showcase page', async ({ page }) => {
    await page.goto('/plugins/overview/');
    await page.waitForLoadState('networkidle');

    const formulaBtn = page.locator('button', { hasText: 'Formula Plugin' });
    const condFmtBtn = page.locator('button', { hasText: 'Conditional Formatting' });

    await expect(formulaBtn).toBeVisible();
    await expect(condFmtBtn).toBeVisible();
  });

  test('DemoButton renders on excel page', async ({ page }) => {
    await page.goto('/plugins/excel/');
    await page.waitForLoadState('networkidle');

    const importBtn = page.locator('button', { hasText: 'Import Excel' });
    const exportBtn = page.locator('button', { hasText: 'Export Excel' });

    await expect(importBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();
  });

  test('dark theme produces correct button contrast', async ({ page }) => {
    await page.goto('/plugins/overview/');
    await page.waitForLoadState('networkidle');

    // Switch to dark theme
    const themeSelect = page.locator('select').first();
    await themeSelect.selectOption('dark');
    await page.waitForTimeout(500);

    const btn = page.locator('button', { hasText: 'Formula Plugin' });
    await expect(btn).toBeVisible();

    const color = await btn.evaluate((el) => getComputedStyle(el).color);
    const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Button text should not be same as background (contrast check)
    expect(color).not.toBe(bg);

    // Switch to light theme
    await themeSelect.selectOption('light');
    await page.waitForTimeout(500);

    await expect(btn).toBeVisible();
    const lightColor = await btn.evaluate((el) => getComputedStyle(el).color);
    const lightBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(lightColor).not.toBe(lightBg);
  });
});
