import { test, expect } from '@playwright/test';

/**
 * E2E tests for UX feedback fixes:
 * 1. Header visible when filter removes all rows
 * 2. Right-click header does not select column
 * 3. Sort click does not select column
 * 4. Mouse drag selection
 * 5. Type-to-edit (printable char starts editing)
 */

test.describe('UX Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getSelection: () => unknown } })
        .__witEngine;
      return w && w.getSelection();
    });
  });

  /** Helper: get bounding box of scroll container. */
  async function getScrollBox(page: import('@playwright/test').Page) {
    const scrollContainer = page.locator('[tabindex="0"]').first();
    const box = await scrollContainer.boundingBox();
    expect(box).not.toBeNull();
    return box!;
  }

  /** Helper: compute pixel coordinates for a cell. */
  async function getCellCoords(page: import('@playwright/test').Page, row: number, col: number) {
    return page.evaluate(
      ({ r, c }) => {
        const engine = (window as any).__witEngine;
        const layout = engine.getLayoutEngine();
        let x = 50; // rowNumberWidth
        for (let i = 0; i < c; i++) x += layout.getColumnWidth(i);
        const w = layout.getColumnWidth(c);
        const headerHeight = 32;
        const rowHeight = layout.getRowHeight(r);
        const y = headerHeight + r * rowHeight;
        return { x: x + w / 2, y: y + rowHeight / 2 };
      },
      { r: row, c: col },
    );
  }

  /** Helper: compute pixel coordinates for a header cell. */
  async function getHeaderCoords(page: import('@playwright/test').Page, col: number) {
    return page.evaluate(
      (ci: number) => {
        const engine = (window as any).__witEngine;
        const layout = engine.getLayoutEngine();
        let x = 50;
        for (let i = 0; i < ci; i++) x += layout.getColumnWidth(i);
        const w = layout.getColumnWidth(ci);
        return { x: x + w / 2, y: 16 };
      },
      col,
    );
  }

  test('header visible when filter removes all rows', async ({ page }) => {
    // Apply filter that matches no rows (ID > 999999 for 100K dataset)
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setColumnFilter(0, [{ col: 0, operator: 'greaterThan', value: 999999 }]);
    });
    await page.waitForTimeout(100);

    // Verify 0 visible rows
    const rowCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getDataView().visibleRowCount;
    });
    expect(rowCount).toBe(0);

    // Header text should still be visible — check via canvas pixel test
    // We verify by reading the viewport range which should have valid column range
    const viewport = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const vp = engine.getViewportManager();
      const sm = engine.getScrollManager();
      const el = sm.getElement();
      return vp.computeVisibleRange(el.scrollLeft, el.scrollTop, el.clientWidth, el.clientHeight);
    });
    // Columns should be visible even with 0 rows
    expect(viewport.endCol).toBeGreaterThanOrEqual(0);
    expect(viewport.visibleColCount).toBeGreaterThan(0);
    expect(viewport.visibleRowCount).toBe(0);
  });

  test('right-click header does not select column', async ({ page }) => {
    const box = await getScrollBox(page);
    const coords = await getHeaderCoords(page, 1);

    // First click a cell to have a known selection state
    const cellCoords = await getCellCoords(page, 0, 0);
    await page.mouse.click(box.x + cellCoords.x, box.y + cellCoords.y);
    await page.waitForTimeout(50);

    // Right-click on column 1 header
    await page.mouse.click(box.x + coords.x, box.y + coords.y, { button: 'right' });
    await page.waitForTimeout(50);

    // Selection should NOT be entire column — active cell should still be (0,0)
    const sel = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    expect(sel.activeCell).toEqual({ row: 0, col: 0 });
  });

  test('header center click does NOT sort', async ({ page }) => {
    const box = await getScrollBox(page);
    const coords = await getHeaderCoords(page, 0);

    // Click center of header — should not trigger sort
    await page.mouse.click(box.x + coords.x, box.y + coords.y);
    await page.waitForTimeout(100);

    // Sort should NOT be active
    const sort = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns();
    });
    expect(sort.length).toBe(0);
  });

  test('sort icon click triggers sort', async ({ page }) => {
    // Clear demo merges so sorting is not blocked
    await page.evaluate(() => { (window as any).__witEngine.unmergeCells(3, 2); });

    const box = await getScrollBox(page);

    // Click on sort icon zone (rightmost 7px from right edge of column)
    const sortIconCoords = await page.evaluate((ci: number) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      let x = 50;
      for (let i = 0; i < ci; i++) x += layout.getColumnWidth(i);
      const w = layout.getColumnWidth(ci);
      return { x: x + w - 7, y: 16 };
    }, 0);

    await page.mouse.click(box.x + sortIconCoords.x, box.y + sortIconCoords.y);
    await page.waitForTimeout(100);

    const sort = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSortColumns();
    });
    expect(sort.length).toBe(1);
    expect(sort[0].direction).toBe('asc');
  });

  test('mouse drag selects cell range', async ({ page }) => {
    const box = await getScrollBox(page);
    const startCoords = await getCellCoords(page, 0, 0);
    const endCoords = await getCellCoords(page, 2, 2);

    // Mouse drag from (0,0) to (2,2)
    await page.mouse.move(box.x + startCoords.x, box.y + startCoords.y);
    await page.mouse.down();
    // Move through intermediate points for smooth drag
    await page.mouse.move(box.x + endCoords.x, box.y + endCoords.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(50);

    // Selection should span from (0,0) to (2,2)
    const sel = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getSelection();
    });
    expect(sel.ranges.length).toBe(1);
    const range = sel.ranges[0];
    expect(range.startRow).toBe(0);
    expect(range.startCol).toBe(0);
    expect(range.endRow).toBe(2);
    expect(range.endCol).toBe(2);
  });

  test('typing printable character starts editing', async ({ page }) => {
    const box = await getScrollBox(page);
    const cellCoords = await getCellCoords(page, 0, 1);

    // Click on cell (0,1) to select it
    await page.mouse.click(box.x + cellCoords.x, box.y + cellCoords.y);
    await page.waitForTimeout(50);

    // Type a character
    await page.keyboard.press('a');
    await page.waitForTimeout(50);

    // Editor should be open with 'a' as content
    const editorState = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const editor = engine.getInlineEditor();
      // InlineEditor textarea is appended to the mount container
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
      return {
        isEditing: editor?.isEditing ?? false,
        value: textarea?.value ?? null,
      };
    });
    expect(editorState.isEditing).toBe(true);
    expect(editorState.value).toBe('a');

    // Press Escape to cancel
    await page.keyboard.press('Escape');
  });

  test('Ctrl+key does not start editing', async ({ page }) => {
    const box = await getScrollBox(page);
    const cellCoords = await getCellCoords(page, 0, 1);

    // Click cell to select
    await page.mouse.click(box.x + cellCoords.x, box.y + cellCoords.y);
    await page.waitForTimeout(50);

    // Ctrl+A should not open editor
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(50);

    const isEditing = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getInlineEditor()?.isEditing ?? false;
    });
    expect(isEditing).toBe(false);
  });
});
