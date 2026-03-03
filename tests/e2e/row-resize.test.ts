import { test, expect } from '@playwright/test';

test.describe('Row Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    // Wait for grid to fully render
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getLayoutEngine: () => unknown } })
        .__witEngine;
      return w && w.getLayoutEngine();
    });
  });

  test('drag row border resizes row height', async ({ page }) => {
    // Get initial height of first row (default = 28 in demo theme)
    const initialHeight = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getRowHeight: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getRowHeight(0);
    });
    expect(initialHeight).toBe(28);

    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Row 0 bottom border is at headerHeight (32) + rowHeight (28) = 60 from top
    // Must be in row-number column area (x < rowNumberWidth=50)
    const borderX = box!.x + 25;
    const borderY = box!.y + 60;

    // Drag down by 30px
    await page.mouse.move(borderX, borderY);
    await page.mouse.down();
    await page.mouse.move(borderX, borderY + 30, { steps: 5 });
    await page.mouse.up();

    // Verify height changed
    const newHeight = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getRowHeight: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getRowHeight(0);
    });
    expect(newHeight).toBe(58); // 28 + 30
  });

  test('row resize is undoable via Ctrl+Z', async ({ page }) => {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const borderX = box!.x + 25;
    const borderY = box!.y + 60;

    // Resize row 0
    await page.mouse.move(borderX, borderY);
    await page.mouse.down();
    await page.mouse.move(borderX, borderY + 40, { steps: 5 });
    await page.mouse.up();

    // Verify height changed
    let height = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getRowHeight: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getRowHeight(0);
    });
    expect(height).toBe(68);

    // Focus the grid and undo
    await scrollContainer.click();
    await page.keyboard.press('Control+z');

    // Wait a tick for undo to process
    await page.waitForTimeout(100);

    // Verify height restored
    height = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getRowHeight: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getRowHeight(0);
    });
    expect(height).toBe(28);
  });

  test('cursor changes to row-resize on hover near row border', async ({ page }) => {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Row 0 bottom border at y=60 (headerH 32 + rowH 28), in row-number area x=25
    const rowNumX = box!.x + 25;
    const borderY = box!.y + 60;

    // Move to border — cursor should become row-resize
    await page.mouse.move(rowNumX, borderY);
    await page.waitForTimeout(100);
    const cursorNear = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return (engine as any).rowResizeManager.scrollContainer.style.cursor;
    });
    expect(cursorNear).toBe('row-resize');

    // Move away — cursor should reset
    await page.mouse.move(rowNumX, box!.y + 45);
    await page.waitForTimeout(100);
    const cursorAway = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return (engine as any).rowResizeManager.scrollContainer.style.cursor;
    });
    expect(cursorAway).toBe('');
  });
});
