# @witqq/spreadsheet-vue

Vue 3 wrapper for the witqq Canvas spreadsheet engine.

## Installation

```bash
npm install @witqq/spreadsheet-vue @witqq/spreadsheet
```

## Usage

```vue
<script setup lang="ts">
import { WitTable } from '@witqq/spreadsheet-vue';
import type { ColumnDef } from '@witqq/spreadsheet';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name', width: 150 },
  { key: 'value', title: 'Value', width: 100 },
];

const rows = [
  { name: 'Item 1', value: 100 },
  { name: 'Item 2', value: 200 },
];
</script>

<template>
  <WitTable :columns="columns" :rows="rows" :height="400" />
</template>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `columns` | `ColumnDef[]` | Column definitions |
| `rows` | `TRow[]` | Data rows |
| `height` | `number` | Container height in pixels |
| `theme` | `WitTheme` | Theme configuration |
| `options` | `WitEngineOptions` | Engine options |

## Documentation

Full documentation: https://spreadsheet.witqq.dev/frameworks/vue

## License

BSL 1.1 — see [LICENSE](./LICENSE)
