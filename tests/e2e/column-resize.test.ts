import { test, expect } from '@playwright/test';

test.describe('Column Resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    // Wait for grid to fully render
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getLayoutEngine: () => unknown } })
        .__witEngine;
      return w && w.getLayoutEngine();
    });
  });

  test('drag column header border resizes column', async ({ page }) => {
    // Get initial width of first column (ID column = 60px)
    const initialWidth = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getColumnWidth: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getColumnWidth(0);
    });
    expect(initialWidth).toBe(60);

    // Get the scroll container (the element with overflow:auto on top)
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Column 0 right border is at rowNumberWidth (50) + col0Width (60) = 110 from left
    // Header area is y < 40 (headerHeight)
    const borderX = box!.x + 110;
    const headerY = box!.y + 20;

    // Drag right by 40px
    await page.mouse.move(borderX, headerY);
    await page.mouse.down();
    await page.mouse.move(borderX + 40, headerY, { steps: 5 });
    await page.mouse.up();

    // Verify width changed
    const newWidth = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getColumnWidth: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getColumnWidth(0);
    });
    expect(newWidth).toBe(100); // 60 + 40
  });

  test('resize is undoable via Ctrl+Z', async ({ page }) => {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const borderX = box!.x + 110;
    const headerY = box!.y + 20;

    // Resize column 0
    await page.mouse.move(borderX, headerY);
    await page.mouse.down();
    await page.mouse.move(borderX + 50, headerY, { steps: 5 });
    await page.mouse.up();

    // Verify width changed
    let width = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getColumnWidth: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getColumnWidth(0);
    });
    expect(width).toBe(110);

    // Focus the grid and undo
    await scrollContainer.click();
    await page.keyboard.press('Control+z');

    // Wait a tick for undo to process
    await page.waitForTimeout(100);

    // Verify width restored
    width = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getColumnWidth: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getColumnWidth(0);
    });
    expect(width).toBe(60);
  });

  test('cursor changes to col-resize on hover near border', async ({ page }) => {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Col 0 right border at x=110 (rowNumberWidth 50 + col0 width 60), header area y=20
    const borderX = box!.x + 110;
    const headerY = box!.y + 20;

    // Move to border — cursor should become col-resize
    await page.mouse.move(borderX, headerY);
    await page.waitForTimeout(100);
    const cursorNear = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return (engine as any).columnResizeManager.scrollContainer.style.cursor;
    });
    expect(cursorNear).toBe('col-resize');

    // Move away — cursor should reset
    await page.mouse.move(box!.x + 80, headerY);
    await page.waitForTimeout(100);
    const cursorAway = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return (engine as any).columnResizeManager.scrollContainer.style.cursor;
    });
    expect(cursorAway).toBe('');
  });

  test('column min/max constraints are respected', async ({ page }) => {
    // Set minWidth on first column via engine config
    // The demo doesn't set min/max, so default minWidth = 30 applies
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const borderX = box!.x + 110;
    const headerY = box!.y + 20;

    // Drag left by 100px (more than width, should clamp to min=30)
    await page.mouse.move(borderX, headerY);
    await page.mouse.down();
    await page.mouse.move(borderX - 100, headerY, { steps: 5 });
    await page.mouse.up();

    const width = await page.evaluate(() => {
      const engine = (window as unknown as { __witEngine: { getLayoutEngine: () => { getColumnWidth: (i: number) => number } } })
        .__witEngine;
      return engine.getLayoutEngine().getColumnWidth(0);
    });
    expect(width).toBe(30); // DEFAULT_MIN_WIDTH
  });
});
