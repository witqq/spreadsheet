import { test, expect, type Page } from '@playwright/test';

/**
 * Per-cell style rendering E2E tests.
 *
 * Uses LayoutEngine to dynamically compute cell positions (auto row height aware).
 * Tests on row 2 to avoid selection overlay on row 0.
 */
const TEST_ROW = 2;
const TEST_COL = 1; // firstName column

const waitForRender = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      ),
  );

/** Returns { x, y, w, h } canvas pixel rect for cell (row, col) */
async function getCellRect(page: Page, row: number, col: number) {
  return page.evaluate(
    ({ r, c }: { r: number; c: number }) => {
      const engine = (window as any).__witEngine;
      const layout = engine.getLayoutEngine();
      const gr = (engine as any).gridRenderer;
      const geo = gr.geometry;
      const rnWidth = geo.rowNumberWidth as number;
      const headerH = geo.headerHeight as number;
      const scrollEl = (engine as any).scrollContainer ||
        (() => {
          const divs = document.querySelectorAll('div');
          for (const d of divs) {
            const cs = getComputedStyle(d);
            if ((cs.overflow === 'auto' || cs.overflowY === 'auto') && d.scrollWidth > 2000) return d;
          }
          return null;
        })();
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const scrollLeft = scrollEl?.scrollLeft ?? 0;

      const colX = layout.getColumnX(c);
      const colW = layout.getColumnWidth(c);
      const rowY = layout.getRowY(r);
      const rowH = layout.getRowHeight(r);

      return {
        x: Math.floor(rnWidth + colX - scrollLeft),
        y: Math.floor(headerH + rowY - scrollTop),
        w: Math.floor(colW),
        h: Math.floor(rowH),
      };
    },
    { r: row, c: col },
  );
}

async function setupEngine(page: Page) {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();
  await page.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 15000 });
  await waitForRender(page);

  // Scroll to top-left
  await page.evaluate(() => {
    const divs = document.querySelectorAll('div');
    for (const d of divs) {
      const cs = getComputedStyle(d);
      if ((cs.overflow === 'auto' || cs.overflowY === 'auto') && d.scrollWidth > 2000) {
        d.scrollTop = 0;
        d.scrollLeft = 0;
        break;
      }
    }
  });
  await page.waitForTimeout(300);
  await waitForRender(page);
}

function countPixels(
  page: Page,
  region: { x: number; y: number; w: number; h: number },
  predicate: string,
) {
  return page.locator('canvas').first().evaluate(
    (el: HTMLCanvasElement, { region: reg, pred }: { region: typeof region; pred: string }) => {
      const ctx = el.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(reg.x, reg.y, reg.w, reg.h).data;
      const fn = new Function('r', 'g', 'b', 'a', `return ${pred};`);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (fn(data[i], data[i + 1], data[i + 2], data[i + 3])) count++;
      }
      return count;
    },
    { region, pred: predicate },
  );
}

test.describe('per-cell style rendering', () => {
  test('bgColor renders colored background', async ({ page }) => {
    await setupEngine(page);

    await page.evaluate((row: number) => {
      const engine = (window as any).__witEngine;
      const store = engine.getCellStore();
      const existing = store.get(row, 1);
      store.set(row, 1, {
        ...existing,
        value: existing?.value ?? 'Test',
        style: { ref: 'test-bg', style: { bgColor: '#ff0000' } },
      });
      engine.render();
    }, TEST_ROW);
    await waitForRender(page);

    const rect = await getCellRect(page, TEST_ROW, TEST_COL);
    // Sample inner area (shrink by 2px each side to avoid borders)
    const inner = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 };
    const redPixels = await countPixels(page, inner, 'r > 200 && g < 80 && b < 80 && a > 200');

    expect(redPixels).toBeGreaterThan(50);
  });

  test('textColor renders colored text', async ({ page }) => {
    await setupEngine(page);

    await page.evaluate((row: number) => {
      const engine = (window as any).__witEngine;
      const store = engine.getCellStore();
      const existing = store.get(row, 1);
      store.set(row, 1, {
        ...existing,
        value: existing?.value ?? 'TestText',
        style: { ref: 'test-tc', style: { textColor: '#ff0000' } },
      });
      engine.render();
    }, TEST_ROW);
    await waitForRender(page);

    const rect = await getCellRect(page, TEST_ROW, TEST_COL);
    const redTextPixels = await countPixels(
      page, rect, 'r > 100 && r > g + 30 && r > b + 30 && a > 0',
    );

    expect(redTextPixels).toBeGreaterThan(0);
  });

  test('font override changes text rendering', async ({ page }) => {
    await setupEngine(page);

    const rect = await getCellRect(page, TEST_ROW, TEST_COL);
    const darkPredicate = 'r < 150 && g < 150 && b < 150 && a > 0';
    const pixelsBefore = await countPixels(page, rect, darkPredicate);

    await page.evaluate((row: number) => {
      const engine = (window as any).__witEngine;
      const store = engine.getCellStore();
      const existing = store.get(row, 1);
      store.set(row, 1, {
        ...existing,
        value: existing?.value ?? 'BigText',
        style: { ref: 'test-font', style: { fontSize: 22, fontWeight: 'bold' } },
      });
      engine.render();
    }, TEST_ROW);
    await waitForRender(page);

    const pixelsAfter = await countPixels(page, rect, darkPredicate);
    expect(pixelsAfter).toBeGreaterThan(pixelsBefore);
  });

  test('conditional format textColor renders', async ({ page }) => {
    await setupEngine(page);

    const CF_COL = 4; // Age column (numeric, values 22-61)

    const pluginFound = await page.evaluate((cfCol: number) => {
      const engine = (window as any).__witEngine;
      const names = engine.getPluginNames?.() ?? [];
      const cfName = names.find((n: string) => n.toLowerCase().includes('conditional'));
      if (!cfName) return false;
      const cfPlugin = engine.getPlugin(cfName);
      if (!cfPlugin?.addRule) return false;
      cfPlugin.addRule({
        id: 'e2e-cf-textColor-test',
        range: { startRow: 0, endRow: 100, startCol: cfCol, endCol: cfCol },
        condition: { type: 'value', operator: 'greaterThanOrEqual', value: 0 },
        style: { textColor: '#00cc00' },
        priority: 100,
        stopIfTrue: false,
      });
      engine.render();
      return true;
    }, CF_COL);

    if (!pluginFound) {
      test.skip();
      return;
    }

    await waitForRender(page);

    const rect = await getCellRect(page, TEST_ROW, CF_COL);
    const greenPixels = await countPixels(
      page, rect, 'g > 100 && g > r + 30 && g > b + 30 && a > 0',
    );

    expect(greenPixels).toBeGreaterThan(0);
  });
});
