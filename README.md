<div align="center">

# @witqq/spreadsheet

**Canvas-based spreadsheet & datagrid engine for React, Vue, Angular — zero dependencies**

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet)

<br />

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_Now-brightgreen?style=for-the-badge&logo=google-chrome&logoColor=white)](https://spreadsheet.witqq.dev/)
[![Documentation](https://img.shields.io/badge/Docs-Read_the_Docs-blue?style=for-the-badge&logo=readthedocs&logoColor=white)](https://spreadsheet.witqq.dev/getting-started/)
[![API Reference](https://img.shields.io/badge/API-Reference-8B5CF6?style=for-the-badge&logo=typescript&logoColor=white)](https://spreadsheet.witqq.dev/api/wit-engine/)
[![Getting Started](https://img.shields.io/badge/Quick_Start-5_min_Setup-orange?style=for-the-badge&logo=rocket&logoColor=white)](https://spreadsheet.witqq.dev/getting-started/quick-start/)

</div>

---

A high-performance spreadsheet and datagrid engine built on Canvas 2D with zero external dependencies. Renders 100K+ rows at 60fps with full editing, selection, undo/redo, clipboard, sorting, filtering, frozen panes, merged cells, formulas, and real-time collaboration.

Official wrappers for **React**, **Vue 3**, and **Angular**. Embeddable widget bundle under 36KB gzip.

## ✨ Features

| Category | Features |
|----------|----------|
| **Rendering** | Canvas 2D multi-layer pipeline, 100K+ rows at 60fps, progressive loading |
| **Editing** | Inline editor, undo/redo (100 steps), clipboard (TSV + HTML), autofill |
| **Data** | Sort (multi-column), filter (14 operators), frozen panes, merged cells |
| **Plugins** | Formulas, conditional formatting, collaboration (OT), Excel I/O, context menu |
| **Theming** | Light/dark built-in, fully customizable via `WitTheme` |
| **Accessibility** | WCAG 2.1 AA: role=grid, aria-live, keyboard-only, print support |
| **Frameworks** | React, Vue 3, Angular, vanilla JS widget (<36KB gzip) |

## 🚀 Quick Start

```bash
npm install @witqq/spreadsheet @witqq/spreadsheet-react
```

```tsx
import { WitTable } from '@witqq/spreadsheet-react';

const columns = [
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

> **Vue, Angular, vanilla JS?** See framework guides:
> [Vue 3](https://spreadsheet.witqq.dev/frameworks/vue/) ·
> [Angular](https://spreadsheet.witqq.dev/frameworks/angular/) ·
> [Widget](https://spreadsheet.witqq.dev/frameworks/widget/)

## ⚡ Performance

| Metric | Value |
|--------|-------|
| Init time (10K rows, 41 cols) | ~120ms |
| Init time (100K rows) | ~350ms |
| Scroll FPS | 60fps stable |
| Widget bundle | <36KB gzip |
| Core bundle | Zero external deps |
| Memory (100K rows) | ~45MB |

## 📦 Packages

| Package | Description |
|---------|-------------|
| [`@witqq/spreadsheet`](https://www.npmjs.com/package/@witqq/spreadsheet) | Canvas engine (core) |
| [`@witqq/spreadsheet-react`](https://www.npmjs.com/package/@witqq/spreadsheet-react) | React wrapper |
| [`@witqq/spreadsheet-vue`](https://www.npmjs.com/package/@witqq/spreadsheet-vue) | Vue 3 wrapper |
| [`@witqq/spreadsheet-angular`](https://www.npmjs.com/package/@witqq/spreadsheet-angular) | Angular wrapper |
| [`@witqq/spreadsheet-widget`](https://www.npmjs.com/package/@witqq/spreadsheet-widget) | Embeddable IIFE/UMD bundle |
| [`@witqq/spreadsheet-plugins`](https://www.npmjs.com/package/@witqq/spreadsheet-plugins) | Official plugins |

## 📖 Documentation

Full documentation with interactive demos at **[spreadsheet.witqq.dev](https://spreadsheet.witqq.dev/)**

- [Getting Started](https://spreadsheet.witqq.dev/getting-started/) — Installation, quick start, configuration
- [Guides](https://spreadsheet.witqq.dev/guides/features/) — Selection, sorting, filtering, frozen panes, and more
- [Plugins](https://spreadsheet.witqq.dev/plugins/overview/) — Formulas, collaboration, Excel I/O
- [API Reference](https://spreadsheet.witqq.dev/api/wit-engine/) — WitEngine, types, cell types
- [Migration from Handsontable](https://spreadsheet.witqq.dev/guides/migration-from-handsontable/) — Side-by-side API mapping

## 🛠 Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Docker, port 3150)
npm run build        # Build all packages
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

## 📄 License

[BSL 1.1](LICENSE) — Free for non-commercial use. Commercial use requires a paid license. Converts to Apache 2.0 on 2030-03-01.

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📬 Contact

- Website: [spreadsheet.witqq.dev](https://spreadsheet.witqq.dev/)
- Email: belyiwork@mail.ru
- Issues: [GitHub Issues](https://github.com/witqq/spreadsheet/issues)
