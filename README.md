# @witqq/spreadsheet

Canvas-based spreadsheet and datagrid engine for React, Vue, Angular, and vanilla JS. Zero external dependencies in the core package.

```bash
npm install @witqq/spreadsheet @witqq/spreadsheet-react
```

```tsx
import { Spreadsheet } from '@witqq/spreadsheet-react';

const columns = [
  { key: 'name', title: 'Name', width: 200 },
  { key: 'value', title: 'Value', width: 120, type: 'number' },
];

const data = [
  { name: 'Alpha', value: 100 },
  { name: 'Beta', value: 200 },
];

function App() {
  return <Spreadsheet columns={columns} data={data} />;
}
```

## Packages

| Package | Path | npm | Description |
|---------|------|-----|-------------|
| [`@witqq/spreadsheet`](packages/core/README.md) | `packages/core/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet) | Canvas engine — rendering, editing, selection, data model, commands, theming, localization. 224 exports. |
| [`@witqq/spreadsheet-react`](packages/react/README.md) | `packages/react/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet-react.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-react) | React wrapper component. 18 exports. |
| [`@witqq/spreadsheet-vue`](packages/vue/README.md) | `packages/vue/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet-vue.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-vue) | Vue 3 wrapper component. 19 exports. |
| [`@witqq/spreadsheet-angular`](packages/angular/README.md) | `packages/angular/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet-angular.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-angular) | Angular wrapper component. 13 exports. |
| [`@witqq/spreadsheet-plugins`](packages/plugins/README.md) | `packages/plugins/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet-plugins.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-plugins) | Formulas, conditional formatting, collaboration (OT), Excel I/O, context menu, progressive loader. 40 exports. |
| [`@witqq/spreadsheet-widget`](packages/widget/README.md) | `packages/widget/` | [![npm](https://img.shields.io/npm/v/@witqq/spreadsheet-widget.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-widget) | IIFE/UMD bundle for `<script>` tag embedding. 12 exports. |
| `@witqq/spreadsheet-server` | `packages/server/` | private | WebSocket collaboration relay server. [README](packages/server/README.md) |

Each package README contains full API documentation with all exported functions, classes, interfaces, and types — sufficient for LLM agents to use the library from `node_modules` without internet access.

## Package Decision Tree

```
Need a spreadsheet in your app?
├── Using React?       → @witqq/spreadsheet-react
├── Using Vue 3?       → @witqq/spreadsheet-vue
├── Using Angular?     → @witqq/spreadsheet-angular
├── No framework / plain HTML?
│   ├── Build step available? → @witqq/spreadsheet (use SpreadsheetEngine directly)
│   └── No build step?       → @witqq/spreadsheet-widget (<script> tag)
└── Need server-side collab?  → @witqq/spreadsheet-server

Need plugins?
├── Formulas (SUM, IF, etc.)        → @witqq/spreadsheet-plugins → FormulaPlugin
├── Conditional formatting          → @witqq/spreadsheet-plugins → ConditionalFormattingPlugin
├── Excel import/export             → @witqq/spreadsheet-plugins → ExcelPlugin
├── Real-time collaboration (OT)    → @witqq/spreadsheet-plugins → CollaborationPlugin
├── Right-click context menu        → @witqq/spreadsheet-plugins → createContextMenuPlugin
└── Progressive loading (100K+ rows)→ @witqq/spreadsheet-plugins → ProgressiveLoaderPlugin
```

All framework wrappers re-export core types (`ColumnDef`, `CellData`, `SpreadsheetTheme`, etc.) so you typically don't need to import from `@witqq/spreadsheet` directly. The wrapper packages list `@witqq/spreadsheet` as a regular dependency (installed automatically).

## Core API Overview

The core package (`@witqq/spreadsheet`) provides `SpreadsheetEngine` — the main class that manages the entire spreadsheet lifecycle. See [packages/core/README.md](packages/core/README.md) for the full 224-export API reference.

Key areas:

| Area | Key Exports | Description |
|------|-------------|-------------|
| Engine | `SpreadsheetEngine`, `SpreadsheetEngineConfig` | Main class: mount, destroy, data, plugins, events |
| Columns | `ColumnDef`, `CellType`, `CellTypeRenderer` | Column definition, type system, custom renderers |
| Data | `CellData`, `CellValue`, `CellAddress`, `CellStore` | Cell data model, addresses, storage |
| Selection | `Selection`, `SelectionManager` | Current selection, multi-range, keyboard navigation |
| Commands | `Command`, `CommandManager` | Undo/redo command pattern |
| Events | `EventBus`, `CellChangeEvent`, `SelectionChangeEvent` | Event system for all state changes |
| Rendering | `RenderLayer`, `CanvasManager`, `GridRenderer` | Canvas rendering pipeline, custom layers |
| Theming | `SpreadsheetTheme`, `lightTheme`, `darkTheme` | Theme definitions, built-in themes |
| Localization | `SpreadsheetLocale`, `enLocale`, `ruLocale`, `resolveLocale` | i18n, locale packs, partial overrides |
| Editing | `CellEditor`, `CellEditorRegistry`, `InlineEditor` | Cell editing, custom editors, date pickers |
| Styling | `CellStyle`, `BorderStyle`, `StylePool` | Per-cell font, color, alignment, borders |
| Decorators | `CellDecorator`, `CellDecoratorRegistration` | Composable cell icons/indicators with hit zones |
| Layout | `LayoutEngine`, `ViewportManager` | Float64Array positions, virtualized scrolling |

## Performance

| Metric | Value |
|--------|-------|
| Initial render (10K rows, 41 columns) | ~120ms |
| Initial render (100K rows) | ~350ms |
| Scroll FPS | 60fps |
| Widget bundle | <36KB gzip |
| Core dependencies | 0 |
| Memory (100K rows) | ~45MB |

## Development

```bash
npm install          # Install dependencies
npm run build        # Build all packages
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run typecheck    # TypeScript strict mode
npm run lint         # ESLint
npm run dev          # Docker dev server on port 3150
```

## License

[BSL 1.1](LICENSE) — Free for non-commercial use. Commercial use requires a paid license. Change Date: 2030-03-01 → Apache License 2.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Contact

- Website: [spreadsheet.witqq.dev](https://spreadsheet.witqq.dev/)
- Email: belyiwork@mail.ru
- Issues: [GitHub Issues](https://github.com/witqq/spreadsheet/issues)
