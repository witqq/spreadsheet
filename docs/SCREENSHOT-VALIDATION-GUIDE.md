# Screenshot Validation Guide

Screenshot validation captures UI state via Playwright scripts during development workflow steps. An HTML report embeds captured screenshots so the user can approve or reject changes without visiting a running instance.

## Workflow Variable

The development workflow stores the path to this file in:

```
screenshot_guide_path = "docs/SCREENSHOT-VALIDATION-GUIDE.md"
```

When `screenshot_validation_enabled = "yes"`, the agent reads this guide and follows its process on every implementation step.

## Directory Structure

Each step stores screenshots inside the workspace:

```
moira-ws/<workspace>/
├── screenshots/               # Playwright capture scripts (accumulative)
│   ├── capture-step-1.ts
│   ├── capture-step-2.ts
│   └── ...
├── step-1/
│   ├── iteration-1/
│   │   └── screenshots/       # Captured PNG files
│   │       ├── 01-grid-default.png
│   │       └── 02-feature-active.png
│   ├── step-report.html       # HTML report with embedded screenshots
│   └── screenshot-report.html # Screenshot-only HTML report (optional)
├── step-2/
│   └── ...
└── development-plan.md
```

## Canvas Capture Helpers

This project renders on `<canvas>`. Screenshots must wait for canvas rendering to complete.

### Wait for Render

```typescript
async function waitForTableRender(page: import('playwright').Page) {
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(
    () => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  );
}
```

### Widget Bundle for Standalone Pages

For isolated screenshots without the demo app, use the widget bundle:

```typescript
import path from 'path';

const WIDGET_BUNDLE = path.resolve(
  __dirname,
  '../../packages/widget/dist/witqq-spreadsheet-widget.umd.cjs',
);

async function setupGrid(page: import('playwright').Page) {
  await page.setContent(`
    <html>
      <head><style>body { margin: 0; } #grid { width: 800px; height: 500px; margin: 12px; }</style></head>
      <body><div id="grid"></div></body>
    </html>
  `);
  await page.addScriptTag({ path: WIDGET_BUNDLE });
  await page.evaluate(() => {
    const S = (window as any).Spreadsheet;
    S.create('#grid', {
      columns: [
        { key: 'name', title: 'Name', width: 200 },
        { key: 'value', title: 'Value', width: 150, type: 'number' },
      ],
      data: [{ name: 'Item A', value: 100 }],
    });
  });
  await waitForTableRender(page);
}
```

## Writing Capture Scripts

Each script captures screenshots for one step. Scripts are **accumulative** — each step adds new captures without removing previous scripts.

### Script Template

```typescript
// screenshots/capture-step-N.ts
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const STEP = 1;
const OUTPUT_DIR = path.resolve(`moira-ws/<workspace>/step-${STEP}/iteration-1/screenshots`);
const DEMO_URL = 'http://localhost:3150/demo/';

async function capture() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // --- Capture 1: Default grid ---
  await page.goto(DEMO_URL);
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() =>
    new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
  await page.screenshot({
    path: path.join(OUTPUT_DIR, '01-default-grid.png'),
  });

  // --- Capture 2: Feature-specific view ---
  // Navigate to visual-tests page with specific scenario:
  await page.goto(`${DEMO_URL}visual-tests.html?scenario=frozen-panes`);
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.evaluate(() =>
    new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
  await page.screenshot({
    path: path.join(OUTPUT_DIR, '02-frozen-panes.png'),
  });

  await browser.close();
  console.log(`Captured ${fs.readdirSync(OUTPUT_DIR).length} screenshots to ${OUTPUT_DIR}`);
}

capture().catch(console.error);
```

### Capture Checklist

For each step, capture:

- Full grid screenshot of the default state
- Each new UI element (editor popups, context menus, overlays)
- Interactive states (editing mode, date picker open, selection active)
- Data states (cells with values, formatted numbers, dates)
- Edge cases (empty grid, large dataset, scrolled state)

## Running Scripts

```bash
# Docker must be running for the demo app:
npm run dev

# Run capture script:
npx tsx moira-ws/<workspace>/screenshots/capture-step-N.ts

# For widget-based captures, rebuild widget first:
cd packages/widget && npm run build && cd ../..
```

## HTML Report Generation

After capturing, generate a self-contained HTML report. The report embeds screenshots as base64 so users can open it locally without a running server.

### Report Requirements

1. **Self-contained** — single `.html` file with embedded CSS and base64 images
2. **All screenshots visible** — each screenshot displayed at readable size
3. **Labeled** — filename or description next to each image
4. **Click-to-expand** — thumbnails with click to show full resolution
5. **Step context** — title includes step number and description
6. **Decision-ready** — user must be able to approve/reject the step based solely on the report

### Embedding Screenshots as Base64

```typescript
import * as fs from 'fs';
import * as path from 'path';

function embedScreenshot(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function generateReport(screenshotDir: string, stepIndex: number, description: string): string {
  const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();

  const cards = files.map(file => {
    const src = embedScreenshot(path.join(screenshotDir, file));
    return `
    <div class="screenshot-card">
      <h3>${file}</h3>
      <img src="${src}" alt="${file}" onclick="this.classList.toggle('expanded')" />
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Step ${stepIndex} — Screenshot Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .screenshot-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
    .screenshot-card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .screenshot-card h3 { margin: 0 0 12px 0; font-size: 14px; color: #666; }
    .screenshot-card img { max-width: 100%; cursor: pointer; border: 1px solid #eee; border-radius: 4px; }
    .screenshot-card img.expanded { max-width: none; width: 100%; }
  </style>
</head>
<body>
  <h1>Step ${stepIndex}: ${description}</h1>
  <p>Screenshots: ${files.length} | Generated: ${new Date().toISOString()}</p>
  <div class="screenshot-grid">${cards}</div>
</body>
</html>`;
}
```

### Saving the Report

```typescript
const html = generateReport(
  `moira-ws/<workspace>/step-${STEP}/iteration-1/screenshots`,
  STEP,
  'Step description here',
);

fs.writeFileSync(`moira-ws/<workspace>/step-${STEP}/screenshot-report.html`, html);
```

## Validation Criteria

When validating screenshots, check:

| Check | Pass | Fail |
|-------|------|------|
| Canvas renders | Grid lines, headers, cells visible | Blank/white canvas |
| Layout | Columns aligned, rows spaced | Overlapping text, misaligned headers |
| Data | Cell values displayed, formatted | Empty cells when data expected |
| Editors | Popup positioned over cell, inputs visible | Editor off-screen, clipped, missing |
| Themes | Colors match theme (light/dark) | Wrong colors, unstyled elements |
| Scroll | Content visible at scroll positions | Missing rows, broken frozen panes |

## Existing Visual Regression Infrastructure

Separately from ad-hoc screenshot validation, the project has a permanent visual regression suite:

- `tests/e2e/visual-regression.test.ts` — 43 scenarios with `toHaveScreenshot()`
- 258 baseline snapshots in `tests/e2e/visual-regression.test.ts-snapshots/`
- Scenarios defined in `packages/demo/src/visual-tests/scenarios/`
- Run: `npx playwright test tests/e2e/visual-regression.test.ts --project=chromium`
- Update baselines: `npx playwright test tests/e2e/visual-regression.test.ts --update-snapshots`
