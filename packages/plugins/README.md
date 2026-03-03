# @witqq/spreadsheet-plugins

> Official plugins for the witqq Canvas spreadsheet engine.

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet-plugins.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-plugins)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet-plugins.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet-plugins @witqq/spreadsheet
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| **Context Menu** | Right-click menu with keyboard navigation and extensible items |
| **Formula Engine** | Spreadsheet formulas with tokenizer, parser, evaluator, and dependency graph |
| **Conditional Formatting** | Color gradients, data bars, and icon sets |
| **Excel I/O** | Import/export Excel files via SheetJS (lazy-loaded) |
| **Collaboration** | Real-time editing with OT engine and remote cursors |

## Usage

### Context Menu

```typescript
import { createContextMenuPlugin } from '@witqq/spreadsheet-plugins';

const engine = new WitEngine({ container, columns, data });
engine.installPlugin(createContextMenuPlugin());
```

### Formula Engine

```typescript
import { FormulaPlugin } from '@witqq/spreadsheet-plugins';

const engine = new WitEngine({ container, columns, data });
engine.installPlugin(new FormulaPlugin());

// Set a formula
engine.setCellValue(0, 2, '=SUM(A1:B1)');
```

### Conditional Formatting

```typescript
import { ConditionalFormattingPlugin } from '@witqq/spreadsheet-plugins';

const plugin = new ConditionalFormattingPlugin();
engine.installPlugin(plugin);

plugin.addRule({
  range: { startRow: 0, startCol: 1, endRow: 99, endCol: 1 },
  condition: { type: 'gradient', stops: [
    { value: 0, color: '#ff0000' },
    { value: 100, color: '#00ff00' },
  ]},
});
```

### Excel I/O

```typescript
import { ExcelPlugin } from '@witqq/spreadsheet-plugins';

const plugin = new ExcelPlugin();
engine.installPlugin(plugin);

// Export
const blob = await plugin.exportToExcel({ filename: 'data.xlsx' });

// Import
const result = await plugin.importFromExcel(file);
```

### Collaboration

```typescript
import { CollaborationPlugin, WebSocketTransport } from '@witqq/spreadsheet-plugins';

const transport = new WebSocketTransport({ url: 'wss://your-server/ws' });
const plugin = new CollaborationPlugin({ transport });
engine.installPlugin(plugin);
```

## Documentation

Full documentation and live demos: [spreadsheet.witqq.ru](https://spreadsheet.witqq.ru)

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.ru/pricing](https://spreadsheet.witqq.ru/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
