# @witqq/spreadsheet

> Canvas-based spreadsheet engine — framework-agnostic core with zero external dependencies.

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet
```

## Quick Start

```typescript
import { WitEngine } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { key: 'name', header: 'Name', width: 150 },
  { key: 'age', header: 'Age', width: 80, type: 'number' },
  { key: 'email', header: 'Email', width: 200 },
];

const data = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' },
];

const engine = new WitEngine({
  container: document.getElementById('grid')!,
  columns,
  data,
});
```

## Features

- **Canvas 2D Rendering** — High-performance rendering for 100K+ rows
- **Zero Dependencies** — Pure TypeScript, no external libraries
- **Cell Types** — Text, number, date, boolean, custom renderers
- **Selection** — Multi-cell, row, column, and range selection
- **Keyboard Navigation** — Arrow keys, Tab, Enter, Home/End, Page Up/Down
- **Inline Editing** — Double-click or F2 to edit, Enter to commit
- **Undo/Redo** — Full command history (100 steps)
- **Clipboard** — Copy/cut/paste with TSV and HTML support (Excel/Sheets interop)
- **Column/Row Resize** — Drag borders to resize
- **Sorting** — Multi-column stable sort, type-aware
- **Filtering** — 14 operators (equals, contains, between, isEmpty, etc.)
- **Frozen Panes** — Freeze rows and columns
- **Merged Cells** — Merge/unmerge with spatial index
- **Autofill** — Drag handle with pattern detection (numbers, dates, text)
- **Validation** — Required, min/max, regex, custom functions
- **Change Tracking** — Cell status lifecycle (changed → saving → saved)
- **Conditional Formatting** — Gradients, data bars, icon sets (via plugin)
- **Formulas** — Custom formula engine (via plugin)
- **Theming** — Light and dark themes, fully customizable
- **Print** — @media print support with DOM table generation
- **Accessibility** — WCAG 2.1 AA (role=grid, aria-live announcements)
- **Touch Support** — Tap to select, double-tap to edit

## Framework Integration

| Framework | Package |
|-----------|---------|
| React | [@witqq/spreadsheet-react](https://www.npmjs.com/package/@witqq/spreadsheet-react) |

## Plugins

Official plugins: [@witqq/spreadsheet-plugins](https://www.npmjs.com/package/@witqq/spreadsheet-plugins)

- Context Menu — Right-click menu with keyboard navigation
- Formula Engine — Tokenizer, parser, evaluator, dependency graph
- Conditional Formatting — Gradients, data bars, icon sets
- Excel I/O — Import/export via SheetJS (lazy-loaded)
- Collaboration — Real-time OT with remote cursors

## Documentation

Full documentation and live demos: [spreadsheet.witqq.dev](https://spreadsheet.witqq.dev)

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.dev/pricing](https://spreadsheet.witqq.dev/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
