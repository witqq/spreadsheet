import { test, expect } from '@playwright/test';

test.describe('Row Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getFilterEngine: () => unknown } })
        .__witEngine;
      return w && w.getFilterEngine();
    });
  });

  test('setColumnFilter hides non-matching rows and getFilteredRowCount reflects it', async ({
    page,
  }) => {
    // Get initial row count
    const initial = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });
    expect(initial).toBeGreaterThan(0);

    // Filter: column 0 (ID) equals value at row 0
    const result = await page.evaluate((totalRows: number) => {
      const engine = (window as any).__witEngine;
      const store = engine.getCellStore();
      // Get value of first cell for filtering
      const cell = store.get(0, 0);
      const val = cell?.value;
      engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: val }]);
      return {
        filtered: engine.getFilteredRowCount(),
        total: totalRows,
        filterValue: val,
      };
    }, initial);

    expect(result.filtered).toBeLessThan(result.total);
    expect(result.filtered).toBeGreaterThanOrEqual(1);
  });

  test('clearFilters restores all rows', async ({ page }) => {
    const initial = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });

    // Apply a filter
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setColumnFilter(0, [{ col: 0, operator: 'equals', value: 'IMPOSSIBLE_VALUE_XYZ' }]);
    });

    const afterFilter = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });
    expect(afterFilter).toBe(0);

    // Clear filters
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.clearFilters();
    });

    const afterClear = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });
    expect(afterClear).toBe(initial);
  });

  test('removeColumnFilter only removes that column filter', async ({ page }) => {
    // Set two column filters
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setColumnFilter(0, [{ col: 0, operator: 'isNotEmpty' }]);
      engine.setColumnFilter(1, [{ col: 1, operator: 'isNotEmpty' }]);
    });

    const withBoth = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });

    // Remove column 0 filter only
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.removeColumnFilter(0);
    });

    const withOne = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getFilteredRowCount();
    });

    // Removing a filter should keep same or show more rows
    expect(withOne).toBeGreaterThanOrEqual(withBoth);
  });

  test('filter + sort pipeline: filtered rows are sorted correctly', async ({ page }) => {
    // Clear demo merges so sorting is not blocked
    await page.evaluate(() => { (window as any).__witEngine.unmergeCells(3, 2); });

    // Apply greaterThan filter on column 0 (ID, numeric)
    const sorted = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const store = engine.getCellStore();
      const dv = engine.getDataView();

      // Filter: ID > 50 (column 0 has numeric IDs starting from 1)
      engine.setColumnFilter(0, [{ col: 0, operator: 'greaterThan', value: 50 }]);
      // Sort column 0 descending
      engine.sortBy([{ col: 0, direction: 'desc' }]);

      // Read first 5 visible logical rows
      const values: unknown[] = [];
      const count = Math.min(5, engine.getFilteredRowCount());
      for (let i = 0; i < count; i++) {
        const phys = dv.getPhysicalRow(i);
        const cell = store.get(phys, 0);
        values.push(cell?.value);
      }
      return values;
    });

    // Values should be descending and all > 50
    for (let i = 0; i < sorted.length; i++) {
      expect(sorted[i]).toBeGreaterThan(50);
      if (i > 0) expect(sorted[i - 1]).toBeGreaterThanOrEqual(sorted[i] as number);
    }
  });

  test('filterChange event fires with correct counts', async ({ page }) => {
    const eventData = await page.evaluate(() => {
      return new Promise<{ visibleRowCount: number; totalRowCount: number }>((resolve) => {
        const engine = (window as any).__witEngine;
        engine.on('filterChange', (event: any) => {
          resolve({ visibleRowCount: event.visibleRowCount, totalRowCount: event.totalRowCount });
        });
        engine.setColumnFilter(0, [
          { col: 0, operator: 'equals', value: 'IMPOSSIBLE_VALUE_XYZ' },
        ]);
      });
    });

    expect(eventData.visibleRowCount).toBe(0);
    expect(eventData.totalRowCount).toBeGreaterThan(0);
  });

  test('DataView maps logical to physical correctly after filtering', async ({ page }) => {
    const mapping = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const dv = engine.getDataView();
      const store = engine.getCellStore();

      // Filter to only rows where col 0 value > 90
      engine.setColumnFilter(0, [{ col: 0, operator: 'greaterThan', value: 90 }]);

      const result: { logical: number; physical: number; value: unknown }[] = [];
      const count = Math.min(5, engine.getFilteredRowCount());
      for (let i = 0; i < count; i++) {
        const phys = dv.getPhysicalRow(i);
        const cell = store.get(phys, 0);
        result.push({ logical: i, physical: phys, value: cell?.value });
      }
      return result;
    });

    // Each entry should have value > 90 and logical != physical (unless by coincidence)
    for (const row of mapping) {
      expect(row.value).toBeGreaterThan(90);
    }
    expect(mapping.length).toBeGreaterThan(0);
  });
});

test.describe('Filter Panel UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getFilterEngine: () => unknown } })
        .__witEngine;
      return w && w.getFilterEngine();
    });
  });

  test('openFilterPanel opens a DOM panel and closeFilterPanel closes it', async ({ page }) => {
    // Open the filter panel programmatically
    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(0);
    });

    // Verify the panel DOM element exists
    const panel = page.locator('.wit-filter-panel');
    await expect(panel).toBeVisible();

    // Verify it contains operator dropdown, value input, and buttons
    await expect(panel.locator('select.wit-filter-operator')).toBeVisible();
    await expect(panel.locator('input.wit-filter-value')).toBeVisible();
    await expect(panel.locator('button.wit-filter-apply')).toBeVisible();
    await expect(panel.locator('button.wit-filter-clear')).toBeVisible();

    // Close
    await page.evaluate(() => {
      (window as any).__witEngine.closeFilterPanel();
    });
    await expect(panel).not.toBeVisible();
  });

  test('applying filter via panel hides rows and shows funnel indicator', async ({ page }) => {
    const initial = await page.evaluate(() => {
      return (window as any).__witEngine.getFilteredRowCount();
    });

    // Open filter panel for column 0
    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(0);
    });

    // Select "greaterThan" operator
    const panel = page.locator('.wit-filter-panel');
    await panel.locator('select.wit-filter-operator').selectOption('greaterThan');

    // Type a value (filter to rows > 50)
    await panel.locator('input.wit-filter-value').fill('50');

    // Click Apply
    await panel.locator('button.wit-filter-apply').click();

    // Panel should close
    await expect(panel).not.toBeVisible();

    // Row count should decrease
    const filtered = await page.evaluate(() => {
      return (window as any).__witEngine.getFilteredRowCount();
    });
    expect(filtered).toBeLessThan(initial);
    expect(filtered).toBeGreaterThan(0);

    // Filter indicator should be active for col 0
    const hasIndicator = await page.evaluate(() => {
      const fe = (window as any).__witEngine.getFilterEngine();
      return fe.getFilteredColumns().has(0);
    });
    expect(hasIndicator).toBe(true);
  });

  test('clear button removes filter and restores all rows', async ({ page }) => {
    // First apply a filter
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setColumnFilter(0, [{ col: 0, operator: 'greaterThan', value: 50 }]);
    });

    const filtered = await page.evaluate(() => {
      return (window as any).__witEngine.getFilteredRowCount();
    });

    // Open panel and click Clear
    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(0);
    });

    const panel = page.locator('.wit-filter-panel');
    await panel.locator('button.wit-filter-clear').click();

    // Panel should close
    await expect(panel).not.toBeVisible();

    // All rows restored
    const after = await page.evaluate(() => {
      return (window as any).__witEngine.getFilteredRowCount();
    });
    expect(after).toBeGreaterThan(filtered);
  });

  test('Escape key closes filter panel', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(1);
    });

    const panel = page.locator('.wit-filter-panel');
    await expect(panel).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
  });

  test('right-click on header opens filter panel', async ({ page }) => {
    // Get header position (first column header area)
    const headerPos = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const container = document.querySelector('.witqq-spreadsheet-container') || document.querySelector('[class*="container"]');
      if (!container) return null;
      // The scroll container holds the canvases — right-click needs to hit the scroll area
      const scrollEl = container.querySelector('[style*="overflow"]') as HTMLElement;
      if (!scrollEl) return null;
      const rect = scrollEl.getBoundingClientRect();
      // Click in the header area of column 1 (offset past row numbers)
      return { x: rect.left + 120, y: rect.top + 10 };
    });

    if (headerPos) {
      await page.mouse.click(headerPos.x, headerPos.y, { button: 'right' });

      const panel = page.locator('.wit-filter-panel');
      await expect(panel).toBeVisible({ timeout: 2000 });

      // Close it
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible();
    }
  });

  test('panel pre-fills operator and value for existing filter', async ({ page }) => {
    // Apply a filter first
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setColumnFilter(2, [{ col: 2, operator: 'contains', value: 'test' }]);
    });

    // Open filter panel for the same column
    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(2);
    });

    const panel = page.locator('.wit-filter-panel');
    await expect(panel).toBeVisible();

    // Verify pre-filled values
    const operator = await panel.locator('select.wit-filter-operator').inputValue();
    expect(operator).toBe('contains');

    const value = await panel.locator('input.wit-filter-value').inputValue();
    expect(value).toBe('test');

    await page.keyboard.press('Escape');
  });

  test('isFilterPanelOpen reflects panel state', async ({ page }) => {
    const before = await page.evaluate(() => {
      return (window as any).__witEngine.isFilterPanelOpen;
    });
    expect(before).toBe(false);

    await page.evaluate(() => {
      (window as any).__witEngine.openFilterPanel(0);
    });

    const during = await page.evaluate(() => {
      return (window as any).__witEngine.isFilterPanelOpen;
    });
    expect(during).toBe(true);

    await page.evaluate(() => {
      (window as any).__witEngine.closeFilterPanel();
    });

    const after = await page.evaluate(() => {
      return (window as any).__witEngine.isFilterPanelOpen;
    });
    expect(after).toBe(false);
  });
});
