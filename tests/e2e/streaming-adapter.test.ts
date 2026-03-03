import { test, expect } from '@playwright/test';

test.describe('Streaming Data Adapter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForFunction(() => {
      const w = (window as unknown as { __witEngine: unknown }).__witEngine;
      return !!w;
    });
  });

  test('streaming button toggles streaming mode', async ({ page }) => {
    const btn = page.getByTestId('streaming-toggle');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('📡 Stream');

    await btn.click();
    await expect(btn).toHaveText('⏹ Stop Stream');

    await btn.click();
    await expect(btn).toHaveText('📡 Stream');
  });

  test('streaming appends rows to the grid', async ({ page }) => {
    // Get initial row count
    const initialCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getRowCount() ?? 0;
    });

    // Start streaming
    await page.getByTestId('streaming-toggle').click();

    // Wait for some rows to be added
    await page.waitForFunction(
      (initial) => {
        const engine = (window as any).__witEngine;
        return engine && engine.getRowCount() > initial + 50;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Stop streaming
    await page.getByTestId('streaming-toggle').click();

    const finalCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getRowCount() ?? 0;
    });

    expect(finalCount).toBeGreaterThan(initialCount + 50);
  });

  test('streaming counter shows added rows', async ({ page }) => {
    await page.getByTestId('streaming-toggle').click();

    // Wait for counter to appear and show a positive number
    const counter = page.getByTestId('streaming-count');
    await expect(counter).toBeVisible({ timeout: 3000 });

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="streaming-count"]');
      if (!el) return false;
      const match = el.textContent?.match(/\+(\d+)/);
      return match && parseInt(match[1]) >= 10;
    }, null, { timeout: 5000 });

    // Stop streaming
    await page.getByTestId('streaming-toggle').click();
    await expect(counter).not.toBeVisible();
  });

  test('streamed rows have correct cell data', async ({ page }) => {
    // Get initial count
    const initialCount = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getRowCount() ?? 0;
    });

    // Start streaming
    await page.getByTestId('streaming-toggle').click();

    // Wait for rows
    await page.waitForFunction(
      (initial) => {
        const engine = (window as any).__witEngine;
        return engine && engine.getRowCount() > initial + 10;
      },
      initialCount,
      { timeout: 5000 },
    );

    // Stop streaming
    await page.getByTestId('streaming-toggle').click();

    // Verify a streamed row has data (check first column = ID, should be a number)
    const streamedId = await page.evaluate((offset) => {
      const engine = (window as any).__witEngine;
      return engine?.getCell(offset, 0)?.value ?? null;
    }, initialCount);

    expect(typeof streamedId).toBe('number');
    expect(streamedId as number).toBeGreaterThan(0);
  });

  test('streaming maintains rendering without freezing', async ({ page }) => {
    // Start streaming
    await page.getByTestId('streaming-toggle').click();

    // Wait 2 seconds — grid should remain responsive
    await page.waitForTimeout(2000);

    // Verify engine is still responsive (can read cells)
    const isResponsive = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      if (!engine) return false;
      const cell = engine.getCell(0, 0);
      return cell?.value != null;
    });

    expect(isResponsive).toBe(true);

    // Stop streaming
    await page.getByTestId('streaming-toggle').click();
  });
});
