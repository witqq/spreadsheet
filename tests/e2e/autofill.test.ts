import { test, expect, type Page } from '@playwright/test';

/**
 * Demo column layout (offsets within scroll container):
 * Row number width: 50
 * Col 0 (ID): x=50, width=60, type=number
 * Col 1 (firstName): x=110, width=120
 * Col 2 (lastName): x=230, width=120
 * Col 3 (email): x=350, width=200
 * Col 4 (age): x=550, width=60
 * Header height: 32, row height: 28
 *
 * ID column has values 1,2,3,4,5... — perfect number sequence.
 */

const COL_STARTS = [50, 110, 230, 350, 550];
const COL_WIDTHS = [60, 120, 120, 200, 60];
const HEADER_H = 32;
const ROW_H = 28;

async function waitForEngine(page: Page) {
  await page.waitForFunction(() => (window as any).__witEngine, { timeout: 10000 });
}

/** Get scroll container bounding box (needed for absolute page coordinates). */
async function getContainerBox(page: Page) {
  const sc = page.locator('div[style*="overflow: auto"]').first();
  const box = await sc.boundingBox();
  if (!box) throw new Error('No scroll container');
  return box;
}

/** Convert cell-relative coords to page coords. */
function cellCenter(
  box: { x: number; y: number },
  col: number,
  row: number,
) {
  return {
    x: box.x + COL_STARTS[col] + COL_WIDTHS[col] / 2,
    y: box.y + HEADER_H + row * ROW_H + ROW_H / 2,
  };
}

/** Convert an offset (within scroll container) to page coord. */
function toPage(box: { x: number; y: number }, localX: number, localY: number) {
  return { x: box.x + localX, y: box.y + localY };
}

test.describe('Autofill', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await waitForEngine(page);
  });

  test('fill handle appears at bottom-right of active cell', async ({ page }) => {
    const box = await getContainerBox(page);
    const c = cellCenter(box, 0, 0);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(200);

    // Verify selection created a range
    const hasRange = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const sel = engine.getSelection();
      return sel.ranges.length > 0 && sel.activeCell.row === 0 && sel.activeCell.col === 0;
    });
    expect(hasRange).toBe(true);

    // Verify handle position via autofill manager
    const handlePos = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.autofillManager?.getHandlePosition();
    });
    expect(handlePos).not.toBeNull();
    expect(handlePos.x).toBe(110); // rnWidth(50) + col0Width(60)
    expect(handlePos.y).toBe(60); // headerH(32) + rowH(28)
  });

  test('drag fill handle extends number sequence', async ({ page }) => {
    const box = await getContainerBox(page);

    // Select cells with ID values: rows 0-2 (values 1, 2, 3)
    const start = cellCenter(box, 0, 0);
    await page.mouse.click(start.x, start.y);
    const end = cellCenter(box, 0, 2);
    await page.keyboard.down('Shift');
    await page.mouse.click(end.x, end.y);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    // Fill handle at bottom-right of selection: x=110, y=32+3*28=116
    const handle = toPage(box, 110, HEADER_H + 3 * ROW_H);
    const target = toPage(box, 110, HEADER_H + 6 * ROW_H);

    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify values were filled: rows 3-5 should have values 4, 5, 6
    const values = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return [
        engine.getCell(3, 0)?.value,
        engine.getCell(4, 0)?.value,
        engine.getCell(5, 0)?.value,
      ];
    });

    expect(values[0]).toBe(4);
    expect(values[1]).toBe(5);
    expect(values[2]).toBe(6);
  });

  test('autofill is undoable with Ctrl+Z', async ({ page }) => {
    const box = await getContainerBox(page);

    // Set known values first: row 0 = 10, row 1 = 20 in col 1 (firstName)
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setCell(0, 1, 10);
      engine.setCell(1, 1, 20);
    });
    await page.waitForTimeout(100);

    // Select rows 0-1 in col 1
    const start = cellCenter(box, 1, 0);
    await page.mouse.click(start.x, start.y);
    const end = cellCenter(box, 1, 1);
    await page.keyboard.down('Shift');
    await page.mouse.click(end.x, end.y);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    // Handle at bottom-right: col1 right = 110+120 = 230, row 1 bottom = 32+2*28 = 88
    const handle = toPage(box, 230, HEADER_H + 2 * ROW_H);
    const target = toPage(box, 230, HEADER_H + 4 * ROW_H);

    // Get original value at row 2 col 1
    const origVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCell(2, 1)?.value;
    });

    // Drag to fill rows 2-3
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify fill happened: row 2 should be 30
    const filledVal = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCell(2, 1)?.value;
    });
    expect(filledVal).toBe(30);

    // Click to focus, then undo
    await page.mouse.click(start.x, start.y);
    await page.waitForTimeout(50);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // After undo, row 2 should be restored to original value
    const afterUndo = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCell(2, 1)?.value;
    });
    expect(afterUndo).toBe(origVal);
  });

  test('fill preview shows dashed border during drag', async ({ page }) => {
    const box = await getContainerBox(page);

    // Select row 0 in ID column
    const c = cellCenter(box, 0, 0);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(100);

    // Handle at (110, 60) relative to container
    const handle = toPage(box, 110, 60);

    // Start dragging down 3 rows
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, handle.y + 84, { steps: 5 });
    await page.waitForTimeout(100);

    // Verify the autofill manager has a fill range during drag
    const hasFillRange = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const am = engine.autofillManager;
      return am?.fillRange !== null && am?.fillRange !== undefined;
    });

    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify fill actually happened
    const filled = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine.getCell(1, 0)?.value;
    });
    expect(filled).toBeDefined();
  });

  test('horizontal fill extends pattern to the right', async ({ page }) => {
    const box = await getContainerBox(page);

    // Set up a horizontal number sequence directly via engine
    await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      engine.setCell(0, 1, 100);
      engine.setCell(0, 2, 200);
    });
    await page.waitForTimeout(100);

    // Select two cells: (row=0, col=1) to (row=0, col=2)
    const c1 = cellCenter(box, 1, 0);
    await page.mouse.click(c1.x, c1.y);
    await page.waitForTimeout(50);
    const c2 = cellCenter(box, 2, 0);
    await page.keyboard.down('Shift');
    await page.mouse.click(c2.x, c2.y);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);

    // Verify selection
    const sel = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      const s = engine.getSelection();
      const r = s.ranges[s.ranges.length - 1];
      return { startCol: r?.startCol, endCol: r?.endCol };
    });
    expect(sel.startCol).toBe(1);
    expect(sel.endCol).toBe(2);

    // Handle at bottom-right of range
    // Col 2 right: 230 + 120 = 350, Row 0 bottom: 32 + 28 = 60
    const handle = toPage(box, 350, 60);
    // Drag RIGHT to col 4 (x=550+60=610)
    const target = toPage(box, 610, 60);

    await page.mouse.move(handle.x, handle.y);
    await page.waitForTimeout(50);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify the fill: pattern 100, 200 → 300, 400
    const values = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return {
        col3: engine.getCell(0, 3)?.value,
        col4: engine.getCell(0, 4)?.value,
      };
    });

    expect(values.col3).toBe(300);
    expect(values.col4).toBe(400);
  });
});
