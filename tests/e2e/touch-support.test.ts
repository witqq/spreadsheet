import { test, expect } from '@playwright/test';

test.describe('Touch and mobile support', () => {
  test.use({ hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForSelector('canvas');
    await page.waitForTimeout(200);
  });

  test('touch tap selects a cell', async ({ page }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    const box = await scrollContainer.boundingBox();
    expect(box).toBeTruthy();

    const coords = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      return { x: layout.rowNumberWidth + 10, y: layout.headerHeight + 5 };
    });

    await page.touchscreen.tap(box!.x + coords.x, box!.y + coords.y);
    await page.waitForTimeout(100);

    const selection = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    expect(selection.activeCell.row).toBe(0);
    expect(selection.activeCell.col).toBe(0);
  });

  test('touch tap on different cell changes selection', async ({ page }) => {
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    const box = await scrollContainer.boundingBox();
    expect(box).toBeTruthy();

    const coords = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      const col0Width = layout.getColumnWidth(0);
      const col1Width = layout.getColumnWidth(1);
      return {
        cell01: { x: layout.rowNumberWidth + col0Width + 10, y: layout.headerHeight + 5 },
        cell22: {
          x: layout.rowNumberWidth + col0Width + col1Width + 10,
          y: layout.headerHeight + 2 * layout.rowHeight + 5,
        },
      };
    });

    await page.touchscreen.tap(box!.x + coords.cell01.x, box!.y + coords.cell01.y);
    await page.waitForTimeout(100);

    let selection = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    expect(selection.activeCell.row).toBe(0);
    expect(selection.activeCell.col).toBe(1);

    await page.touchscreen.tap(box!.x + coords.cell22.x, box!.y + coords.cell22.y);
    await page.waitForTimeout(100);

    selection = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    expect(selection.activeCell.row).toBe(2);
    expect(selection.activeCell.col).toBe(2);
  });

  test('CSS touch-action is set on scroll container', async ({ page }) => {
    const touchAction = await page.evaluate(() => {
      const scrollEl = document.querySelector('div[style*="overflow: auto"]') as HTMLElement;
      return scrollEl?.style.touchAction;
    });
    expect(touchAction).toBe('pan-x pan-y');
  });

  test('touch scroll does not emit cell selection', async ({ page }) => {
    // Verify that a touch drag (scroll gesture) does NOT trigger cell selection
    const selectionBefore = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });

    // Simulate a touch drag via evaluate (synthetic events)
    await page.evaluate(() => {
      const el = document.querySelector('div[style*="overflow: auto"]') as HTMLElement;
      const startTouch = new Touch({ identifier: 1, target: el, clientX: 200, clientY: 300 });
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, touches: [startTouch], changedTouches: [startTouch],
      }));
      // Move far enough to exceed tap threshold (10px)
      for (let i = 1; i <= 5; i++) {
        const moveTouch = new Touch({ identifier: 1, target: el, clientX: 200, clientY: 300 - i * 20 });
        el.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true, touches: [moveTouch], changedTouches: [moveTouch],
        }));
      }
      const endTouch = new Touch({ identifier: 1, target: el, clientX: 200, clientY: 200 });
      el.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true, touches: [], changedTouches: [endTouch],
      }));
    });

    await page.waitForTimeout(100);

    const selectionAfter = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    // Selection should remain unchanged (scroll gesture, not tap)
    expect(selectionAfter.activeCell.row).toBe(selectionBefore.activeCell.row);
    expect(selectionAfter.activeCell.col).toBe(selectionBefore.activeCell.col);
  });
});
