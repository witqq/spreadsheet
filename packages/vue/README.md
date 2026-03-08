# @witqq/spreadsheet-vue

> Vue 3 wrapper for the witqq Canvas spreadsheet engine.

## Installation

```bash
npm install @witqq/spreadsheet-vue @witqq/spreadsheet
```

**Peer dependency:** `vue` version 3.3+.

## Exports

```ts
import { Spreadsheet, SpreadsheetEngine, lightTheme, darkTheme } from '@witqq/spreadsheet-vue';
import type { SpreadsheetExposed } from '@witqq/spreadsheet-vue';

// Re-exported event types (convenience — also available from @witqq/spreadsheet)
import type {
  CellChangeEvent,
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  ScrollEvent,
} from '@witqq/spreadsheet-vue';

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
} from '@witqq/spreadsheet-vue';
```

---

## Quick Start

```vue
<script setup lang="ts">
import { Spreadsheet } from '@witqq/spreadsheet-vue';
import type { ColumnDef } from '@witqq/spreadsheet-vue';

const columns: ColumnDef[] = [
  { key: 'name', header: 'Name', width: 150 },
  { key: 'age', header: 'Age', width: 80, type: 'number' },
  { key: 'email', header: 'Email', width: 200 },
];

const data = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' },
];
</script>

<template>
  <Spreadsheet
    :columns="columns"
    :data="data"
    :editable="true"
    @cellChange="(e) => console.log('Changed:', e)"
  />
</template>
```

---

## Props

The component accepts engine configuration props via `v-bind`:

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
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

### Prop reactivity

| Prop | Reactive | Behavior |
|------|----------|----------|
| `theme` | Yes | Calls `engine.setTheme()` on change |
| `data` | Yes | Clears cell store, bulk-loads new data, updates row count, re-renders |
| Other props | No | Read once at mount |

---

## Events

Events are emitted via Vue's `emit` and can be listened to with `@eventName` or `v-on:eventName`:

| Event | Payload Type | Description |
|-------|-------------|-------------|
| `cellChange` | `CellChangeEvent` | Cell value changes |
| `selectionChange` | `SelectionChangeEvent` | Selection changes |
| `sortChange` | `SortChangeEvent` | Sort state changes |
| `filterChange` | `FilterChangeEvent` | Filter state changes |
| `scroll` | `ScrollEvent` | Viewport scrolls |
| `ready` | *(none)* | Engine initialization completes |

```vue
<template>
  <Spreadsheet
    :columns="columns"
    :data="data"
    @cellChange="onCellChange"
    @selectionChange="onSelectionChange"
    @ready="onReady"
  />
</template>
```

---

## SpreadsheetExposed (Template Ref API)

Access the underlying engine via template refs:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Spreadsheet } from '@witqq/spreadsheet-vue';
import type { SpreadsheetExposed } from '@witqq/spreadsheet-vue';

const spreadsheetRef = ref<InstanceType<typeof Spreadsheet> & SpreadsheetExposed>();

function handleExport() {
  const engine = spreadsheetRef.value?.getInstance();
  // use engine API directly
}
</script>

<template>
  <Spreadsheet ref="spreadsheetRef" :columns="columns" :data="data" />
</template>
```

### Exposed Methods

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

`getInstance` and `getSelection` throw `Error('Spreadsheet not mounted')` if called before mount. Other methods silently no-op.

---

## Theme Switching

The `theme` prop is reactive. Changing it updates the engine theme without remounting:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Spreadsheet, lightTheme, darkTheme } from '@witqq/spreadsheet-vue';

const currentTheme = ref(lightTheme);
</script>

<template>
  <button @click="currentTheme = darkTheme">Dark</button>
  <Spreadsheet :columns="columns" :data="data" :theme="currentTheme" />
</template>
```

---

## Controlled Data Pattern

When the `data` prop changes, the component:

1. Clears the internal `CellStore`
2. Bulk-loads the new data using column keys
3. Updates the row count
4. Triggers a re-render

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Spreadsheet } from '@witqq/spreadsheet-vue';

const data = ref([{ name: 'Alice', age: 30 }]);

function addRow() {
  data.value = [...data.value, { name: 'Bob', age: 25 }];
}
</script>

<template>
  <button @click="addRow">Add</button>
  <Spreadsheet :columns="columns" :data="data" />
</template>
```

---

## Re-exported Values and Types

**Values:** `SpreadsheetEngine`, `lightTheme`, `darkTheme` — re-exported from `@witqq/spreadsheet` for convenience.

**Data types:** `CellData`, `CellValue`, `CellStyle`, `CellType`, `ColumnDef`, `Selection`

**System types:** `SpreadsheetEvents`, `SpreadsheetPlugin`, `SpreadsheetTheme`

**Event types:** `CellChangeEvent`, `SelectionChangeEvent`, `SortChangeEvent`, `FilterChangeEvent`, `ScrollEvent`

---

## Component Lifecycle

1. **Mount (`onMounted`):** Engine created with props, mounted to container `<div>`. EventBus handlers wired for all emits.
2. **Watch `data`:** Cell store cleared, new data bulk-loaded, row count updated, re-render triggered.
3. **Watch `theme`:** `engine.setTheme()` called if theme reference changed.
4. **Unmount (`onUnmounted`):** All EventBus handlers unsubscribed. Engine destroyed.

---

## License

Licensed under the [Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE).

**Free** for non-commercial use (personal, educational, academic, non-commercial open source).
**Commercial use** requires a paid license — see [spreadsheet.witqq.dev/pricing](https://spreadsheet.witqq.dev/pricing).

Change Date: 2030-03-01 → Apache License 2.0.
