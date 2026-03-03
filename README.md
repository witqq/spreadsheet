<div align="center">

# @witqq/spreadsheet

**Canvas-based spreadsheet & datagrid engine for React, Vue, Angular — zero dependencies**

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet)

</div>

## Overview

A high-performance spreadsheet and datagrid engine built on Canvas 2D with zero external dependencies. Use as a React spreadsheet, Vue datagrid, or Angular table component. Renders 100K+ rows at 60fps with full editing, selection, undo/redo, clipboard, sorting, filtering, frozen panes, merged cells, formulas, and real-time collaboration.

Official wrappers for React, Vue 3, and Angular. Embeddable widget bundle under 36KB gzip.

## Features

- **Canvas rendering** — Hardware-accelerated 2D canvas with multi-layer pipeline
- **100K+ rows** — Virtual scrolling, viewport culling, progressive loading
- **Zero dependencies** — Core engine has no external deps
- **Framework wrappers** — React, Vue 3, Angular, vanilla JS
- **Editing** — Inline editor, undo/redo (100 steps), clipboard (TSV + HTML)
- **Selection** — Multi-range, keyboard navigation, autofill drag handle
- **Sort & Filter** — Multi-column stable sort, 14 filter operators
- **Frozen panes** — Lock rows/columns with 4-region viewport rendering
- **Merged cells** — Spatial index, anchor/hidden cell model
- **Themes** — Light/dark built-in, fully customizable via `WitTheme`
- **Validation** — Required, range, regex, custom functions with error tooltips
- **Accessibility** — WCAG 2.1 AA: role=grid, aria-live, keyboard-only operation
- **Print** — @media print CSS, DOM table generation from canvas data

## Plugins

| Plugin | Description |
|--------|-------------|
| Formula Engine | Tokenizer, parser, evaluator, dependency graph |
| Conditional Formatting | Gradients, data bars, icon sets |
| Collaboration | OT engine, WebSocket transport, remote cursors |
| Excel I/O | Import/export via lazy-loaded SheetJS |
| Context Menu | Right-click menu with keyboard navigation |

## Quick Start

### React

```bash
npm install @witqq/spreadsheet @witqq/spreadsheet-react
```

```tsx
import { WitTable } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { id: 'name', header: 'Name', width: 200 },
  { id: 'value', header: 'Value', width: 120, type: 'number' },
];

const data = [
  { name: 'Alpha', value: 100 },
  { name: 'Beta', value: 200 },
];

function App() {
  return <WitTable columns={columns} data={data} />;
}
```

### Vue 3

```bash
npm install @witqq/spreadsheet @witqq/spreadsheet-vue
```

```vue
<script setup lang="ts">
import { WitTable } from '@witqq/spreadsheet-vue';

const columns = [
  { id: 'name', header: 'Name', width: 200 },
  { id: 'value', header: 'Value', width: 120, type: 'number' },
];

const data = [
  { name: 'Alpha', value: 100 },
  { name: 'Beta', value: 200 },
];
</script>

<template>
  <WitTable :columns="columns" :data="data" />
</template>
```

### Angular

```bash
npm install @witqq/spreadsheet @witqq/spreadsheet-angular
```

```typescript
import { WitTableComponent } from '@witqq/spreadsheet-angular';

@Component({
  imports: [WitTableComponent],
  template: `<wit-table [columns]="columns" [data]="data" />`,
})
export class AppComponent {
  columns = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'value', header: 'Value', width: 120, type: 'number' },
  ];
  data = [
    { name: 'Alpha', value: 100 },
    { name: 'Beta', value: 200 },
  ];
}
```

### Vanilla JS (Widget)

```html
<div id="spreadsheet" style="width:800px;height:400px"></div>
<script src="https://unpkg.com/@witqq/spreadsheet-widget"></script>
<script>
  WitTable.create(document.getElementById('spreadsheet'), {
    columns: [
      { id: 'name', header: 'Name', width: 200 },
      { id: 'value', header: 'Value', width: 120, type: 'number' },
    ],
    data: [
      { name: 'Alpha', value: 100 },
      { name: 'Beta', value: 200 },
    ],
  });
</script>
```

## Performance

| Metric | Value |
|--------|-------|
| Init time (10K rows, 41 cols) | ~120ms |
| Init time (100K rows) | ~350ms |
| Scroll FPS | 60fps stable |
| Widget bundle | <36KB gzip |
| Core bundle | Zero external deps |
| Memory (100K rows) | ~45MB |

## Packages

| Package | Description |
|---------|-------------|
| [`@witqq/spreadsheet`](packages/core) | Canvas engine (core) |
| [`@witqq/spreadsheet-react`](packages/react) | React wrapper |
| [`@witqq/spreadsheet-vue`](packages/vue) | Vue 3 wrapper |
| [`@witqq/spreadsheet-angular`](packages/angular) | Angular wrapper |
| [`@witqq/spreadsheet-widget`](packages/widget) | Embeddable IIFE/UMD bundle |
| [`@witqq/spreadsheet-plugins`](packages/plugins) | Official plugins |

## Documentation

Full documentation, interactive demos, and API reference available at the project website.

- [Getting Started](docs/)
- [Migration from Handsontable](docs/migration-from-handsontable.md)
- [API Reference](docs/api/)

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Docker, port 3150)
npm run build        # Build all packages
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

## License

[BSL 1.1](LICENSE) — Free for non-commercial use. Commercial use requires a paid license. Converts to Apache 2.0 on 2030-03-01.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Contact

- Email: belyiwork@mail.ru
- Issues: [GitHub Issues](https://github.com/witqq/spreadsheet/issues)
