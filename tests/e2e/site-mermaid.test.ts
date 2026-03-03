import { test, expect } from '@playwright/test';

test.describe('Mermaid Diagrams', () => {
  const pages = [
    { url: '/concepts/architecture/', name: 'architecture' },
    { url: '/concepts/data-model/', name: 'data-model' },
    { url: '/concepts/rendering/', name: 'rendering' },
    { url: '/guides/pivot/', name: 'pivot' },
    { url: '/plugins/collaboration/', name: 'collaboration' },
    { url: '/guides/change-tracking/', name: 'change-tracking' },
    { url: '/guides/streaming/', name: 'streaming' },
    { url: '/plugins/progressive-loader/', name: 'progressive-loader' },
    { url: '/guides/dataview/', name: 'dataview' },
  ];

  for (const { url, name } of pages) {
    test(`${name} page renders Mermaid SVG`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const svg = page.locator('[class*="mermaid"] svg');
      await expect(svg.first()).toBeVisible({ timeout: 10000 });

      const rawCode = page.locator('code.language-mermaid');
      expect(await rawCode.count()).toBe(0);
    });
  }
});
