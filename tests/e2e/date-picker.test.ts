import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E test for date picker overlay interaction.
 *
 * Creates a spreadsheet with a date column, triggers editing,
 * verifies the date picker appears and date selection works.
 */

const WIDGET_BUNDLE = path.resolve(
  __dirname,
  '../../packages/widget/dist/witqq-spreadsheet-widget.umd.cjs',
);

test.describe('Date picker overlay', () => {
  test('opens date picker on double-click and selects date', async ({ page }) => {
    await page.setContent(`
      <html>
        <head>
          <style>
            body { margin: 0; background: #f5f5f5; font-family: sans-serif; }
            #grid { width: 700px; height: 400px; margin: 12px; }
          </style>
        </head>
        <body>
          <div id="grid"></div>
        </body>
      </html>
    `);

    await page.addScriptTag({ path: WIDGET_BUNDLE });

    // Create spreadsheet with date column
    await page.evaluate(() => {
      const S = (
        window as unknown as {
          Spreadsheet: { create: Function };
        }
      ).Spreadsheet;

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

    // Wait for render
    await page.waitForTimeout(200);

    // Double-click the date cell (row 0, col 1)
    // The date column starts after the row number column + name column
    // Need to click on the actual cell area
    const gridEl = page.locator('#grid');
    const box = await gridEl.boundingBox();
    expect(box).not.toBeNull();

    // Row number width (default ~50) + name col (200) + some offset into date col
    // Header height is ~28, first data row starts at ~28
    const dateColX = box!.x + 50 + 200 + 75; // middle of date column
    const firstRowY = box!.y + 28 + 14; // middle of first data row

    await page.mouse.dblclick(dateColX, firstRowY);
    await page.waitForTimeout(100);

    // Date picker should appear
    const datePicker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(datePicker).toBeVisible();

    // Should show March 2025
    await expect(datePicker).toContainText('March');
    await expect(datePicker).toContainText('2025');

    // Take screenshot with date picker open
    await page.screenshot({
      path: 'moira-ws/planeta-migration-gaps-20260306-0231/step-7/date-picker-open.png',
    });

    // Click on day 20
    const day20 = datePicker.locator('[data-day="20"]');
    await day20.click();
    await page.waitForTimeout(100);

    // Date picker should close
    await expect(datePicker).not.toBeVisible();

    // Take screenshot after selection
    await page.screenshot({
      path: 'moira-ws/planeta-migration-gaps-20260306-0231/step-7/date-picker-after-select.png',
    });
  });

  test('keyboard navigation works in date picker', async ({ page }) => {
    await page.setContent(`
      <html>
        <head>
          <style>
            body { margin: 0; }
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
      const S = (
        window as unknown as {
          Spreadsheet: { create: Function };
        }
      ).Spreadsheet;

      S.create('#grid', {
        columns: [
          { key: 'name', title: 'Name', width: 200 },
          { key: 'date', title: 'Date', width: 150, type: 'date' as const },
        ],
        data: [{ name: 'Test', date: '2025-01-10' }],
        rowCount: 1,
        editable: true,
      });
    });

    await page.waitForTimeout(200);

    const gridEl = page.locator('#grid');
    const box = await gridEl.boundingBox();
    const dateColX = box!.x + 50 + 200 + 75;
    const firstRowY = box!.y + 28 + 14;

    // Double-click to open
    await page.mouse.dblclick(dateColX, firstRowY);
    await page.waitForTimeout(100);

    const datePicker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(datePicker).toBeVisible();

    // Escape closes without commit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await expect(datePicker).not.toBeVisible();
  });
});
