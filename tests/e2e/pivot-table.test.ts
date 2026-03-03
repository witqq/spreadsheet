import { test, expect } from '@playwright/test';

test.describe('Pivot Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: unknown }).__witEngine;
      return !!w;
    });
  });

  test('pivot button toggles pivot mode', async ({ page }) => {
    const btn = page.getByTestId('pivot-toggle');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('📊 Pivot');

    await btn.click();
    await expect(btn).toHaveText('📋 Table View');

    await btn.click();
    await expect(btn).toHaveText('📊 Pivot');
  });

  test('pivot renders with frozen dimension column', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    // Wait for engine to re-mount with pivot data
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return false;
      // Pivot has 5 rows (5 regions) — check first cell has region text
      const cell = engine.getCell(0, 0);
      return cell?.value != null && String(cell.value).length > 0;
    });

    // Verify first column has region dimension text
    const firstCell = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value ?? null;
    });
    expect(typeof firstCell).toBe('string');
    expect((firstCell as string).length).toBeGreaterThan(0);
  });

  test('pivot cells contain aggregated numeric values', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return false;
      const cell = engine.getCell(0, 1);
      return cell?.value != null && typeof cell.value === 'number';
    });

    const cellValue = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 1)?.value ?? null;
    });

    expect(typeof cellValue).toBe('number');
    expect(cellValue as number).toBeGreaterThan(0);
  });

  test('pivot has 5 rows for 5 regions', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value != null;
    });

    const rowCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return 0;
      let count = 0;
      for (let r = 0; r < 100; r++) {
        const cell = engine.getCell(r, 0);
        if (cell?.value != null && String(cell.value).length > 0) count++;
        else break;
      }
      return count;
    });

    expect(rowCount).toBe(5);
  });

  test('switching back restores original data', async ({ page }) => {
    // Get an original cell value
    const origCell = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value ?? null;
    });

    await page.getByTestId('pivot-toggle').click();
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value != null;
    });

    await page.getByTestId('pivot-toggle').click();
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      const cell = engine?.getCell(0, 0);
      return cell?.value != null;
    });

    const restoredCell = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value ?? null;
    });

    expect(restoredCell).toBe(origCell);
  });

  test('clicking aggregate cell opens drill-down sheet', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    // Wait for pivot data
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 1)?.value != null;
    });

    // Click a value cell (row 0, col 1 — first aggregate column)
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.getEventBus().emit('cellClick', {
        row: 0, col: 1,
        value: engine.getCell(0, 1)?.value ?? null,
        column: { key: 'test', title: 'Test' },
      });
    });

    // Verify drill-down title and back button appear
    const title = page.getByTestId('drill-down-title');
    await expect(title).toBeVisible({ timeout: 3000 });
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText).toContain('rows');

    const backBtn = page.getByTestId('drill-down-back');
    await expect(backBtn).toBeVisible();
  });

  test('drill-down sheet uses WitTable with source data', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 1)?.value != null;
    });

    // Get the first region name
    const regionName = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCell(0, 0)?.value ?? null;
    });

    // Click first aggregate cell
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.getEventBus().emit('cellClick', {
        row: 0, col: 1,
        value: engine.getCell(0, 1)?.value ?? null,
        column: { key: 'test', title: 'Test' },
      });
    });

    // Wait for drill-down WitTable to mount
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      // Drill-down shows source rows — first cell should be a number (ID)
      const cell = engine?.getCell(0, 0);
      return cell?.value != null && typeof cell.value === 'number';
    }, null, { timeout: 5000 });

    // Title should contain the region name
    const titleText = await page.getByTestId('drill-down-title').textContent();
    expect(titleText).toContain(String(regionName));

    // Source data is rendered via WitTable — verify cell values exist
    const firstId = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value ?? null;
    });
    expect(typeof firstId).toBe('number');
  });

  test('drill-down back button returns to pivot', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 1)?.value != null;
    });

    // Open drill-down
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.getEventBus().emit('cellClick', {
        row: 0, col: 1,
        value: engine.getCell(0, 1)?.value ?? null,
        column: { key: 'test', title: 'Test' },
      });
    });

    const backBtn = page.getByTestId('drill-down-back');
    await expect(backBtn).toBeVisible({ timeout: 3000 });

    // Click back to pivot
    await backBtn.click();
    await expect(backBtn).not.toBeVisible({ timeout: 3000 });

    // Verify pivot data is back
    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      const cell = engine?.getCell(0, 0);
      return cell?.value != null && typeof cell.value === 'string';
    });
  });

  test('clicking dimension column does not open drill-down', async ({ page }) => {
    await page.getByTestId('pivot-toggle').click();

    await page.waitForFunction(() => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(0, 0)?.value != null;
    });

    // Click a dimension cell (col 0)
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.getEventBus().emit('cellClick', {
        row: 0, col: 0,
        value: engine.getCell(0, 0)?.value ?? null,
        column: { key: 'test', title: 'Test' },
      });
    });

    // Back button should NOT appear
    const backBtn = page.getByTestId('drill-down-back');
    await page.waitForTimeout(500);
    await expect(backBtn).not.toBeVisible();
  });
});
