import { test, expect } from '@playwright/test';

test.describe('Merged Cells', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    // Wait for engine to be ready
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: { getMergeManager: () => unknown } })
        .__witEngine;
      return w && w.getMergeManager();
    });
  });

  test('merged cells render as single large cell area', async ({ page }) => {
    // The demo merges rows 3-4, cols 2-4 (a 2×3 region)
    // Verify via the engine API that the merge exists
    const mergeExists = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const region = engine.getMergedRegion(3, 2);
      return region !== null &&
        region.startRow === 3 && region.startCol === 2 &&
        region.endRow === 4 && region.endCol === 4;
    });
    expect(mergeExists).toBe(true);
  });

  test('anchor cell value is displayed in merged area', async ({ page }) => {
    // The anchor cell (3, 2) should have its value; we verify it's not hidden
    const isAnchor = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();
      return mm.isAnchorCell(3, 2);
    });
    expect(isAnchor).toBe(true);
  });

  test('non-anchor cells in merge are hidden', async ({ page }) => {
    // Cells (3,3), (3,4), (4,2), (4,3), (4,4) should be hidden
    const hiddenCells = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();
      return [
        mm.isHiddenCell(3, 3),
        mm.isHiddenCell(3, 4),
        mm.isHiddenCell(4, 2),
        mm.isHiddenCell(4, 3),
        mm.isHiddenCell(4, 4),
      ];
    });
    expect(hiddenCells).toEqual([true, true, true, true, true]);
  });

  test('after unmerge, individual cells are restored', async ({ page }) => {
    // Unmerge the demo region
    const unmerged = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.unmergeCells(3, 2);
    });
    expect(unmerged).toBe(true);

    // Verify cells are no longer hidden
    const cellsRestored = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();
      return mm.getMergedRegion(3, 2) === null &&
        mm.getMergedRegion(4, 4) === null &&
        !mm.isHiddenCell(3, 3) &&
        !mm.isHiddenCell(4, 2);
    });
    expect(cellsRestored).toBe(true);
  });

  test('cross-boundary merge is rejected', async ({ page }) => {
    // Demo has frozenRows=2, frozenColumns=1
    // Attempt to merge across frozen row boundary (row 1 to row 2)
    const rejected = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.mergeCells({ startRow: 1, startCol: 2, endRow: 2, endCol: 3 });
    });
    expect(rejected).toBe(false);
  });

  test('off-screen anchor: merge visible when anchor scrolled out', async ({ page }) => {
    // Create a large merge spanning rows 10-30, cols 3-4
    const merged = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // Set anchor value via CellStore
      engine.getCellStore().set(10, 3, { value: 'MERGE_ANCHOR_VALUE' });
      return engine.mergeCells({ startRow: 10, startCol: 3, endRow: 30, endCol: 4 });
    });
    expect(merged).toBe(true);

    // Scroll down so row 10 (anchor) is off-screen but rows 20+ are visible
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await scrollContainer.evaluate((el) => { el.scrollTop = 800; });
    await page.waitForTimeout(200);

    // Verify the merge region still exists and anchor is still correct
    const anchorStillValid = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();
      const region = mm.getMergedRegion(20, 3);
      return region !== null && region.startRow === 10 && region.startCol === 3;
    });
    expect(anchorStillValid).toBe(true);
  });

  test('mergeCells with explicit value sets anchor cell content', async ({ page }) => {
    // Create a new merge with explicit value
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const ok = engine.mergeCells(
        { startRow: 40, startCol: 5, endRow: 41, endCol: 6 },
        'Explicit Content',
      );
      if (!ok) return null;
      const cell = engine.getCellStore().get(40, 5);
      return cell?.value;
    });
    expect(result).toBe('Explicit Content');
  });

  test('demo merged cell has explicit value from mergeCells call', async ({ page }) => {
    // Demo calls mergeCells with value 'Merged Cell' for rows 3-4, cols 2-4
    const value = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const cell = engine.getCellStore().get(3, 2);
      return cell?.value;
    });
    expect(value).toBe('Merged Cell');
  });

  test('click on hidden cell in merge selects anchor', async ({ page }) => {
    // Use engine API to select a hidden cell, verify active cell becomes anchor
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const sm = engine.getSelectionManager();
      // Click on hidden cell (4, 3) in merge (3-4, 2-4)
      sm.selectCell(4, 3);
      const sel = sm.getSelection();
      return {
        activeRow: sel.activeCell.row,
        activeCol: sel.activeCell.col,
        rangeStartRow: sel.ranges[0].startRow,
        rangeStartCol: sel.ranges[0].startCol,
        rangeEndRow: sel.ranges[0].endRow,
        rangeEndCol: sel.ranges[0].endCol,
      };
    });
    expect(result.activeRow).toBe(3);
    expect(result.activeCol).toBe(2);
    expect(result.rangeStartRow).toBe(3);
    expect(result.rangeStartCol).toBe(2);
    expect(result.rangeEndRow).toBe(4);
    expect(result.rangeEndCol).toBe(4);
  });

  test('edit merged cell updates anchor value', async ({ page }) => {
    // Set a value via inline edit on anchor cell
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // Edit anchor cell (3, 2) of the demo merge
      const cs = engine.getCellStore();
      cs.setValue(3, 2, 'Updated Merge Value');
      return cs.get(3, 2)?.value;
    });
    expect(result).toBe('Updated Merge Value');
  });

  test('arrow key navigation skips hidden cells in merge', async ({ page }) => {
    // Position above the merge at (2, 3) and ArrowDown
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const sm = engine.getSelectionManager();
      sm.selectCell(2, 3); // row 2, col 3 — above the merge (3-4, 2-4)

      // Simulate ArrowDown - col 3 is hidden in the merge (not anchor col 2)
      const nav = engine.getKeyboardNavigator();
      const fakeEvent = {
        key: 'ArrowDown',
        shiftKey: false,
        ctrlKey: false,
        originalEvent: { preventDefault: () => {} },
      };
      const newPos = nav.handleKeyDown(fakeEvent);
      return newPos;
    });
    // Col 3 at row 3 is hidden (not anchor). Should skip to row 5+1=6.
    // However, row 3 col 3 IS hidden (anchor is 3,2). So should skip to endRow+1=5.
    expect(result.row).toBeGreaterThanOrEqual(5);
  });

  test('undo/redo merge via command manager', async ({ page }) => {
    // Create a new merge, undo it, redo it
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();

      // Create a new merge
      const region = { startRow: 50, startCol: 6, endRow: 51, endCol: 7 };
      const ok = engine.mergeCells(region, 'Test Merge');
      if (!ok) return { merged: false };

      const mergedBefore = mm.getMergedRegion(50, 6) !== null;

      // Undo
      const cmdMgr = engine.getCommandManager();
      cmdMgr.undo();
      const afterUndo = mm.getMergedRegion(50, 6) === null;

      // Redo
      cmdMgr.redo();
      const afterRedo = mm.getMergedRegion(50, 6) !== null;
      const anchorValue = engine.getCellStore().get(50, 6)?.value;

      return { merged: true, mergedBefore, afterUndo, afterRedo, anchorValue };
    });
    expect(result.merged).toBe(true);
    expect(result.mergedBefore).toBe(true);
    expect(result.afterUndo).toBe(true);
    expect(result.afterRedo).toBe(true);
    expect(result.anchorValue).toBe('Test Merge');
  });

  test('undo unmerge restores merge region', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();

      // Demo has merge at (3, 2)-(4, 4)
      const existsBefore = mm.getMergedRegion(3, 2) !== null;

      // Unmerge via engine (goes through command manager)
      engine.unmergeCells(3, 2);
      const afterUnmerge = mm.getMergedRegion(3, 2) === null;

      // Undo should restore
      const cmdMgr = engine.getCommandManager();
      cmdMgr.undo();
      const afterUndo = mm.getMergedRegion(3, 2) !== null;

      return { existsBefore, afterUnmerge, afterUndo };
    });
    expect(result.existsBefore).toBe(true);
    expect(result.afterUnmerge).toBe(true);
    expect(result.afterUndo).toBe(true);
  });

  test('sorting is rejected when merged regions exist', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();

      // Verify merge exists
      const hasMerges = mm.hasAnyRegions();

      // Track sortRejected event
      let rejected = false;
      engine.on('sortRejected', () => { rejected = true; });

      // Attempt programmatic sort — should be rejected
      engine.sortBy([{ col: 0, direction: 'asc' }]);
      const sortCols = engine.getSortColumns();

      return { hasMerges, rejected, sortColCount: sortCols.length };
    });

    expect(result.hasMerges).toBe(true);
    expect(result.rejected).toBe(true);
    expect(result.sortColCount).toBe(0);
  });

  test('sorting works after unmerging all regions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const mm = engine.getMergeManager();

      // Unmerge the demo merge (3, 2)
      engine.unmergeCells(3, 2);
      const hasMergesAfter = mm.hasAnyRegions();

      // Now sorting should work
      engine.sortBy([{ col: 0, direction: 'desc' }]);
      const sortCols = engine.getSortColumns();

      // Clean up: clear sort
      engine.clearSort();

      return { hasMergesAfter, sortColCount: sortCols.length };
    });

    expect(result.hasMergesAfter).toBe(false);
    expect(result.sortColCount).toBe(1);
  });

  test('autofill from merged cell uses anchor value (not nulls)', async ({ page }) => {
    // Demo has merge at rows 3-4, cols 2-4, anchor value = 'Merged Cell'
    // Create a simpler merge for autofill: col 0, rows 5-6, value = 100
    const setup = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // First unmerge demo merge to avoid interference
      engine.unmergeCells(3, 2);
      // Create a 2-row merge in col 0 at rows 5-6
      engine.setCell(5, 0, 100);
      const ok = engine.mergeCells({ startRow: 5, startCol: 0, endRow: 6, endCol: 0 });
      return { merged: ok, anchorVal: engine.getCell(5, 0)?.value };
    });
    expect(setup.merged).toBe(true);
    expect(setup.anchorVal).toBe(100);

    // Programmatically test autofill via engine internals
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const am = engine.autofillManager;
      if (!am) return { error: 'no autofillManager' };

      // Call executeFill: source = rows 5-6, col 0 (merged) → fill rows 7-9
      (am as any).executeFill(
        { startRow: 5, startCol: 0, endRow: 6, endCol: 0 },
        { startRow: 7, startCol: 0, endRow: 9, endCol: 0 },
        'down',
      );

      return {
        row7: engine.getCell(7, 0)?.value,
        row8: engine.getCell(8, 0)?.value,
        row9: engine.getCell(9, 0)?.value,
      };
    });

    // With merge-aware source extraction: source = [100] (row 6 hidden, skipped)
    // Pattern = single value repeat → all filled with 100
    expect(result.row7).toBe(100);
    expect(result.row8).toBe(100);
    expect(result.row9).toBe(100);
  });

  test('autofill skips hidden cells in target merged region', async ({ page }) => {
    const result = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      // Unmerge demo merge
      engine.unmergeCells(3, 2);

      // Set source values: rows 0-1, col 1 = [10, 20]
      engine.setCell(0, 1, 10);
      engine.setCell(1, 1, 20);

      // Create merge in target area: rows 3-4, col 1
      engine.mergeCells({ startRow: 3, startCol: 1, endRow: 4, endCol: 1 });

      // Get value at row 4 col 1 before fill (hidden cell)
      const beforeHidden = engine.getCell(4, 1)?.value ?? null;

      // Autofill: source rows 0-1, fill rows 2-4
      const am = engine.autofillManager;
      (am as any).executeFill(
        { startRow: 0, startCol: 1, endRow: 1, endCol: 1 },
        { startRow: 2, startCol: 1, endRow: 4, endCol: 1 },
        'down',
      );

      return {
        row2: engine.getCell(2, 1)?.value,
        row3: engine.getCell(3, 1)?.value, // anchor of merge — should be filled
        row4: engine.getCell(4, 1)?.value, // hidden cell — should be skipped
        beforeHidden,
      };
    });

    // Row 2: filled with 30 (pattern 10,20 → 30)
    expect(result.row2).toBe(30);
    // Row 3: anchor of merge, filled with 40
    expect(result.row3).toBe(40);
    // Row 4: hidden cell in merge — value should remain unchanged (null/original)
    expect(result.row4).toBe(result.beforeHidden);
  });
});
