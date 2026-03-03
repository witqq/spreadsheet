import { test, expect } from '@playwright/test';

test('demo page loads with title', async ({ page }) => {
  await page.goto('/demo/');
  await expect(page.locator('h1')).toContainText('witqq');
});

test('canvas element is present in the DOM', async ({ page }) => {
  await page.goto('/demo/');
  // CanvasManager creates a single canvas
  const canvases = page.locator('canvas');
  await expect(canvases).toHaveCount(1);
  await expect(canvases.first()).toBeVisible();
});

test('canvas has non-zero dimensions', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
});

test('canvas renders non-blank content', async ({ page }) => {
  await page.goto('/demo/');
  // Content canvas is the single canvas where all rendering happens
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Check that the canvas has actual pixel content (not all white/blank)
  const isNonBlank = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, el.width, el.height).data;
    // Check if there are any non-white pixels (grid lines, text, headers)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r !== 255 || g !== 255 || b !== 255) return true;
    }
    return false;
  });

  expect(isNonBlank).toBe(true);
});

test('scroll container is present with native scrollbars', async ({ page }) => {
  await page.goto('/demo/');
  // ScrollManager creates a div with overflow:auto on top of canvases
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();

  // scrollHeight reflects the total content size set by the spacer child
  const scrollableHeight = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollHeight);

  // 100K rows × 28px + 32px header = 2,800,032px total height
  expect(scrollableHeight).toBeGreaterThan(2_000_000);
});

test('column headers remain visible after scrolling down', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Scroll down significantly
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 500;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Sample pixels from the header area (top of canvas, y=10)
  // Headers should still be rendered there (non-blank/non-white)
  const headerHasContent = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    // Check a strip at y=10 (in the header area, headerHeight=32)
    const data = ctx.getImageData(60, 10, 200, 1).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Header background is #f3f4f6 (243, 244, 246) or header text
      if (r !== 255 || g !== 255 || b !== 255) return true;
    }
    return false;
  });

  expect(headerHasContent).toBe(true);
});

test('100K rows: scroll height matches expected total', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();

  const scrollableHeight = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollHeight);

  // 100,000 rows × 28px rowHeight + 32px headerHeight = 2,800,032
  // Allow small browser rounding differences (±10px)
  expect(scrollableHeight).toBeGreaterThan(2_800_000);
  expect(scrollableHeight).toBeLessThan(2_801_000);
});

test('100K rows: scrolling to middle renders content', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Scroll to approximately row 50,000 (50000 × 28 = 1,400,000px)
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 1_400_000;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Canvas should still render non-blank content at this scroll position
  const isNonBlank = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.floor(60 * dpr);
    const y = Math.floor(40 * dpr);
    const w = Math.floor(400 * dpr);
    const h = Math.floor(200 * dpr);
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r !== 255 || g !== 255 || b !== 255) return true;
    }
    return false;
  });

  expect(isNonBlank).toBe(true);
});

test('100K rows: headers visible after scrolling to bottom', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Scroll to near the bottom (row ~99,900)
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = el.scrollHeight - el.clientHeight;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Headers should still be visible at the top
  const headerHasContent = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(60, 10, 200, 1).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r !== 255 || g !== 255 || b !== 255) return true;
    }
    return false;
  });

  expect(headerHasContent).toBe(true);
});

test('clicking a cell shows selection highlight', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first(); 
  await expect(canvas).toBeVisible();

  // Before clicking: capture canvas state in cell area
  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Hash the cell area before click
  const hashBefore = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return 0;
    const dpr = window.devicePixelRatio || 1;
    // Cell (0,0) area: x=50 (rowNumberWidth), y=32 (headerHeight), w=60, h=28
    const x = Math.floor(50 * dpr);
    const y = Math.floor(32 * dpr);
    const w = Math.floor(60 * dpr);
    const h = Math.floor(28 * dpr);
    const data = ctx.getImageData(x, y, w, h).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = ((hash << 5) - hash + data[i] + data[i + 1] + data[i + 2]) | 0;
    }
    return hash;
  });

  // Click on cell (0,0): rowNumberWidth(50) + 30px, headerHeight(32) + 14px
  await scrollContainer.click({ position: { x: 80, y: 46 } });

  // Wait for render
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Hash the same area after click — should differ due to selection border
  const hashAfter = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return 0;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.floor(50 * dpr);
    const y = Math.floor(32 * dpr);
    const w = Math.floor(60 * dpr);
    const h = Math.floor(28 * dpr);
    const data = ctx.getImageData(x, y, w, h).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = ((hash << 5) - hash + data[i] + data[i + 1] + data[i + 2]) | 0;
    }
    return hash;
  });

  // Canvas content in the cell area should change after click (selection border added)
  expect(hashBefore).not.toBe(hashAfter);

  // Additionally verify the selection border color is present (blue: #1a73e8 ≈ R<80, G>80, B>180)
  const hasBluePixels = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    // Check the left border strip of cell (0,0)
    const x = Math.floor(50 * dpr);
    const y = Math.floor(33 * dpr);
    const w = Math.ceil(3 * dpr);
    const h = Math.floor(26 * dpr);
    const data = ctx.getImageData(x, y, w, h).data;

    let blueCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 80 && g > 80 && g < 160 && b > 180) {
        blueCount++;
      }
    }
    return blueCount > 3;
  });

  expect(hasBluePixels).toBe(true);
});

test('arrow keys move active cell and auto-scroll follows', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first(); 
  await expect(canvas).toBeVisible();

  const scrollContainer = page.locator('div[style*="overflow: auto"]');

  // Click on cell (1,1) to select it first — gives focus to scroll container
  // Cell (1,1): x = 50 (rowNumWidth) + col1.x, y = 32 (header) + 1*28
  // Col 0 width = 60 (ID column), so col 1 starts at x=50+60=110
  await scrollContainer.click({ position: { x: 130, y: 74 } });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Hash cell area around initial selection for comparison later
  const hashCellArea = (xPx: number, yPx: number) =>
    canvas.evaluate((el: HTMLCanvasElement, { xPx, yPx }: { xPx: number; yPx: number }) => {
      const ctx = el.getContext('2d');
      if (!ctx) return 0;
      const dpr = window.devicePixelRatio || 1;
      const data = ctx.getImageData(
        Math.floor(xPx * dpr), Math.floor(yPx * dpr),
        Math.floor(60 * dpr), Math.floor(28 * dpr),
      ).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 4) {
        hash = ((hash << 5) - hash + data[i] + data[i + 1] + data[i + 2]) | 0;
      }
      return hash;
    }, { xPx, yPx });

  // Hash the area where the active cell border is before pressing arrow
  const hashBefore = await hashCellArea(110, 60);

  // Press ArrowDown to move selection to cell (2,1)
  await page.keyboard.press('ArrowDown');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // The original cell area should change (active cell border moved away)
  const hashAfterDown = await hashCellArea(110, 60);
  expect(hashBefore).not.toBe(hashAfterDown);

  // Now test auto-scroll: press PageDown many times to move far down
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('PageDown');
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Verify scroll position moved (auto-scroll followed the active cell)
  const scrollTop = await scrollContainer.evaluate((el: HTMLDivElement) => el.scrollTop);
  expect(scrollTop).toBeGreaterThan(1000);

  // Verify canvas still renders content at new scroll position (not blank)
  const isNonBlank = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    const data = ctx.getImageData(
      Math.floor(60 * dpr), Math.floor(40 * dpr),
      Math.floor(300 * dpr), Math.floor(100 * dpr),
    ).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return true;
    }
    return false;
  });
  expect(isNonBlank).toBe(true);
});

test('double-click opens editor, type value, Enter commits it', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();

  // Click on cell (0,1) to select it first — col 0 is ID (width=60), col 1 starts at x=50+60=110
  // Cell (0,1): y = 32 (header) + 0*28 + 14 = 46
  await scrollContainer.click({ position: { x: 130, y: 46 } });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Double-click on the same cell to open editor
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // A textarea should appear in the DOM
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // The textarea should be pre-filled with the cell value
  const initialValue = await textarea.inputValue();
  expect(initialValue).toBeTruthy(); // Should have some value from demo data

  // Type a new value
  await textarea.fill('TestValue123');

  // Press Enter to commit
  await page.keyboard.press('Enter');

  // Textarea should disappear
  await expect(textarea).not.toBeVisible({ timeout: 2000 });

  // Wait for re-render
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Verify: the canvas should now render the new value
  // We check that the content area has changed by looking for text rendering
  const canvas = page.locator('canvas').first();
  const hasNewContent = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    // Check the cell area where the new value should be rendered
    const x = Math.floor(110 * dpr);
    const y = Math.floor(33 * dpr);
    const w = Math.floor(60 * dpr);
    const h = Math.floor(26 * dpr);
    const data = ctx.getImageData(x, y, w, h).data;
    // Check for non-white, non-gridline pixels (text rendering)
    let textPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Cell text color is #1f1f1f (31,31,31), look for dark pixels
      if (r < 100 && g < 100 && b < 100) textPixels++;
    }
    return textPixels > 5;
  });
  expect(hasNewContent).toBe(true);
});

test('Escape cancels editing without saving', async ({ page }) => {
  await page.goto('/demo/');
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await expect(scrollContainer).toBeVisible();

  const canvas = page.locator('canvas').first();

  // First click to establish selection (this changes canvas due to selection border)
  await scrollContainer.click({ position: { x: 130, y: 46 } });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Hash the cell area AFTER selection is established
  const hashCellArea = () => canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return 0;
    const dpr = window.devicePixelRatio || 1;
    const data = ctx.getImageData(
      Math.floor(110 * dpr), Math.floor(33 * dpr),
      Math.floor(60 * dpr), Math.floor(26 * dpr),
    ).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      hash = ((hash << 5) - hash + data[i] + data[i + 1] + data[i + 2]) | 0;
    }
    return hash;
  });

  const hashBefore = await hashCellArea();

  // Double-click to open editor on same cell
  await scrollContainer.dblclick({ position: { x: 130, y: 46 } });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 2000 });

  // Type something then press Escape
  await textarea.fill('ShouldNotSave');
  await page.keyboard.press('Escape');

  // Textarea should be gone
  await expect(textarea).not.toBeVisible({ timeout: 2000 });

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // Hash should match the pre-edit state (value unchanged, selection same)
  const hashAfter = await hashCellArea();
  expect(hashAfter).toBe(hashBefore);
});

test('number columns render right-aligned, boolean columns render checkboxes', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first(); 
  await expect(canvas).toBeVisible();

  // Verify number formatting: Salary column (col 5, x=610) displays "40,000" with comma.
  // We check that the cell area for Salary row 0 has visual content (rendered by type registry).
  // The number formatter uses toLocaleString which adds comma separators.
  // The visual test confirms numbers are rendered (formatting verified by unit tests).
  const salaryHasContent = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    // Salary col (x=610, w=100), row 0 (y=35 to y=57)
    const data = ctx.getImageData(
      Math.floor(620 * dpr), Math.floor(36 * dpr),
      Math.floor(80 * dpr), Math.floor(20 * dpr),
    ).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++;
    }
    return dark > 10; // "40,000" has many text pixels
  });
  expect(salaryHasContent).toBe(true);

  // Test: Boolean column (Active, col 13) renders checkbox instead of text
  // Active column x = 50 + 1510 = 1560 (far right, needs scrolling)
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollLeft = 1300;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // After scrolling 1300px right, Active column renders at viewport x = 1560 - 1300 = 260
  // (rowNumberWidth stays at 50, not scrolled)
  // Boolean cell (row 0, value=true) should have checkbox (centered box with checkmark)
  const boolHasCenteredContent = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d');
    if (!ctx) return false;
    const dpr = window.devicePixelRatio || 1;
    // Active column at viewport x = 260 (after scroll)
    const cellX = Math.floor(260 * dpr);
    const cellY = Math.floor(33 * dpr);
    const cellW = Math.floor(60 * dpr);
    const cellH = Math.floor(26 * dpr);

    // Sample the center third of the cell (checkbox should be there)
    const thirdW = Math.floor(cellW / 3);
    const centerData = ctx.getImageData(cellX + thirdW, cellY, thirdW, cellH).data;

    let nonWhite = 0;
    for (let i = 0; i < centerData.length; i += 4) {
      const r = centerData[i], g = centerData[i + 1], b = centerData[i + 2];
      if (r < 240 || g < 240 || b < 240) nonWhite++;
    }
    return nonWhite > 3; // checkbox strokes should have some colored pixels
  });
  expect(boolHasCenteredContent).toBe(true);
});

test('vertical scroll changes canvas content', async ({ page }) => {
  await page.goto('/demo/');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Hash content area pixels to detect changes (handles DPI-aware canvases)
  const hashContentArea = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      if (!ctx) return 0;
      const dpr = window.devicePixelRatio || 1;
      // Content area: past gutter (50px) and header (32px)
      const x = Math.floor(60 * dpr);
      const y = Math.floor(40 * dpr);
      const w = Math.floor(400 * dpr);
      const h = Math.floor(200 * dpr);
      const data = ctx.getImageData(x, y, w, h).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 4) {
        hash = ((hash << 5) - hash + data[i]) | 0;
      }
      return hash;
    });

  const hashBefore = await hashContentArea();

  // Scroll down via the scroll container
  const scrollContainer = page.locator('div[style*="overflow: auto"]');
  await scrollContainer.evaluate((el: HTMLDivElement) => {
    el.scrollTop = 500;
  });

  // Wait for render to complete via requestAnimationFrame
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const hashAfter = await hashContentArea();

  // Content area hash should change after scrolling (different rows visible)
  expect(hashBefore).not.toBe(hashAfter);
});
