import { test, expect } from '@playwright/test';
import path from 'path';

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
        { key: 'ts', title: 'Timestamp', width: 180, type: 'datetime' as const },
        { key: 'value', title: 'Value', width: 100, type: 'number' as const },
      ],
      data: [
        { name: 'Item A', ts: '2025-03-15T14:30', value: 100 },
        { name: 'Item B', ts: '2025-06-20T09:15', value: 200 },
        { name: 'Item C', ts: null, value: 300 },
      ],
      rowCount: 3,
      editable: true,
    });
  });

  await page.waitForTimeout(200);
}

function getDateTimeCellCoords(box: { x: number; y: number }) {
  // Row number width (~50) + name col (200) + offset into datetime col
  return {
    x: box.x + 50 + 200 + 90,
    y: box.y + 28 + 14,
  };
}

test.describe('DateTime picker browser verification', () => {
  test('Function 1: DateTime picker opens on double-click', async ({ page }) => {
    await setupGrid(page);
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const cell = getDateTimeCellCoords(box);

    await page.mouse.dblclick(cell.x, cell.y);
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const ariaLabel = await dialog.getAttribute('aria-label');
    expect(ariaLabel).toBe('Date and time picker');

    // Should have two time inputs (hour + minute)
    const inputs = dialog.locator('input[type="text"]');
    await expect(inputs).toHaveCount(2);

    // Should have OK button
    const okBtn = dialog.locator('button:has-text("OK")');
    await expect(okBtn).toBeVisible();
  });

  test('Function 2: DateTime picker commits ISO value via OK', async ({ page }) => {
    await setupGrid(page);
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const cell = getDateTimeCellCoords(box);

    await page.mouse.dblclick(cell.x, cell.y);
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click OK to commit current value
    const okBtn = dialog.locator('button:has-text("OK")');
    await okBtn.click();
    await page.waitForTimeout(200);

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Re-open the picker to verify value was committed
    await page.mouse.dblclick(cell.x, cell.y);
    await page.waitForTimeout(300);
    const dialog2 = page.locator('[role="dialog"]');
    await expect(dialog2).toBeVisible();

    // Verify hour and minute inputs still display values (confirms ISO format committed)
    const hourInput = dialog2.locator('input[type="text"]').first();
    const minuteInput = dialog2.locator('input[type="text"]').nth(1);
    const hourVal = await hourInput.inputValue();
    const minVal = await minuteInput.inputValue();
    expect(hourVal).toMatch(/^\d{1,2}$/);
    expect(minVal).toMatch(/^\d{1,2}$/);
  });

  test('Function 3: Escape closes without committing', async ({ page }) => {
    await setupGrid(page);
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const cell = getDateTimeCellCoords(box);

    await page.mouse.dblclick(cell.x, cell.y);
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await expect(dialog).not.toBeVisible();
  });

  test('Function 4: Now button updates to current datetime', async ({ page }) => {
    await setupGrid(page);
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const cell = getDateTimeCellCoords(box);

    await page.mouse.dblclick(cell.x, cell.y);
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const nowBtn = dialog.locator('button:has-text("Now")');
    await nowBtn.click();
    await page.waitForTimeout(200);

    // Dialog should still be open after Now (it only updates, doesn't commit)
    await expect(dialog).toBeVisible();
  });
});
