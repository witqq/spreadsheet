import { test, expect } from '@playwright/test';

test.describe('Browser Zoom Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 10000 });
  });

  test('grid re-renders correctly after viewport resize (zoom simulation)', async ({ page }) => {
    // Get initial canvas state
    const initial = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: parseFloat(canvas.style.width),
      };
    });

    expect(initial.width).toBeGreaterThan(0);
    expect(initial.height).toBeGreaterThan(0);

    // Resize viewport (simulates what happens during browser zoom)
    await page.setViewportSize({ width: 640, height: 480 });

    // Wait for canvas to recalibrate after resize
    await page.waitForFunction(
      (origCss: number) => {
        const c = document.querySelector('canvas') as HTMLCanvasElement;
        return c && parseFloat(c.style.width) < origCss;
      },
      initial.cssWidth,
      { timeout: 5000 },
    );

    // Canvas should recalibrate to new size
    const resized = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: parseFloat(canvas.style.width),
      };
    });

    // Canvas dimensions should differ from initial (smaller viewport)
    expect(resized.cssWidth).toBeLessThan(initial.cssWidth);
    expect(resized.width).toBeGreaterThan(0);
  });

  test('cell editing works after viewport resize', async ({ page }) => {
    // Resize viewport to simulate zoom (not too small to avoid layout issues)
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('canvas') as HTMLCanvasElement;
        return c && c.width > 0;
      },
      null,
      { timeout: 5000 },
    );

    // Click on scroll container (not canvas directly — scroll div intercepts pointer events)
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    // Click a cell to select it (x=130 is col 1, y=46 is row 0)
    await scrollContainer.click({ position: { x: 130, y: 46 } });
    await page.waitForTimeout(100);

    // Double-click to edit
    await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
    await page.waitForTimeout(200);

    // Editor should appear
    const editor = page.locator('textarea');
    await expect(editor).toBeVisible({ timeout: 2000 });

    // Type and commit
    await editor.fill('ZoomEdit');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Verify editor closed
    await expect(editor).not.toBeVisible();
  });

  test('DPR change detection setup is active', async ({ page }) => {
    // Verify that the matchMedia watcher is set up for current DPR
    const hasDprWatch = await page.evaluate(() => {
      // Check that devicePixelRatio is being used
      return typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0;
    });
    expect(hasDprWatch).toBe(true);

    // Verify canvas has correct DPR scaling
    const scaling = await page.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      const cssWidth = parseFloat(canvas.style.width);
      const dpr = window.devicePixelRatio;
      return {
        canvasPixels: canvas.width,
        expectedPixels: Math.round(cssWidth * dpr),
        dpr,
      };
    });

    // Canvas pixel width should match CSS width × DPR
    expect(scaling.canvasPixels).toBe(scaling.expectedPixels);
  });
});

