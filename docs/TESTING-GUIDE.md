# Testing Guide

## Frameworks

| Layer | Framework | Config |
|-------|-----------|--------|
| Unit tests | [Vitest](https://vitest.dev/) | `vitest.config.ts` |
| E2E tests | [Playwright](https://playwright.dev/) | `playwright.config.ts` |

## Running Tests

```bash
# Unit tests (all packages)
npm test                         # vitest run

# E2E tests (requires Docker or running demo)
npm run test:e2e                 # playwright test (starts Docker automatically)
npm run test:e2e:remote          # against remote server (BASE_URL=http://testold:3150)

# Single E2E project
npx playwright test --project=chromium

# Single test file
npx vitest run packages/core/tests/cell-store.test.ts
npx playwright test tests/e2e/smoke.test.ts
```

## Directory Structure

```
packages/
├── core/tests/              # engine unit tests
├── plugins/tests/           # plugin unit tests
│   └── collaboration/       # collaboration plugin tests
├── vue/tests/               # Vue wrapper
├── angular/tests/           # Angular wrapper
├── widget/tests/            # web component
├── server/tests/            # collab server
└── site/tests/              # data generation

tests/
└── e2e/                     # Playwright E2E tests
```

Run `npx vitest run` and `npx playwright test` to get current counts.

## Unit Test Conventions

### File naming

`[module-name].test.ts` — one test file per module, placed in `packages/<pkg>/tests/`.

### Environment

Tests that need DOM access use the jsdom pragma at the top of the file:

```ts
// @vitest-environment jsdom
```

Some core test files use jsdom; the rest run in the default Node environment.

### Imports

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CellStore } from '../src/model/cell-store';
```

- Import test APIs from `vitest`, not from globals.
- Import source modules via relative paths (`../src/...`).
- The `@witqq/spreadsheet` alias resolves to `packages/core/src/index.ts` (configured in `vitest.config.ts`).

### Structure

```ts
describe('ModuleName', () => {
  describe('feature group', () => {
    it('specific behavior', () => {
      // arrange → act → assert
    });
  });
});
```

### Mocking

Use `vi.fn()` and `vi.spyOn()` for mocks. No shared test helpers directory — each test file creates its own mocks inline.

```ts
const callback = vi.fn();
engine.on('render', callback);
engine.requestRender();
expect(callback).toHaveBeenCalledOnce();
```

### Known Gotcha: `document.activeElement`

jsdom does not track `document.activeElement` after programmatic `focus()`. For focus verification in tests, check `boxShadow` style instead:

```ts
expect(editorEl.style.boxShadow).toContain('0 0 0 2px');
```

## E2E Test Conventions

### File naming

`[feature].test.ts` in `tests/e2e/`.

### Structure

```ts
import { test, expect } from '@playwright/test';

test('descriptive name', async ({ page }) => {
  await page.goto('/demo/');
  // interact and assert
});
```

### Configuration

- Base URL: `http://localhost:3150` (Docker demo app)
- Timeout: 30s per test, 5s per expect
- Screenshots: only on failure
- Trace: on first retry
- Retries: 2 in CI, 1 locally
- Browser projects: Chromium, Firefox, WebKit

### Web Server

Playwright auto-starts Docker (`docker compose up --build`) if `BASE_URL` is not set. Timeout for server startup: 120s.

### Canvas Testing

The spreadsheet renders on `<canvas>`. Common patterns:

```ts
// Wait for canvas to be visible
const canvas = page.locator('canvas').first();
await expect(canvas).toBeVisible();

// Check canvas has non-blank content
const isNonBlank = await canvas.evaluate((el: HTMLCanvasElement) => {
  const ctx = el.getContext('2d');
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, el.width, el.height).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 255 || data[i+1] !== 255 || data[i+2] !== 255) return true;
  }
  return false;
});
expect(isNonBlank).toBe(true);
```

### Visual Regression

Use `toHaveScreenshot()` for pixel-level comparisons. Screenshot baselines are stored alongside test files.

## Coverage

Vitest V8 coverage is configured for `packages/*/src/**/*.ts`, excluding `packages/demo/`.

```bash
npx vitest run --coverage
```

## Writing New Tests

1. Create `packages/<pkg>/tests/<module>.test.ts`
2. Add `// @vitest-environment jsdom` if the module touches DOM
3. Import from `vitest` and from source via relative paths
4. Follow describe/it nesting: module → feature group → specific behavior
5. Keep mocks local to the test file
6. For E2E: create `tests/e2e/<feature>.test.ts`, navigate to `/demo/`, interact with canvas
