# @witqq/spreadsheet-react

> React wrapper for the witqq Canvas spreadsheet engine.

[![npm version](https://img.shields.io/npm/v/@witqq/spreadsheet-react.svg)](https://www.npmjs.com/package/@witqq/spreadsheet-react)
[![license](https://img.shields.io/npm/l/@witqq/spreadsheet-react.svg)](https://github.com/witqq/spreadsheet/blob/master/LICENSE)

## Installation

```bash
npm install @witqq/spreadsheet-react @witqq/spreadsheet
```

**Peer dependencies:** `react` and `react-dom` — version 18+ or 19+.

## Exports

```ts
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type {
  SpreadsheetProps,
  SpreadsheetRef,
  SpreadsheetCallbacks,
} from '@witqq/spreadsheet-react';

// Re-exported core types (convenience — also available from @witqq/spreadsheet)
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
} from '@witqq/spreadsheet-react';

// Re-exported event types (convenience — also available from @witqq/spreadsheet)
import type {
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet-react';
```

---

## Quick Start

```tsx
import { Spreadsheet } from '@witqq/spreadsheet-react';
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
    <Spreadsheet<Person>
      columns={columns}
      data={data}
      onCellChange={(e) => console.log('Changed:', e)}
    />
  );
}
```

---

## Spreadsheet Component

The `Spreadsheet` component is a generic `forwardRef` component accepting a row type parameter `TRow`.

```tsx
<Spreadsheet<TRow> {...props} ref={ref} />
```

`TRow` defaults to `Record<string, unknown>`. Providing a concrete type enables type-safe data binding.

---

## SpreadsheetProps\<TRow\>

`SpreadsheetProps<TRow>` extends `Omit<SpreadsheetEngineConfig, 'data'>` and `SpreadsheetCallbacks`.

```ts
interface SpreadsheetProps<TRow extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<SpreadsheetEngineConfig, 'data'>, SpreadsheetCallbacks {
  data?: TRow[];
  className?: string;
  style?: React.CSSProperties;
}
```

### Component-specific props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `TRow[]` | Row data array (generic over row type) |
| `className` | `string` | CSS class for the container `<div>` |
| `style` | `React.CSSProperties` | Inline styles for the container `<div>` |

### Engine config props (from SpreadsheetEngineConfig)

All fields from `SpreadsheetEngineConfig` (except `data`, which is replaced by the generic `TRow[]` version above) are accepted as props. See the core package README for full details. Key props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef[]` | *(required)* | Column definitions |
| `rowCount` | `number` | `data.length` | Total row count |
| `width` | `number \| string` | — | Container width |
| `height` | `number \| string` | — | Container height |
| `editable` | `boolean` | `false` | Enable inline cell editing |
| `sortable` | `boolean` | `false` | Enable column header click-to-sort |
| `frozenRows` | `number` | — | Rows frozen at top |
| `frozenColumns` | `number` | — | Columns frozen at left |
| `rowHeight` | `number` | — | Default row height (pixels) |
| `headerHeight` | `number` | — | Header row height (pixels) |
| `showGridLines` | `boolean` | `true` | Show grid lines between cells |
| `showRowNumbers` | `boolean` | `true` | Show row number column |
| `theme` | `SpreadsheetTheme` | `lightTheme` | Visual theme |
| `autoRowHeight` | `boolean \| AutoRowSizeConfig` | `false` | Auto-size rows to content |
| `stretchColumns` | `'all' \| 'last'` | — | Stretch columns to fill container width |
| `locale` | `SpreadsheetLocale` | English | Locale for UI strings |

### Prop reactivity

| Prop | Reactive | Behavior |
|------|----------|----------|
| `theme` | Yes | Calls `engine.setTheme()` on change |
| `data` | Yes | Clears cell store, bulk-loads new data, updates row count, re-renders |
| Other engine props | No | Read once at mount; changing them requires remount |

---

## SpreadsheetCallbacks

```ts
interface SpreadsheetCallbacks {
  onCellChange?: (event: CellChangeEvent) => void;
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  onSortChange?: (event: SortChangeEvent) => void;
  onFilterChange?: (event: FilterChangeEvent) => void;
  onScroll?: (event: ScrollEvent) => void;
  onReady?: () => void;
}
```

| Callback | Event Type | Fires when |
|----------|-----------|------------|
| `onCellChange` | `CellChangeEvent` | Cell value changes |
| `onSelectionChange` | `SelectionChangeEvent` | Selection changes |
| `onSortChange` | `SortChangeEvent` | Sort state changes |
| `onFilterChange` | `FilterChangeEvent` | Filter state changes |
| `onScroll` | `ScrollEvent` | Viewport scrolls |
| `onReady` | *(none)* | Engine initialization completes |

Callbacks are stored in refs internally, so they do not cause re-subscription when the function identity changes.

---

## SpreadsheetRef (Ref API)

Use `useRef<SpreadsheetRef>` for imperative access to the underlying engine.

```tsx
import { useRef } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';

function App() {
  const ref = useRef<SpreadsheetRef>(null);

  const handleExport = () => {
    const engine = ref.current?.getInstance();
    // use engine API directly
  };

  return <Spreadsheet ref={ref} columns={columns} data={data} />;
}
```

### Ref Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getInstance` | `(): SpreadsheetEngine` | Get the underlying `SpreadsheetEngine` instance |
| `focus` | `(): void` | Focus the container element |
| `getSelection` | `(): Selection` | Get current selection state |
| `selectCell` | `(row: number, col: number): void` | Select a cell by row and column index |
| `getCell` | `(row: number, col: number): CellData \| undefined` | Get cell data at position |
| `setCell` | `(row: number, col: number, value: CellValue): void` | Set cell value at position |
| `undo` | `(): void` | Undo the last command |
| `redo` | `(): void` | Redo the last undone command |
| `scrollTo` | `(x: number, y: number): void` | Scroll to position |
| `requestRender` | `(): void` | Force a re-render |
| `installPlugin` | `(plugin: SpreadsheetPlugin): void` | Install a plugin |
| `removePlugin` | `(name: string): void` | Remove a plugin by name |
| `print` | `(): void` | Trigger print dialog |

Methods throw `Error('Spreadsheet not mounted')` if called before the component mounts (`getInstance`, `getSelection`). Other methods silently no-op via optional chaining.

---

## TypeScript Generic Row Type

The component accepts a type parameter `TRow` that constrains the `data` prop:

```tsx
interface Order {
  id: number;
  product: string;
  quantity: number;
  price: number;
}

// data prop is typed as Order[]
<Spreadsheet<Order>
  columns={orderColumns}
  data={orders}
  onCellChange={(e) => {
    // e is CellChangeEvent
  }}
/>
```

`TRow` must extend `Record<string, unknown>`. If omitted, defaults to `Record<string, unknown>`.

---

## Controlled Data Pattern

When the `data` prop changes (by reference), the component:

1. Clears the internal `CellStore`
2. Bulk-loads the new data using column keys
3. Updates the row count
4. Triggers a re-render

```tsx
function App() {
  const [data, setData] = useState<Person[]>(initialData);

  const handleAdd = () => {
    setData([...data, newRow]);
  };

  return <Spreadsheet<Person> columns={columns} data={data} />;
}
```

---

## Plugin Installation

Plugins can be installed via the ref API or through the engine instance:

```tsx
import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef, SpreadsheetPlugin } from '@witqq/spreadsheet-react';

function App() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.installPlugin(myPlugin);
    }
  }, []);

  return <Spreadsheet ref={ref} columns={columns} data={data} />;
}
```

---

## Theme Switching

The `theme` prop is reactive. Changing it updates the engine theme without remounting:

```tsx
import { useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';

function App() {
  const [theme, setTheme] = useState(lightTheme);

  return (
    <>
      <button onClick={() => setTheme(darkTheme)}>Dark</button>
      <Spreadsheet columns={columns} data={data} theme={theme} />
    </>
  );
}
```

---

## Re-exported Core Types

The following types are re-exported from `@witqq/spreadsheet` for convenience. They are identical to importing directly from the core package.

**Data types:** `CellData`, `CellValue`, `CellStyle`, `CellType`, `ColumnDef`, `Selection`

**System types:** `SpreadsheetEvents`, `SpreadsheetPlugin`, `SpreadsheetTheme`

**Event types:** `CellChangeEvent`, `SelectionChangeEvent`, `SortChangeEvent`, `FilterChangeEvent`, `ScrollEvent`

---

## Component Lifecycle

1. **Mount:** Engine created with props (excluding callbacks and `className`/`style`). Mounted to container `<div>`. EventBus handlers wired for all callbacks.
2. **Update `data`:** Cell store cleared, new data bulk-loaded, row count updated, re-render triggered.
3. **Update `theme`:** `engine.setTheme()` called if theme reference changed.
4. **Unmount:** All EventBus handlers unsubscribed. Engine destroyed. Ref cleared.

---

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.dev/pricing](https://spreadsheet.witqq.dev/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
