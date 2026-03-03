import { test, expect } from '@playwright/test';

test.describe('Row Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getRowGroupManager: () => unknown } })
        .__witEngine;
      return w && w.getRowGroupManager;
    });
  });

  test('enables row groups via Group Rows button', async ({ page }) => {
    const btn = page.getByTestId('group-toggle');
    await expect(btn).toBeVisible();
    await btn.click();

    // Verify groups are set on engine
    const hasGroups = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getRowGroupManager().hasGroups();
    });
    expect(hasGroups).toBe(true);
  });

  test('clears row groups via Clear Groups button', async ({ page }) => {
    const btn = page.getByTestId('group-toggle');
    await btn.click(); // enable
    await btn.click(); // disable

    const hasGroups = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getRowGroupManager().hasGroups();
    });
    expect(hasGroups).toBe(false);
  });

  test('collapse group hides child rows from DataView', async ({ page }) => {
    // Set up groups programmatically
    const initialCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);
      return engine.getDataView().visibleRowCount;
    });

    // Collapse group at row 0
    const afterCollapse = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.toggleRowGroup(0);
      return engine.getDataView().visibleRowCount;
    });

    // 3 child rows should be hidden
    expect(afterCollapse).toBe(initialCount - 3);
  });

  test('expand group restores child rows', async ({ page }) => {
    const initialCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setRowGroups([{ headerRow: 0, childRows: [1, 2, 3] }]);
      return engine.getDataView().visibleRowCount;
    });

    // Collapse then expand
    const afterReexpand = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.toggleRowGroup(0); // collapse
      engine.toggleRowGroup(0); // expand
      return engine.getDataView().visibleRowCount;
    });

    expect(afterReexpand).toBe(initialCount);
  });

  test('collapse all and expand all', async ({ page }) => {
    const initialCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);
      return engine.getDataView().visibleRowCount;
    });

    // Collapse all
    const afterCollapseAll = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.collapseAllGroups();
      return engine.getDataView().visibleRowCount;
    });
    expect(afterCollapseAll).toBe(initialCount - 5); // 3 + 2 children hidden

    // Expand all
    const afterExpandAll = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.expandAllGroups();
      return engine.getDataView().visibleRowCount;
    });
    expect(afterExpandAll).toBe(initialCount);
  });

  test('aggregate computation works', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;

      // Set specific values
      engine.setCell(1, 5, 100);
      engine.setCell(2, 5, 200);
      engine.setCell(3, 5, 300);

      engine.setRowGroups([{ headerRow: 0, childRows: [1, 2, 3] }]);
      engine.setGroupAggregates([{ col: 5, fn: 'sum' }]);

      const mgr = engine.getRowGroupManager();
      const aggs = mgr.computeAggregates(0);
      return aggs.map((a: { label: string; value: number }) => ({ label: a.label, value: a.value }));
    });

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(600);
    expect(result[0].label).toBe('Sum: 600');
  });

  // ─── Multi-level nesting E2E tests ──────────────────────────

  test('3-level nesting: collapse top-level hides all descendants', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // 3-level: L1(0) → L2(1) → L3(2) → leaves [3,4]
      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 5] },
        { headerRow: 1, childRows: [2, 4] },
        { headerRow: 2, childRows: [3] },
      ]);
      const before = engine.getDataView().visibleRowCount;
      engine.toggleRowGroup(0); // collapse L1
      const after = engine.getDataView().visibleRowCount;
      return { before, after, hidden: before - after };
    });

    // Should hide all 5 descendants (1, 2, 3, 4, 5)
    expect(result.hidden).toBe(5);
  });

  test('3-level nesting: collapse intermediate hides subtree only', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 5] },
        { headerRow: 1, childRows: [2, 4] },
        { headerRow: 2, childRows: [3] },
      ]);
      const before = engine.getDataView().visibleRowCount;
      engine.toggleRowGroup(1); // collapse L2 (row 1)
      const after = engine.getDataView().visibleRowCount;
      return { before, after, hidden: before - after };
    });

    // Should hide 3 descendants of row 1: (2, 3, 4)
    expect(result.hidden).toBe(3);
  });

  test('3-level nesting: cascading aggregates use leaf descendants', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;

      // Set values on leaf rows
      engine.setCell(3, 5, 10);
      engine.setCell(4, 5, 20);
      engine.setCell(5, 5, 30);

      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 5] },
        { headerRow: 1, childRows: [2] },
        { headerRow: 2, childRows: [3, 4] },
      ]);
      engine.setGroupAggregates([{ col: 5, fn: 'sum' }]);

      const mgr = engine.getRowGroupManager();
      return {
        l3: mgr.computeAggregates(2)[0]?.value, // sum of 3,4 = 30
        l2: mgr.computeAggregates(1)[0]?.value, // sum of leaves 3,4 = 30
        l1: mgr.computeAggregates(0)[0]?.value, // sum of leaves 3,4,5 = 60
      };
    });

    expect(result.l3).toBe(30);
    expect(result.l2).toBe(30);
    expect(result.l1).toBe(60);
  });

  test('3-level nesting: depth indentation is correct', async ({ page }) => {
    const depths = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setRowGroups([
        { headerRow: 0, childRows: [1, 5] },
        { headerRow: 1, childRows: [2] },
        { headerRow: 2, childRows: [3, 4] },
      ]);
      const mgr = engine.getRowGroupManager();
      return {
        d0: mgr.getDepth(0),
        d1: mgr.getDepth(1),
        d2: mgr.getDepth(2),
      };
    });

    expect(depths.d0).toBe(0);
    expect(depths.d1).toBe(1);
    expect(depths.d2).toBe(2);
  });
});
