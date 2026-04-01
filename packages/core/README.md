# @witqq/spreadsheet

> Canvas-based spreadsheet engine — framework-agnostic core

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet.svg)](https://www.npmjs.com/package/@witqq/spreadsheet)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet
```

## Quick Start

```typescript
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name', width: 150 },
  { key: 'age', title: 'Age', width: 80, type: 'number' },
  { key: 'email', title: 'Email', width: 200 },
];

const data = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' },
];

const engine = new SpreadsheetEngine({ columns, data });
engine.mount(document.getElementById('grid')!);
```

## Documentation

Full documentation is available at [spreadsheet.witqq.dev](https://spreadsheet.witqq.dev) and included in this package under `docs/`.

### Getting Started

- [Configuration](docs/getting-started/configuration.md)
- [@witqq/spreadsheet](docs/getting-started/index.md)
- [Installation](docs/getting-started/installation.md)
- [1,000,000 Rows at 60 FPS](docs/getting-started/performance.md)
- [Quick Start](docs/getting-started/quick-start.md)
- [TypeScript](docs/getting-started/typescript.md)

### Core Concepts

- [Architecture](docs/concepts/architecture.md)
- [Data Model](docs/concepts/data-model.md)
- [Events](docs/concepts/events.md)
- [Rendering](docs/concepts/rendering.md)
- [Themes](docs/concepts/themes.md)

### Guides

- [Accessibility (WCAG 2.1 AA)](docs/guides/accessibility.md)
- [Auto Row Height](docs/guides/auto-row-height.md)
- [Drag-to-Fill](docs/guides/autofill.md)
- [Cell Editor Registry](docs/guides/cell-editor-registry.md)
- [Change Tracking](docs/guides/change-tracking.md)
- [Copy, Cut & Paste](docs/guides/clipboard.md)
- [Column Stretch](docs/guides/column-stretch.md)
- [Context Menu](docs/guides/context-menu.md)
- [DataView](docs/guides/dataview.md)
- [Date & DateTime Editors](docs/guides/date-editors.md)
- [Cell Decorators](docs/guides/decorators.md)
- [Inline Editing](docs/guides/editing.md)
- [Features Overview](docs/guides/features.md)
- [Filtering](docs/guides/filtering.md)
- [Frozen Rows & Columns](docs/guides/frozen-panes.md)
- [Locale System](docs/guides/locale.md)
- [Cell Merging](docs/guides/merging.md)
- [Migration from Handsontable](docs/guides/migration-from-handsontable.md)
- [Migration Notes](docs/guides/migration-notes.md)
- [Pivot Tables](docs/guides/pivot.md)
- [Print Support](docs/guides/print.md)
- [Column & Row Resize](docs/guides/resize.md)
- [Row Grouping](docs/guides/row-grouping.md)
- [Selection & Navigation](docs/guides/selection.md)
- [Sorting](docs/guides/sorting.md)
- [Streaming Data](docs/guides/streaming.md)
- [Per-Cell Styling](docs/guides/styling.md)
- [Text Wrapping](docs/guides/text-wrapping.md)
- [Undo & Redo](docs/guides/undo-redo.md)
- [Cell Validation](docs/guides/validation.md)

### Plugins

- [Collaboration Plugin](docs/plugins/collaboration.md)
- [Conditional Formatting](docs/plugins/conditional-format.md)
- [Custom Functions](docs/plugins/custom-functions.md)
- [Excel Import/Export](docs/plugins/excel.md)
- [Formula Engine](docs/plugins/formulas.md)
- [Plugin Architecture](docs/plugins/overview.md)
- [Progressive Loader Plugin](docs/plugins/progressive-loader.md)

### API Reference

- [Cell Types & Registry](docs/api/cell-types.md)
- [Core Types](docs/api/types.md)
- [SpreadsheetEngine API](docs/api/wit-engine.md)

### Frameworks

- [Angular Integration](docs/frameworks/angular.md)
- [React Integration](docs/frameworks/react.md)
- [Vue 3 Integration](docs/frameworks/vue.md)
- [Vanilla JS / Widget](docs/frameworks/widget.md)

## License

BUSL-1.1
