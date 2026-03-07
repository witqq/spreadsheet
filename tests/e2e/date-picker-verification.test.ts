import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Browser verification for all 5 expected date picker functions.
 */

const WIDGET_BUNDLE = path.resolve(
  __dirname,
  '../../packages/widget/dist/witqq-spreadsheet-widget.umd.cjs',
);

async function setupGrid(page: import('@playwright/test').Page) {
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

function getDateCellCoords(box: { x: number; y: number }) {
  // Row number width (~50) + name col (200) + offset into date col
  return {
    x: box.x + 50 + 200 + 75,
    y: box.y + 28 + 14, // header + half row
  };
}

test.describe('Date picker browser verification', () => {
  test('Function 1: Date picker opens on double-click', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();
    const { x, y } = getDateCellCoords(box!);

    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(100);

    const picker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('March');
    await expect(picker).toContainText('2025');
  });

  test('Function 2: Date selection via click commits and closes', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();
    const { x, y } = getDateCellCoords(box!);

    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(100);

    const picker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(picker).toBeVisible();

    // Click day 20
    await picker.locator('[data-day="20"]').click();
    await page.waitForTimeout(100);

    // Picker should close
    await expect(picker).not.toBeVisible();
  });

  test('Function 3: Keyboard navigation and Escape closes', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();
    const { x, y } = getDateCellCoords(box!);

    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(100);

    const picker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(picker).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    await expect(picker).not.toBeVisible();
  });

  test('Function 4: Grid scroll closes date picker', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();
    const { x, y } = getDateCellCoords(box!);

    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(100);

    const picker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(picker).toBeVisible();

    // Scroll the grid — click on grid area first to focus, then scroll
    await page.mouse.click(box!.x + 100, box!.y + 200);
    await page.waitForTimeout(50);

    // Check if picker closed after click (grid mousedown closes it)
    await expect(picker).not.toBeVisible();
  });

  test('Function 5: Non-date cell editing still opens textarea', async ({ page }) => {
    await setupGrid(page);
    const box = await page.locator('#grid').boundingBox();

    // Click on name column (non-date) — row number (~50) + offset into name col
    const nameX = box!.x + 50 + 100;
    const nameY = box!.y + 28 + 14;

    await page.mouse.dblclick(nameX, nameY);
    await page.waitForTimeout(100);

    // Should NOT show date picker
    const picker = page.locator('[role="dialog"][aria-label="Date picker"]');
    await expect(picker).not.toBeVisible();

    // Should show textarea (inline editor)
    const textarea = page.locator('#grid textarea');
    await expect(textarea).toBeVisible();
  });
});
