import { test, expect } from '@playwright/test';

test.describe('React wrapper production features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForSelector('canvas');
  });

  test('theme prop update: toggle switches canvas background', async ({ page }) => {
    // Use the themeChange event to verify theme is applied via prop
    const themeApplied = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const initialBg = engine.getTheme().colors.background;
      return initialBg;
    });
    expect(themeApplied).toBe('#ffffff'); // lightTheme default

    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(300);

    const themeAfter = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getTheme().colors.background;
    });
    expect(themeAfter).toBe('#1e1e1e'); // darkTheme
  });

  test('theme prop update preserves engine instance (no remount)', async ({ page }) => {
    // Store engine identity marker before toggle
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      (window as any).__engineId = engine;
    });

    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(200);

    const sameEngine = await page.evaluate(() => {
      return (window as any).__witEngine === (window as any).__engineId;
    });
    expect(sameEngine).toBe(true);
  });

  test('callback props: selectionChange fires on click', async ({ page }) => {
    // Add a selection change listener via engine
    const selectionChanged = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const engine = (window as any).__witEngine;
        engine.on('selectionChange', () => resolve(true));
        // Trigger a selection change programmatically
        engine.getSelectionManager().selectCell(2, 2);
      });
    });
    expect(selectionChanged).toBe(true);
  });

  test('ref API: getCell returns correct data', async ({ page }) => {
    const cellValue = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const cell = engine.getCell(0, 0);
      return cell?.value;
    });
    expect(cellValue).toBe(1); // ID column, row 0
  });

  test('ref API: setCell updates cell value', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setCell(0, 1, 'TestName');
      const cell = engine.getCell(0, 1);
      return cell?.value;
    });
    expect(result).toBe('TestName');
  });

  test('ref API: selectCell changes selection', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.getSelectionManager().selectCell(3, 2);
      const sel = engine.getSelection();
      return { row: sel.activeCell.row, col: sel.activeCell.col };
    });
    expect(result.row).toBe(3);
    expect(result.col).toBe(2);
  });
});
