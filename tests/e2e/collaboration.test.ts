import { test, expect } from '@playwright/test';

async function waitForRender(page: import('@playwright/test').Page) {
  await page.waitForTimeout(150);
}

test.describe('Collaboration', () => {
  test('two users can edit and see each other\'s changes', async ({ browser }) => {
    // Create two independent browser contexts (simulates two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Both load the demo
    await page1.goto('/');
    await page2.goto('/');

    // Wait for engine to initialize
    const scrollContainer1 = page1.locator('div[style*="overflow: auto"]');
    const scrollContainer2 = page2.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer1).toBeVisible();
    await expect(scrollContainer2).toBeVisible();
    await page1.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });
    await page2.waitForFunction(() => (window as any).__witEngine != null, null, { timeout: 5000 });

    // Both enable collaboration mode
    await page1.locator('[data-testid="collab-toggle"]').click();
    await page2.locator('[data-testid="collab-toggle"]').click();

    // Wait for both to connect
    await expect(page1.locator('[data-testid="collab-status"]')).toContainText('Connected');
    await expect(page2.locator('[data-testid="collab-status"]')).toContainText('Connected');

    // Allow server to fully register both connections
    await page1.waitForTimeout(500);

    // User 1 edits cell (0,1) — "First Name" column, first data row
    // x=130 hits col 1 (after row numbers ~50px + col 0 width ~60px)
    // y=46 hits row 0 (header 32px + half row height)
    await scrollContainer1.dblclick({ position: { x: 130, y: 46 } });
    await waitForRender(page1);

    // Type a value
    await page1.keyboard.type('COLLAB_TEST');
    await page1.keyboard.press('Enter');
    await waitForRender(page1);

    // Wait for OT propagation (WebSocket relay)
    await page1.waitForTimeout(1500);

    // User 2 double-clicks the same cell to open editor and read value
    // Retry with increasing delays to handle OT propagation timing
    let value = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      await scrollContainer2.dblclick({ position: { x: 130, y: 46 } });
      await waitForRender(page2);
      const editor2 = page2.locator('textarea');
      value = await editor2.inputValue();
      if (value === 'COLLAB_TEST') break;
      await page2.keyboard.press('Escape');
      await page2.waitForTimeout(800);
    }
    expect(value).toBe('COLLAB_TEST');

    // Cleanup
    await page2.keyboard.press('Escape');
    await context1.close();
    await context2.close();
  });

  test('collab button connects and disconnects', async ({ page }) => {
    await page.goto('/demo/');
    const scrollContainer = page.locator('div[style*="overflow: auto"]');
    await expect(scrollContainer).toBeVisible();

    // Click collaborate
    const collabBtn = page.locator('[data-testid="collab-toggle"]');
    await expect(collabBtn).toContainText('Collaborate');
    await collabBtn.click();

    // Should show connected status
    await expect(page.locator('[data-testid="collab-status"]')).toContainText('Connected');
    await expect(collabBtn).toContainText('Disconnect');

    // Disconnect
    await collabBtn.click();
    await expect(collabBtn).toContainText('Collaborate');
  });
});
