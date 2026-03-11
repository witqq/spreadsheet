# @witqq/spreadsheet-angular

> Angular wrapper for the witqq Canvas spreadsheet engine.

## Installation

```bash
npm install @witqq/spreadsheet-angular @witqq/spreadsheet
```

**Peer dependencies:** `@angular/core` and `@angular/common` version 17+.

## Exports

```ts
import { SpreadsheetComponent, SpreadsheetEngine, lightTheme, darkTheme } from '@witqq/spreadsheet-angular';
import type {
  CellData,
  CellValue,
  CellStyle,
  CellType,
  ColumnDef,
  Selection,
  SpreadsheetEvents,
  SpreadsheetPlugin,
  SpreadsheetTheme,
} from '@witqq/spreadsheet-angular';
```

---

## Quick Start

`SpreadsheetComponent` is a standalone component with selector `witqq-spreadsheet`:

```typescript
import { Component } from '@angular/core';
import { SpreadsheetComponent } from '@witqq/spreadsheet-angular';
import type { ColumnDef } from '@witqq/spreadsheet-angular';
import type { CellChangeEvent } from '@witqq/spreadsheet';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SpreadsheetComponent],
  template: `
    <witqq-spreadsheet
      [columns]="columns"
      [data]="data"
      [editable]="true"
      (cellChange)="onCellChange($event)"
    />
  `,
})
export class AppComponent {
  columns: ColumnDef[] = [
    { key: 'name', header: 'Name', width: 150 },
    { key: 'age', header: 'Age', width: 80, type: 'number' },
    { key: 'email', header: 'Email', width: 200 },
  ];

  data = [
    { name: 'Alice', age: 30, email: 'alice@example.com' },
    { name: 'Bob', age: 25, email: 'bob@example.com' },
  ];

  onCellChange(event: CellChangeEvent) {
    console.log('Changed:', event);
  }
}
```

---

## Inputs

All inputs map to `SpreadsheetEngineConfig` fields:

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `columns` | `ColumnDef[]` | Yes | — | Column definitions |
| `data` | `Record<string, unknown>[]` | No | — | Row data array |
| `rowCount` | `number` | No | `data.length` | Total row count |
| `theme` | `SpreadsheetTheme` | No | `lightTheme` | Visual theme |
| `frozenRows` | `number` | No | — | Rows frozen at top |
| `frozenColumns` | `number` | No | — | Columns frozen at left |
| `editable` | `boolean` | No | `false` | Enable inline cell editing |
| `sortable` | `boolean` | No | `false` | Enable column header click-to-sort |
| `showGridLines` | `boolean` | No | `true` | Show grid lines between cells |
| `showRowNumbers` | `boolean` | No | `true` | Show row number column |
| `rowHeight` | `number` | No | — | Default row height (pixels) |
| `headerHeight` | `number` | No | — | Header row height (pixels) |
| `width` | `number \| string` | No | — | Container width |
| `height` | `number \| string` | No | — | Container height |

### Input reactivity (ngOnChanges)

| Input | Reactive | Behavior |
|-------|----------|----------|
| `theme` | Yes | Calls `engine.setTheme()` on change (skips first change) |
| `data` | Yes | Clears cell store, bulk-loads new data, updates row count, re-renders (skips first change) |
| Other inputs | No | Read once at `ngOnInit` |

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| `cellChange` | `EventEmitter<CellChangeEvent>` | Cell value changes |
| `selectionChange` | `EventEmitter<SelectionChangeEvent>` | Selection changes |
| `sortChange` | `EventEmitter<SortChangeEvent>` | Sort state changes |
| `filterChange` | `EventEmitter<FilterChangeEvent>` | Filter state changes |
| `scroll` | `EventEmitter<ScrollEvent>` | Viewport scrolls |
| `ready` | `EventEmitter<void>` | Engine initialization completes |

> **Note:** Event payload types (`CellChangeEvent`, `SelectionChangeEvent`, `SortChangeEvent`, `FilterChangeEvent`, `ScrollEvent`) are not re-exported from this package. Import them from `@witqq/spreadsheet`.

```html
<witqq-spreadsheet
  [columns]="columns"
  [data]="data"
  (cellChange)="onCellChange($event)"
  (selectionChange)="onSelectionChange($event)"
  (ready)="onReady()"
/>
```

---

## Public Methods (ViewChild API)

Access the component instance via `@ViewChild` for imperative operations:

```typescript
import { Component, ViewChild } from '@angular/core';
import { SpreadsheetComponent } from '@witqq/spreadsheet-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SpreadsheetComponent],
  template: `
    <witqq-spreadsheet #spreadsheet [columns]="columns" [data]="data" />
    <button (click)="handleExport()">Export</button>
  `,
})
export class AppComponent {
  @ViewChild('spreadsheet') spreadsheet!: SpreadsheetComponent;

  handleExport() {
    const engine = this.spreadsheet.getInstance();
    // use engine API directly
  }
}
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getInstance` | `(): SpreadsheetEngine` | Get the underlying engine instance |
| `focus` | `(): void` | Focus the container element |
| `getSelection` | `(): Selection` | Get current selection state |
| `selectCell` | `(row: number, col: number): void` | Select a cell |
| `getCell` | `(row: number, col: number): CellData \| undefined` | Get cell data at position |
| `setCell` | `(row: number, col: number, value: CellValue): void` | Set cell value at position |
| `undo` | `(): void` | Undo the last command |
| `redo` | `(): void` | Redo the last undone command |
| `scrollTo` | `(x: number, y: number): void` | Scroll to position |
| `requestRender` | `(): void` | Force a re-render |
| `installPlugin` | `(plugin: SpreadsheetPlugin): void` | Install a plugin |
| `removePlugin` | `(name: string): void` | Remove a plugin by name |
| `print` | `(): void` | Trigger print dialog |

`getInstance` and `getSelection` throw `Error('Spreadsheet not initialized')` if called before `ngOnInit`. Other methods silently no-op.

---

## Theme Switching

The `theme` input is reactive via `ngOnChanges`:

```typescript
import { lightTheme, darkTheme } from '@witqq/spreadsheet-angular';
import type { SpreadsheetTheme } from '@witqq/spreadsheet-angular';

@Component({
  template: `
    <button (click)="toggleTheme()">Toggle Theme</button>
    <witqq-spreadsheet [columns]="columns" [data]="data" [theme]="currentTheme" />
  `,
})
export class AppComponent {
  currentTheme: SpreadsheetTheme = lightTheme;

  toggleTheme() {
    this.currentTheme = this.currentTheme === lightTheme ? darkTheme : lightTheme;
  }
}
```

---

## Re-exported Values and Types

**Values:** `SpreadsheetEngine`, `lightTheme`, `darkTheme` — re-exported from `@witqq/spreadsheet`.

**Data types:** `CellData`, `CellValue`, `CellStyle`, `CellType`, `ColumnDef`, `Selection`

**System types:** `SpreadsheetEvents`, `SpreadsheetPlugin`, `SpreadsheetTheme`

Event payload types are not re-exported. Import them from `@witqq/spreadsheet`.

For per-cell styling (`CellStyleRef`, `BorderStyle`, `StylePool`) and cell decorators (`CellDecorator`, `CellDecoratorRegistration`), import directly from `@witqq/spreadsheet` and use via the engine instance from `@ViewChild` `getInstance()`.

---

## Component Lifecycle

1. **`ngOnInit`:** Engine created with input values, mounted to template container `<div>`. EventBus handlers wired to `EventEmitter` outputs.
2. **`ngOnChanges` (`data`):** Cell store cleared, new data bulk-loaded, row count updated, re-render triggered (skips first change).
3. **`ngOnChanges` (`theme`):** `engine.setTheme()` called if theme reference changed (skips first change).
4. **`ngOnDestroy`:** All EventBus handlers unsubscribed. Engine destroyed.

---

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.dev/pricing](https://spreadsheet.witqq.dev/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
