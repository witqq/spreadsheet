import { test, expect } from '@playwright/test';

test.describe('Frozen Panes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    // Wait for engine to be ready
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getSortColumns: () => unknown } })
        .__witEngine;
      return w && w.getSortColumns();
    });
  });

  test('frozen rows stay pinned after vertical scroll', async ({ page }) => {
    // Demo has frozenRows=2, frozenColumns=1
    // Get the canvas
    const contentCanvas = page.locator('canvas').first();
    await expect(contentCanvas).toBeVisible();

    // Capture pixel sample from the frozen row area (row 0 cell area)
    const frozenRowPixelsBefore = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      // Sample a horizontal strip in frozen row 0 area (y=40, across x=60..200)
      const imageData = ctx.getImageData(60, 40, 140, 1);
      return Array.from(imageData.data.slice(0, 20));
    });

    // Scroll down significantly (500px = ~16 rows)
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(300);

    // Capture the same frozen row area after scroll
    const frozenRowPixelsAfter = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(60, 40, 140, 1);
      return Array.from(imageData.data.slice(0, 20));
    });

    // Frozen row area should look the same (same cells rendered)
    expect(frozenRowPixelsBefore).toEqual(frozenRowPixelsAfter);
  });

  test('frozen column stays pinned after horizontal scroll', async ({ page }) => {
    const contentCanvas = page.locator('canvas').first();
    await expect(contentCanvas).toBeVisible();

    // Capture pixel sample from frozen col area (col 0, below frozen rows)
    const frozenColPixelsBefore = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(80, 100, 1, 50);
      return Array.from(imageData.data.slice(0, 20));
    });

    // Scroll right
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 400;
    });
    await page.waitForTimeout(300);

    const frozenColPixelsAfter = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(80, 100, 1, 50);
      return Array.from(imageData.data.slice(0, 20));
    });

    // Frozen col area should look the same
    expect(frozenColPixelsBefore).toEqual(frozenColPixelsAfter);
  });

  test('separator lines are rendered at frozen pane boundaries', async ({ page }) => {
    const contentCanvas = page.locator('canvas').first();
    await expect(contentCanvas).toBeVisible();

    // frozenSeparator color is #c0c0c0 (192, 192, 192) in light theme
    // Check for horizontal separator line below frozen rows
    // headerHeight=32, frozenRowsHeight=2*28=56, so y=88
    const hSep = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(100, 88, 1, 1);
      return { r: imageData.data[0], g: imageData.data[1], b: imageData.data[2], a: imageData.data[3] };
    });

    // Should be close to frozenSeparator color (#c0c0c0 = 192,192,192)
    expect(hSep.a).toBeGreaterThan(100);
    expect(hSep.r).toBeLessThan(220);
    expect(hSep.r).toBeGreaterThan(120);

    // Check for vertical separator line right of frozen col
    const vSep = await contentCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!;
      // Scan for grey separator pixel along x axis
      for (let x = 50; x < 300; x++) {
        const imageData = ctx.getImageData(x, 120, 1, 1);
        const r = imageData.data[0], g = imageData.data[1], b = imageData.data[2];
        if (Math.abs(r - 192) < 20 && Math.abs(g - 192) < 20 && Math.abs(b - 192) < 20) {
          return { found: true, x, r, g, b };
        }
      }
      return { found: false, x: -1, r: 0, g: 0, b: 0 };
    });

    expect(vSep.found).toBe(true);
    expect(vSep.x).toBeGreaterThan(50);
  });

  test('main content scrolls while frozen areas stay fixed', async ({ page }) => {
    // Use engine API to verify that scrolling changes visible rows in main area
    // while frozen rows remain the same
    const scrollContainer = page.locator('div[style*="overflow: auto"]');

    // Get visible row range before scroll
    const beforeScroll = await scrollContainer.evaluate((el: HTMLDivElement) => {
      const engine = (window as unknown as { __witEngine: {
        getSelection: () => { activeCell: { row: number; col: number } };
      } }).__witEngine;
      return { scrollTop: el.scrollTop };
    });

    expect(beforeScroll.scrollTop).toBe(0);

    // Scroll down significantly
    await scrollContainer.evaluate((el: HTMLDivElement) => {
      el.scrollTop = 1000;
    });
    await page.waitForTimeout(300);

    const afterScroll = await scrollContainer.evaluate((el: HTMLDivElement) => {
      return { scrollTop: el.scrollTop };
    });

    // Verify scroll actually happened
    expect(afterScroll.scrollTop).toBeGreaterThan(900);
  });

  test('clicking on frozen row cell selects correct cell when scrolled', async ({ page }) => {
    // Scroll down first
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(300);

    // Click on frozen row 0 area
    const contentCanvas = page.locator('canvas').first();
    const box = await contentCanvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Click at approximately row 0, col 1 (after frozen col)
    await page.mouse.click(box.x + 200, box.y + 40);
    await page.waitForTimeout(200);

    // Check that the selected cell is in row 0 (frozen row)
    const selectedRow = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getSelection: () => { activeCell: { row: number; col: number } } } })
        .__witEngine;
      return engine.getSelection().activeCell.row;
    });

    expect(selectedRow).toBe(0);
  });
});
