import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Visual E2E test for word-wrap rendering in cells.
 *
 * Uses the widget UMD bundle directly (no Docker/dev server needed).
 * Creates a spreadsheet with wrapText columns and long text,
 * then captures a screenshot showing multi-line wrapped text.
 */

const WIDGET_BUNDLE = path.resolve(
  __dirname,
  '../../packages/widget/dist/witqq-spreadsheet-widget.umd.cjs',
);

test.describe('Word-wrap rendering', () => {
  test('renders multi-line wrapped text in cells', async ({ page }) => {
    await page.setContent(`
      <html>
        <head>
          <style>
            body { margin: 0; background: #f5f5f5; font-family: sans-serif; }
            h2 { margin: 12px; font-size: 14px; color: #333; }
            #grid { width: 900px; height: 500px; margin: 0 12px; }
          </style>
        </head>
        <body>
          <h2>Word-Wrap Demo — wrapText: true on "Description" and "Notes" columns</h2>
          <div id="grid"></div>
        </body>
      </html>
    `);

    await page.addScriptTag({ path: WIDGET_BUNDLE });

    await page.evaluate(() => {
      const S = (
        window as unknown as {
          Spreadsheet: { create: Function; lightTheme: Record<string, unknown> };
        }
      ).Spreadsheet;

      // Clone lightTheme with taller rows so wrapped text is visible
      const baseTheme = S.lightTheme as { dimensions: Record<string, number> };
      const tallRowTheme = {
        ...baseTheme,
        dimensions: { ...baseTheme.dimensions, rowHeight: 72 },
      };

      S.create('#grid', {
        columns: [
          { key: 'id', title: 'ID', width: 50, type: 'number' as const },
          { key: 'name', title: 'Name', width: 120 },
          {
            key: 'description',
            title: 'Description (wrap)',
            width: 220,
            wrapText: true,
          },
          { key: 'status', title: 'Status', width: 80 },
          {
            key: 'notes',
            title: 'Notes (wrap)',
            width: 250,
            wrapText: true,
          },
        ],
        data: [
          {
            id: 1,
            name: 'Alpha Release',
            description:
              'Initial alpha release with core spreadsheet engine, canvas rendering, and basic editing capabilities.',
            status: 'Done',
            notes:
              'Performance benchmarks show 60fps scrolling with 1M rows. Memory usage under 200MB.',
          },
          {
            id: 2,
            name: 'Beta',
            description:
              'Beta release adding frozen panes, column resize, sorting, and clipboard support.',
            status: 'In Progress',
            notes:
              'Frozen panes tested on Chrome, Firefox, Safari. Edge cases with merged cells still need work.',
          },
          {
            id: 3,
            name: 'Word Wrap',
            description:
              'Text measurement extensions and word-wrap rendering. Supports word-boundary splitting with character-level fallback for very long words.',
            status: 'Testing',
            notes:
              'This row demonstrates the word-wrap feature.\nExplicit newlines are preserved.\nEach line wraps independently when it exceeds the column width.',
          },
          {
            id: 4,
            name: 'Short',
            description: 'Short text',
            status: 'Planned',
            notes: 'Brief note',
          },
          {
            id: 5,
            name: 'Long Word',
            description:
              'Superlongwordthatcannotbesplitbywordboundarysoitmustfallbacktocharacterlevelbreaking here.',
            status: 'Edge case',
            notes:
              'Character-level fallback ensures even very long unbreakable words are displayed correctly.',
          },
        ],
        theme: tallRowTheme,
        showRowNumbers: true,
      });
    });

    // Wait for canvas to render
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Small delay for text rendering to complete
    await page.waitForTimeout(500);

    // Capture screenshot
    const screenshotPath = path.resolve(
      __dirname,
      '../../moira-ws/planeta-migration-gaps-20260306-0231/step-2/iteration-2/word-wrap-screenshot.png',
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Verify canvas has non-blank content
    const isNonBlank = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, el.width, el.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return true;
      }
      return false;
    });
    expect(isNonBlank).toBe(true);
  });
});
