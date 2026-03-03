import { test, expect } from '@playwright/test';

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getContextMenuManager: () => unknown } })
        .__witEngine;
      return w && w.getContextMenuManager();
    });
  });

  /** Get the scroll container (the main grid element). */
  function getScrollContainer(page: import('@playwright/test').Page) {
    return page.locator('[tabindex="0"]').first();
  }

  /** Compute coordinates for a cell at (logicalRow, colIndex). */
  async function getCellCoords(
    page: import('@playwright/test').Page,
    row: number,
    col: number,
  ): Promise<{ x: number; y: number }> {
    return page.evaluate(({ row, col }: { row: number; col: number }) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      const scrollMgr = engine.getScrollManager();
      const frozenRows = engine.getConfig().frozenRows ?? 0;
      const frozenCols = engine.getConfig().frozenColumns ?? 0;

      let x = layout.rowNumberWidth;
      for (let i = 0; i < col; i++) x += layout.getColumnWidth(i);
      x += layout.getColumnWidth(col) / 2;

      let y = layout.headerHeight;
      for (let i = 0; i < row; i++) y += layout.getRowHeight(i);
      y += layout.getRowHeight(row) / 2;

      // Adjust for scroll position (non-frozen cells)
      if (col >= frozenCols) x -= scrollMgr.scrollX;
      if (row >= frozenRows) y -= scrollMgr.scrollY;

      return { x, y };
    }, { row, col });
  }

  /** Compute coordinates for a column header. */
  async function getHeaderCoords(
    page: import('@playwright/test').Page,
    col: number,
  ): Promise<{ x: number; y: number }> {
    return page.evaluate((ci: number) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      let x = layout.rowNumberWidth;
      for (let i = 0; i < ci; i++) x += layout.getColumnWidth(i);
      x += layout.getColumnWidth(ci) / 2;
      const y = layout.headerHeight / 2;
      return { x, y };
    }, col);
  }

  /** Compute coordinates for a row number cell. */
  async function getRowNumberCoords(
    page: import('@playwright/test').Page,
    row: number,
  ): Promise<{ x: number; y: number }> {
    return page.evaluate((ri: number) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      const frozenRows = engine.getConfig().frozenRows ?? 0;
      const scrollMgr = engine.getScrollManager();

      const x = layout.rowNumberWidth / 2;
      let y = layout.headerHeight;
      for (let i = 0; i < ri; i++) y += layout.getRowHeight(i);
      y += layout.getRowHeight(ri) / 2;

      if (ri >= frozenRows) y -= scrollMgr.scrollY;
      return { x, y };
    }, row);
  }

  test('right-click on cell shows context menu with Cut, Copy, Paste', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 0, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });

    // Wait for context menu to appear
    await page.waitForTimeout(200);

    // Check that the context menu is visible
    const isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(true);

    // Check menu contains Cut, Copy, Paste items
    const menuText = await page.evaluate(() => {
      const container = document.querySelector('.witqq-spreadsheet-container') || document.querySelector('[style*="position: relative"]');
      if (!container) return '';
      const menu = container.querySelector('[tabindex="-1"]');
      return menu?.textContent ?? '';
    });

    // Check via engine evaluate to inspect the DOM properly
    const menuContent = await page.evaluate(() => {
      // Find the context menu element - it's a direct child of the main container with tabindex=-1
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (menu.getAttribute('style')?.includes('z-index: 100')) {
          return menu.textContent;
        }
      }
      return null;
    });

    expect(menuContent).not.toBeNull();
    expect(menuContent).toContain('Cut');
    expect(menuContent).toContain('Copy');
    expect(menuContent).toContain('Paste');
  });

  test('right-click on header shows Sort Ascending, Sort Descending', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getHeaderCoords(page, 2);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    const menuContent = await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (menu.getAttribute('style')?.includes('z-index: 100')) {
          return menu.textContent;
        }
      }
      return null;
    });

    expect(menuContent).not.toBeNull();
    expect(menuContent).toContain('Sort Ascending');
    expect(menuContent).toContain('Sort Descending');
    // Should also contain clipboard items
    expect(menuContent).toContain('Cut');
    expect(menuContent).toContain('Copy');
  });

  test('right-click on row number shows Insert/Delete Row items', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getRowNumberCoords(page, 5);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    const menuContent = await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (menu.getAttribute('style')?.includes('z-index: 100')) {
          return menu.textContent;
        }
      }
      return null;
    });

    expect(menuContent).not.toBeNull();
    expect(menuContent).toContain('Insert Row Above');
    expect(menuContent).toContain('Insert Row Below');
    expect(menuContent).toContain('Delete Row');
  });

  test('clicking Sort Ascending sorts the column', async ({ page }) => {
    // Clear demo merges so sorting is not blocked
    await page.evaluate(() => { (window as any).__witEngine.unmergeCells(3, 2); });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    // Right-click on header (column 0 = ID)
    const coords = await getHeaderCoords(page, 0);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Click "Sort Ascending" menu item
    const clicked = await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (!menu.getAttribute('style')?.includes('z-index: 100')) continue;
        const items = menu.querySelectorAll('[data-index]');
        for (const item of items) {
          if (item.textContent?.includes('Sort Ascending')) {
            (item as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    });
    expect(clicked).toBe(true);

    await page.waitForTimeout(200);

    // Verify sort was applied
    const sortColumns = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns().map((s: any) => ({ col: s.col, direction: s.direction }));
    });

    expect(sortColumns).toEqual([{ col: 0, direction: 'asc' }]);
  });

  test('menu dismisses on Escape', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 0, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    let isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(false);
  });

  test('menu dismisses on outside click', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 0, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    let isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(true);

    // Click the page title area (clearly outside the grid)
    await page.locator('h1').click();
    await page.waitForTimeout(300);

    isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(false);
  });

  test('menu dismisses on item click', async ({ page }) => {
    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getHeaderCoords(page, 0);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Click on Sort Ascending item
    await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (!menu.getAttribute('style')?.includes('z-index: 100')) continue;
        const items = menu.querySelectorAll('[data-index]');
        for (const item of items) {
          if (item.textContent?.includes('Sort Ascending')) {
            (item as HTMLElement).click();
            return;
          }
        }
      }
    });
    await page.waitForTimeout(200);

    const isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(false);
  });

  test('custom item registration works via engine API', async ({ page }) => {
    // Register a custom item via engine
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.registerContextMenuItem({
        id: 'custom-e2e-test',
        label: 'Custom E2E Item',
        contexts: ['cell'],
        action: () => {
          (window as any).__customItemClicked = true;
        },
      });
    });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 0, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Verify custom item appears in menu
    const hasCustomItem = await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (!menu.getAttribute('style')?.includes('z-index: 100')) continue;
        return menu.textContent?.includes('Custom E2E Item') ?? false;
      }
      return false;
    });
    expect(hasCustomItem).toBe(true);

    // Click the custom item
    await page.evaluate(() => {
      const menus = document.querySelectorAll('[tabindex="-1"]');
      for (const menu of menus) {
        if (!menu.getAttribute('style')?.includes('z-index: 100')) continue;
        const items = menu.querySelectorAll('[data-index]');
        for (const item of items) {
          if (item.textContent?.includes('Custom E2E Item')) {
            (item as HTMLElement).click();
            return;
          }
        }
      }
    });
    await page.waitForTimeout(100);

    const clicked = await page.evaluate(() => (window as any).__customItemClicked === true);
    expect(clicked).toBe(true);
  });
});
