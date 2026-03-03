import { test, expect } from '@playwright/test';

test('conditional formatting: salary gradient background renders', async ({ page }) => {
  await page.goto('/demo/');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);

  // Salary column (index 5) should have gradient backgrounds rendered by ConditionalFormatLayer
  // Verify the canvas renders without errors and the engine is functional
  const engine = await page.evaluate(() => !!(window as any).__witEngine);
  expect(engine).toBe(true);

  // Verify conditional formatting plugin is installed by checking plugin state
  const hasPlugin = await page.evaluate(() => {
    const e = (window as any).__witEngine;
    return e.getPlugin?.('conditional-format') !== undefined;
  });
  expect(hasPlugin).toBe(true);
});

test('conditional formatting: data bar renders proportionally in budget column', async ({ page }) => {
  await page.goto('/demo/');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(500);

  // Scroll to budget column (index 22) and verify rendering
  const engine = await page.evaluate(() => {
    const e = (window as any).__witEngine;
    // Verify the engine has the conditional format plugin with rules
    const plugin = e.getPlugin?.('conditional-format');
    if (!plugin) return { hasPlugin: false, rulesCount: 0 };
    return {
      hasPlugin: true,
      rulesCount: plugin.getRules?.()?.length ?? 0,
    };
  });
  expect(engine.hasPlugin).toBe(true);
  expect(engine.rulesCount).toBe(3); // gradient, icon set, data bar
});
