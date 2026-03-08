import { test } from '@playwright/test';
import path from 'path';

const WIDGET_BUNDLE = path.resolve(
  __dirname,
  '../../packages/widget/dist/witqq-spreadsheet-widget.umd.cjs',
);

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../moira-ws/planeta-migration-gaps-20260306-0231/step-7/iteration-1/screenshots',
);

async function setupGrid(page: import('@playwright/test').Page) {
  await page.setContent(`
    <html>
      <head>
        <style>
          body { margin: 0; background: #fff; }
          #grid { width: 700px; height: 400px; margin: 12px; }
        </style>
      </head>
      <body>
        <div id="grid"></div>
      </body>
    </html>
  `);
  await page.addScriptTag({ path: WIDGET_BUNDLE });
  await page.evaluate(() => {
    const S = (window as unknown as { Spreadsheet: { create: Function } }).Spreadsheet;
    S.create('#grid', {
      columns: [
        { key: 'name', title: 'Name', width: 200 },
        { key: 'date', title: 'Date', width: 150, type: 'date' as const },
        { key: 'value', title: 'Value', width: 100, type: 'number' as const },
      ],
      data: [
        { name: 'Item A', date: '2025-03-15', value: 100 },
        { name: 'Item B', date: '2025-06-20', value: 200 },
        { name: 'Item C', date: null, value: 300 },
      ],
      rowCount: 3,
      editable: true,
    });
  });
  await page.waitForTimeout(200);
}

test.describe('Date picker screenshots', () => {
  test('capture all date picker states', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();
    const dateX = box!.x + 50 + 200 + 75;
    const dateY = box!.y + 28 + 14;

    // 1. Grid before interaction
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-grid-initial.png') });

    // 2. Date picker open
    await page.mouse.dblclick(dateX, dateY);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-picker-open.png') });

    // 3. Close and reopen on empty date cell (row 3)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const emptyDateY = box!.y + 28 + 28 * 2 + 14;
    await page.mouse.dblclick(dateX, emptyDateY);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-picker-empty-cell.png') });

    // 4. Navigate to next month
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.mouse.dblclick(dateX, dateY);
    await page.waitForTimeout(200);
    const nextBtn = page.locator('[role="dialog"] button:has-text("▶")');
    await nextBtn.click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-picker-next-month.png') });

    // 5. Select a date (click day 10)
    const day10 = page.locator('[role="dialog"] [data-day="10"]');
    await day10.click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-after-selection.png') });

    // 6. Non-date cell editing (textarea)
    const nameX = box!.x + 50 + 100;
    const nameY = box!.y + 28 + 14;
    await page.mouse.dblclick(nameX, nameY);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-text-editor.png') });
  });
});
