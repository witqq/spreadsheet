import { test, expect } from '@playwright/test';

/**
 * E2E verification tests for context menu submenu functionality.
 * Verifies: chevron indicator, submenu open on hover, keyboard navigation, empty menu prevention.
 */
test.describe('Context Menu Submenu Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getContextMenuManager: () => unknown } })
        .__witEngine;
      return w && w.getContextMenuManager();
    });
  });

  function getScrollContainer(page: import('@playwright/test').Page) {
    return page.locator('[tabindex="0"]').first();
  }

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

      if (col >= frozenCols) x -= scrollMgr.scrollX;
      if (row >= frozenRows) y -= scrollMgr.scrollY;

      return { x, y };
    }, { row, col });
  }

  test('1. Submenu chevron indicator renders', async ({ page }) => {
    // Register an item with submenu
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.registerContextMenuItem({
        id: 'test-submenu-parent',
        label: 'Submenu Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'sub-child-1', label: 'Sub Child 1', contexts: ['cell'], action: () => {} },
          { id: 'sub-child-2', label: 'Sub Child 2', contexts: ['cell'], action: () => {} },
        ],
      });
    });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 1, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Verify chevron exists on the submenu parent item
    const hasChevron = await page.evaluate(() => {
      const menus = document.querySelectorAll('[data-menu-depth]');
      for (const menu of menus) {
        const items = menu.querySelectorAll('[data-index]');
        for (const item of items) {
          if (item.textContent?.includes('Submenu Parent') && item.querySelector('[data-chevron]')) {
            return true;
          }
        }
      }
      return false;
    });

    expect(hasChevron).toBe(true);

    // Clean up
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.unregisterContextMenuItem('test-submenu-parent');
    });
  });

  test('2. Submenu opens on hover', async ({ page }) => {
    // Register submenu item
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.registerContextMenuItem({
        id: 'test-hover-parent',
        label: 'Hover Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'hover-child', label: 'Hover Child', contexts: ['cell'], action: () => {} },
        ],
      });
    });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();

    const coords = await getCellCoords(page, 1, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Find the submenu parent item and hover over it
    const parentItemBox = await page.evaluate(() => {
      const menus = document.querySelectorAll('[style*="z-index: 100"]');
      for (const menu of menus) {
        const items = menu.querySelectorAll('[data-index]');
        for (const item of items) {
          if (item.textContent?.includes('Hover Parent')) {
            const rect = item.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }
        }
      }
      return null;
    });

    expect(parentItemBox).not.toBeNull();
    await page.mouse.move(parentItemBox!.x, parentItemBox!.y);

    // Wait for submenu delay (200ms) + buffer
    await page.waitForTimeout(350);

    // Check submenu panel appeared
    const submenuCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-menu-depth]').length;
    });

    expect(submenuCount).toBe(2); // root + submenu

    // Verify submenu contains child item
    const submenuText = await page.evaluate(() => {
      const panels = document.querySelectorAll('[data-menu-depth="1"]');
      return panels[0]?.textContent ?? '';
    });
    expect(submenuText).toContain('Hover Child');

    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.unregisterContextMenuItem('test-hover-parent');
    });
  });

  test('3. Submenu keyboard navigation (ArrowRight/Left/Up/Down)', async ({ page }) => {
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.registerContextMenuItem({
        id: 'test-kb-parent',
        label: 'KB Parent',
        contexts: ['cell'],
        submenu: [
          { id: 'kb-child-1', label: 'KB Child 1', contexts: ['cell'], action: () => {
            (window as any).__kbChildClicked = true;
          }},
          { id: 'kb-child-2', label: 'KB Child 2', contexts: ['cell'], action: () => {} },
        ],
      });
    });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    const coords = await getCellCoords(page, 1, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Navigate to the submenu parent using ArrowDown repeatedly
    // First get count of items before the KB Parent
    const parentIndex = await page.evaluate(() => {
      const menu = document.querySelector('[data-menu-depth="0"]');
      if (!menu) return -1;
      const items = menu.querySelectorAll('[data-index]');
      for (let i = 0; i < items.length; i++) {
        if (items[i].textContent?.includes('KB Parent')) return i;
      }
      return -1;
    });
    expect(parentIndex).toBeGreaterThanOrEqual(0);

    // Press ArrowDown to reach the parent item
    for (let i = 0; i <= parentIndex; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // ArrowRight should open submenu
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    let submenuCount = await page.evaluate(() => document.querySelectorAll('[data-menu-depth]').length);
    expect(submenuCount).toBe(2);

    // ArrowDown in submenu should navigate
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    // ArrowLeft should close submenu
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);

    submenuCount = await page.evaluate(() => document.querySelectorAll('[data-menu-depth]').length);
    expect(submenuCount).toBe(1); // Only root remains

    // Re-open and select with Enter
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    const clicked = await page.evaluate(() => (window as any).__kbChildClicked === true);
    expect(clicked).toBe(true);

    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.unregisterContextMenuItem('test-kb-parent');
    });
  });

  test('4. Empty menu prevention — suppresses when all items invisible', async ({ page }) => {
    // Register ONLY one item that is always invisible
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // Remove all default items first
      const items = engine.getContextMenuManager().getItems();
      const ids = Array.from(items.keys()) as string[];
      for (const id of ids) engine.unregisterContextMenuItem(id);

      // Register only invisible item
      engine.registerContextMenuItem({
        id: 'invisible-item',
        label: 'Invisible',
        contexts: ['cell'],
        action: () => {},
        isVisible: () => false,
      });
    });

    const scrollContainer = getScrollContainer(page);
    const box = await scrollContainer.boundingBox();
    const coords = await getCellCoords(page, 1, 1);
    await page.mouse.click(box!.x + coords.x, box!.y + coords.y, { button: 'right' });
    await page.waitForTimeout(200);

    // Menu should NOT be open
    const isOpen = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getContextMenuManager()?.isOpen ?? false;
    });
    expect(isOpen).toBe(false);

    // No menu panels in DOM
    const panelCount = await page.evaluate(() => document.querySelectorAll('[data-menu-depth]').length);
    expect(panelCount).toBe(0);
  });
});
