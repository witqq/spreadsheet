import { test, expect } from '@playwright/test';

test.describe('Column Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getSortColumns: () => unknown } })
        .__witEngine;
      return w && w.getSortColumns();
    });
    // Clear demo merges so sorting is not blocked
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.unmergeCells(3, 2);
    });
  });

  /**
   * Helper: click the center of a column header by column index.
   * rowNumberWidth=50, headerHeight=32, column widths from LayoutEngine.
   */
  async function clickHeader(
    page: import('@playwright/test').Page,
    colIndex: number,
    opts?: { shift?: boolean },
  ) {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Compute x: click on sort icon zone (rightmost 7px from right edge of column)
    const coords = await page.evaluate((ci: number) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      let x = 50; // rowNumberWidth
      for (let i = 0; i < ci; i++) x += layout.getColumnWidth(i);
      const w = layout.getColumnWidth(ci);
      // Sort icon is in rightmost 14px of icon zone (28px from right edge)
      // Click at center of sort icon: right edge - 7px
      return { x: x + w - 7, y: 16 }; // y=16 is center of 32px header
    }, colIndex);

    if (opts?.shift) await page.keyboard.down('Shift');
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y);
    if (opts?.shift) await page.keyboard.up('Shift');
    // Wait for sort to apply and re-render
    await page.waitForTimeout(100);
  }

  test('click header sorts ascending, then descending, then clears', async ({ page }) => {
    // Click ID column (index 0) — should sort ascending
    await clickHeader(page, 0);
    const sort1 = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });
    expect(sort1).toEqual([{ col: 0, direction: 'asc' }]);

    // Click again — descending
    await clickHeader(page, 0);
    const sort2 = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });
    expect(sort2).toEqual([{ col: 0, direction: 'desc' }]);

    // Click again — clears sort
    await clickHeader(page, 0);
    const sort3 = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });
    expect(sort3).toEqual([]);
  });

  test('ascending sort places lowest ID first', async ({ page }) => {
    // Sort ID ascending
    await clickHeader(page, 0);

    // Row 0 (logical) should have ID = 1 (already the case for asc on 1..100000)
    const firstVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const dv = engine.getDataView();
      const phys = dv.getPhysicalRow(0);
      return engine.getCellStore().get(phys, 0)?.value;
    });
    expect(firstVal).toBe(1);
  });

  test('descending sort places highest ID first', async ({ page }) => {
    // Click twice for descending
    await clickHeader(page, 0);
    await clickHeader(page, 0);

    const firstVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const dv = engine.getDataView();
      const phys = dv.getPhysicalRow(0);
      return engine.getCellStore().get(phys, 0)?.value;
    });
    expect(firstVal).toBe(100000);
  });

  test('shift-click adds multi-column sort', async ({ page }) => {
    // Sort by Department (col 6) first
    await clickHeader(page, 6);
    // Shift-click on Age (col 4) to add secondary sort
    await clickHeader(page, 4, { shift: true });

    const sort = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });
    expect(sort).toEqual([
      { col: 6, direction: 'asc' },
      { col: 4, direction: 'asc' },
    ]);
  });

  test('programmatic sortBy works', async ({ page }) => {
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.sortBy([{ col: 0, direction: 'desc' }]);
    });

    const firstVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const dv = engine.getDataView();
      const phys = dv.getPhysicalRow(0);
      return engine.getCellStore().get(phys, 0)?.value;
    });
    expect(firstVal).toBe(100000);

    const sort = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });
    expect(sort).toEqual([{ col: 0, direction: 'desc' }]);
  });

  test('clearSort restores original order', async ({ page }) => {
    // Sort desc, then clear
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.sortBy([{ col: 0, direction: 'desc' }]);
    });
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.clearSort();
    });

    const firstVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const dv = engine.getDataView();
      const phys = dv.getPhysicalRow(0);
      return engine.getCellStore().get(phys, 0)?.value;
    });
    expect(firstVal).toBe(1);

    const sort = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().length;
    });
    expect(sort).toBe(0);
  });
});
