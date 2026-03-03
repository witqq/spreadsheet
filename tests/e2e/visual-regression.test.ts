import { test, expect } from '@playwright/test';

const scenarios = [
  'basic-default',
  'basic-empty',
  'basic-single-row',
  'basic-large-dataset',
  'columns-narrow',
  'columns-wide',
  'columns-mixed',
  'cell-types-all',
  'container-tiny',
  'container-small',
  'container-medium',
  'container-large',
  'frozen-panes',
  'dark-theme',
  'long-text',
  'no-row-numbers',
  'custom-row-height',
  'many-columns',
  'merged-cells',
  'sorted-filtered',
  'selections',
  'scroll-states',
  'validation-errors',
  'demo-frozen-panes',
  'demo-merging',
  'demo-clipboard',
  'demo-undo-redo',
  'demo-resize',
  'demo-autofill',
  'demo-change-tracking',
  'demo-validation',
  'demo-context-menu',
  'demo-theme-switcher',
  'demo-accessibility',
  'demo-print',
  'demo-cell-types',
  'demo-row-grouping',
  'demo-formula',
  'demo-conditional-format',
  'demo-excel',
  'demo-event-bus',
  'demo-plugin-showcase',
  'demo-hero',
];

const BASE = '/demo/visual-tests.html';

async function waitForTableRender(page: import('@playwright/test').Page) {
  // Wait for canvas elements to appear (WitTable renders on canvas)
  await page.waitForSelector('canvas', { timeout: 10000 });
  // Wait for two animation frames to ensure rendering is complete
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  // Small extra wait for any post-render effects
  await page.waitForTimeout(200);
}

// DPR=1 tests (default viewport)
for (const scenario of scenarios) {
  test(`visual: ${scenario}`, async ({ page }) => {
    await page.goto(`${BASE}#${scenario}`);
    await waitForTableRender(page);

    const container = page.locator(`[data-scenario="${scenario}"]`);
    await expect(container).toBeVisible();

    await expect(container).toHaveScreenshot(`${scenario}.png`, {
      maxDiffPixelRatio: 0.01,
    });
  });
}

// DPR=2 tests (high-DPI/Retina)
test.describe('DPR=2', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

  for (const scenario of scenarios) {
    test(`visual-2x: ${scenario}`, async ({ page }) => {
      await page.goto(`${BASE}#${scenario}`);
      await waitForTableRender(page);

      const container = page.locator(`[data-scenario="${scenario}"]`);
      await expect(container).toBeVisible();

      await expect(container).toHaveScreenshot(`${scenario}-2x.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
