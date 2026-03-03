# @witqq/spreadsheet-react

> React wrapper for the witqq Canvas spreadsheet engine.

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet-react.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-react)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet-react.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet-react @witqq/spreadsheet
```

**Peer dependencies:** React 18+ or 19+.

## Quick Start

```tsx
import { WitTable } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet-react';

interface Person {
  name: string;
  age: number;
  email: string;
}

const columns: ColumnDef[] = [
  { key: 'name', header: 'Name', width: 150 },
  { key: 'age', header: 'Age', width: 80, type: 'number' },
  { key: 'email', header: 'Email', width: 200 },
];

const data: Person[] = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' },
];

function App() {
  return (
    <WitTable<Person>
      columns={columns}
      data={data}
      onCellChange={(e) => console.log('Changed:', e)}
    />
  );
}
```

## Props

`WitTableProps<TRow>` extends all `WitEngineConfig` options plus:

| Prop | Type | Description |
|------|------|-------------|
| `data` | `TRow[]` | Row data array |
| `columns` | `ColumnDef[]` | Column definitions |
| `className` | `string` | CSS class for container |
| `style` | `CSSProperties` | Inline styles for container |
| `onCellChange` | `(e: CellChangeEvent) => void` | Cell value changed |
| `onSelectionChange` | `(e: SelectionChangeEvent) => void` | Selection changed |
| `onSortChange` | `(e: SortChangeEvent) => void` | Sort changed |
| `onFilterChange` | `(e: FilterChangeEvent) => void` | Filter changed |

## Ref API

Use `useRef<WitTableRef>` for imperative access:

```tsx
import { useRef } from 'react';
import { WitTable } from '@witqq/spreadsheet-react';
import type { WitTableRef } from '@witqq/spreadsheet-react';

function App() {
  const tableRef = useRef<WitTableRef>(null);

  const handleClick = () => {
    const engine = tableRef.current?.getInstance();
    tableRef.current?.selectCell(0, 0);
  };

  return <WitTable ref={tableRef} columns={columns} data={data} />;
}
```

### Ref Methods

| Method | Description |
|--------|-------------|
| `getInstance()` | Get underlying `WitEngine` |
| `focus()` | Focus the table container |
| `getSelection()` | Get current selection state |
| `selectCell(row, col)` | Select a cell |
| `getCell(row, col)` | Get cell data |
| `setCell(row, col, value)` | Set cell value |
| `undo()` / `redo()` | Undo/redo commands |

## Documentation

Full documentation and live demos: [spreadsheet.witqq.ru](https://spreadsheet.witqq.ru)

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.ru/pricing](https://spreadsheet.witqq.ru/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
