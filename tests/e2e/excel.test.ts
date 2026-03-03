import { test, expect } from '@playwright/test';

test.describe('Excel Plugin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForSelector('canvas');
  });

  test('excel plugin is installed', async ({ page }) => {
    const hasPlugin = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getPlugin('excel') != null;
    });
    expect(hasPlugin).toBe(true);
  });

  test('import and export buttons are visible', async ({ page }) => {
    const importBtn = page.getByTestId('import-btn');
    const exportBtn = page.getByTestId('export-btn');
    await expect(importBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();
  });

  test('export produces valid xlsx buffer', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const plugin = (window as any).__excelPlugin;
      if (!plugin) return { error: 'no plugin' };
      try {
        // Limit to 1000 rows for browser memory safety
        const buffer = await plugin.exportExcel({ sheetName: 'Test', maxRows: 1000 });
        return { success: true, size: buffer.byteLength };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    expect(result).toHaveProperty('success', true);
    expect((result as any).size).toBeGreaterThan(0);
  });

  test('roundtrip preserves data integrity', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as any).__witEngine;
      const plugin = (window as any).__excelPlugin;
      const cs = engine.getCellStore();

      // Sample some cells before export
      const samplesBefore: Record<string, any> = {};
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = cs.get(r, c);
          if (cell?.value != null) samplesBefore[`${r}:${c}`] = cell.value;
        }
      }

      // Export (limit rows for test speed)
      const buffer = await plugin.exportExcel({ sheetName: 'Roundtrip', maxRows: 100 });

      // Import back
      await plugin.importExcel(buffer);

      // Sample same cells after import
      const samplesAfter: Record<string, any> = {};
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = cs.get(r, c);
          if (cell?.value != null) samplesAfter[`${r}:${c}`] = cell.value;
        }
      }

      // Compare
      let matches = 0;
      let mismatches = 0;
      for (const key of Object.keys(samplesBefore)) {
        if (String(samplesBefore[key]) === String(samplesAfter[key])) {
          matches++;
        } else {
          mismatches++;
        }
      }
      return { matches, mismatches, sampleCount: Object.keys(samplesBefore).length };
    });

    expect(result.sampleCount).toBeGreaterThan(0);
    expect(result.mismatches).toBe(0);
    expect(result.matches).toBe(result.sampleCount);
  });

  test('merged regions survive export/import roundtrip', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as any).__witEngine;
      const plugin = (window as any).__excelPlugin;
      const mm = engine.getMergeManager();

      // Count merges before export
      const mergesBefore = mm.getAllRegions().length;

      // Export (limit rows, but include merge region rows 3-4)
      const buffer = await plugin.exportExcel({ sheetName: 'MergeTest', maxRows: 100 });

      // Import back (clears old merges + imports new)
      await plugin.importExcel(buffer);

      // Count merges after import
      const mergesAfter = mm.getAllRegions().length;

      return { mergesBefore, mergesAfter };
    });

    expect(result.mergesBefore).toBeGreaterThan(0);
    expect(result.mergesAfter).toBe(result.mergesBefore);
  });

  test('excel plugin accessible via window for E2E', async ({ page }) => {
    const hasExcelPlugin = await page.evaluate(() => {
      return (window as any).__excelPlugin != null;
    });
    expect(hasExcelPlugin).toBe(true);
  });
});
