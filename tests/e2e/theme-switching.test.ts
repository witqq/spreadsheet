import { test, expect } from '@playwright/test';

test.describe('Theme switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/');
    await page.waitForSelector('canvas');
  });

  test('theme toggle button is visible', async ({ page }) => {
    const btn = page.locator('[data-testid="theme-toggle"]');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Dark');
  });

  test('clicking toggle switches to dark theme', async ({ page }) => {
    const btn = page.locator('[data-testid="theme-toggle"]');
    await btn.click();
    await expect(btn).toContainText('Light');

    // Verify engine theme changed
    const themeName = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getTheme?.()?.name;
    });
    expect(themeName).toBe('dark');
  });

  test('clicking toggle twice returns to light theme', async ({ page }) => {
    const btn = page.locator('[data-testid="theme-toggle"]');
    await btn.click();
    await btn.click();
    await expect(btn).toContainText('Dark');

    const themeName = await page.evaluate(() => {
      const engine = (window as any).__witEngine;
      return engine?.getTheme?.()?.name;
    });
    expect(themeName).toBe('light');
  });

  test('dark theme changes canvas background color', async ({ page }) => {
    // Sample pixel before toggle (light)
    const lightBg = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const pixel = ctx.getImageData(5, 50, 1, 1).data;
      return { r: pixel[0], g: pixel[1], b: pixel[2] };
    });

    // Toggle to dark
    await page.locator('[data-testid="theme-toggle"]').click();
    await page.waitForTimeout(100); // Wait for re-render

    // Sample pixel after toggle (dark)
    const darkBg = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const pixel = ctx.getImageData(5, 50, 1, 1).data;
      return { r: pixel[0], g: pixel[1], b: pixel[2] };
    });

    expect(lightBg).not.toBeNull();
    expect(darkBg).not.toBeNull();
    // Dark theme background should be significantly darker
    expect(darkBg!.r).toBeLessThan(100);
    expect(darkBg!.g).toBeLessThan(100);
    expect(darkBg!.b).toBeLessThan(100);
    // Light theme should be bright
    expect(lightBg!.r).toBeGreaterThan(200);
  });

  test('container background changes with theme', async ({ page }) => {
    // Toggle to dark
    await page.locator('[data-testid="theme-toggle"]').click();

    // Check the outer container (parent of h1 and table) has dark background
    const bg = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const container = h1?.parentElement?.parentElement;
      return container ? getComputedStyle(container).backgroundColor : '';
    });
    // rgb(30, 30, 30) = #1e1e1e
    expect(bg).toBe('rgb(30, 30, 30)');
  });

  test('themeChange event fires on toggle', async ({ page }) => {
    const eventFired = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        const engine = (window as any).__witEngine;
        if (!engine) {
          resolve('no-engine');
          return;
        }
        engine.on('themeChange', (e: any) => {
          resolve(e.theme.name);
        });
        // Trigger theme change programmatically
        const dark = (window as any).__witEngine.getTheme().name === 'dark';
        engine.setTheme(
          dark
            ? { ...engine.getTheme(), name: 'light' }
            : { ...engine.getTheme(), name: 'dark' },
        );
      });
    });
    expect(eventFired).toBeTruthy();
    expect(eventFired).not.toBe('no-engine');
  });
});
