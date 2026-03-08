# @witqq/spreadsheet-widget

Embeddable spreadsheet widget — single IIFE/UMD bundle with zero framework dependencies. No build step required.

```bash
npm install @witqq/spreadsheet-widget
```

Or load via script tag:

```html
<script src="https://unpkg.com/@witqq/spreadsheet-widget"></script>
```

The UMD build exposes a global `Spreadsheet` object (configured in vite as `name: 'Spreadsheet'`).

## Exports

### Value Exports (5)

| Export | Kind | Description |
|--------|------|-------------|
| `create` | function | Create and mount a spreadsheet in a container |
| `embed` | function | Create a spreadsheet with a destroy handle |
| `SpreadsheetEngine` | class | Re-exported from `@witqq/spreadsheet` |
| `lightTheme` | object | Re-exported from `@witqq/spreadsheet` |
| `darkTheme` | object | Re-exported from `@witqq/spreadsheet` |

### Type Exports (7)

| Type | Source |
|------|--------|
| `WidgetConfig` | Local — extends `SpreadsheetEngineConfig` |
| `SpreadsheetEngineConfig` | Re-exported from `@witqq/spreadsheet` |
| `ColumnDef` | Re-exported from `@witqq/spreadsheet` |
| `CellData` | Re-exported from `@witqq/spreadsheet` |
| `CellValue` | Re-exported from `@witqq/spreadsheet` |
| `Selection` | Re-exported from `@witqq/spreadsheet` |
| `CellAddress` | Re-exported from `@witqq/spreadsheet` |

## `create(container, config): SpreadsheetEngine`

Create a spreadsheet inside the given container. Returns the `SpreadsheetEngine` instance.

```typescript
import { create } from '@witqq/spreadsheet-widget';

const engine = create('#spreadsheet', {
  columns: [
    { key: 'name', title: 'Name', width: 150 },
    { key: 'value', title: 'Value', width: 100 },
  ],
  data: [
    { name: 'Item 1', value: 100 },
    { name: 'Item 2', value: 200 },
  ],
  height: 400,
});
```

| Param | Type | Description |
|-------|------|-------------|
| `container` | `HTMLElement \| string` | DOM element or CSS selector |
| `config` | `WidgetConfig` | Engine configuration |

Throws `"Spreadsheet.create: container not found"` if the container element cannot be resolved.

## `embed(container, config): { engine, destroy }`

Convenience wrapper around `create()` that returns a handle with `destroy()`.

```typescript
import { embed } from '@witqq/spreadsheet-widget';

const { engine, destroy } = embed('#spreadsheet', {
  columns: [{ key: 'id', title: 'ID', width: 80 }],
  data: [],
});

// Later: clean up
destroy();
```

Returns `{ engine: SpreadsheetEngine, destroy: () => void }`.

## `WidgetConfig`

```typescript
interface WidgetConfig extends SpreadsheetEngineConfig {
  autoMount?: boolean;  // Default: true
}
```

When `autoMount` is `true` (default), the engine mounts into the container immediately. Set to `false` to defer mounting.

## Script Tag Usage

```html
<div id="grid" style="width: 800px; height: 400px"></div>
<script src="https://unpkg.com/@witqq/spreadsheet-widget"></script>
<script>
  const engine = Spreadsheet.create(document.getElementById('grid'), {
    columns: [
      { key: 'name', title: 'Name', width: 200 },
      { key: 'age', title: 'Age', width: 100, type: 'number' },
    ],
    data: [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ],
    theme: Spreadsheet.lightTheme,
  });
</script>
```

Global `Spreadsheet` exposes: `create`, `embed`, `SpreadsheetEngine`, `lightTheme`, `darkTheme`.

## Build Output

| File | Format | Description |
|------|--------|-------------|
| `dist/witqq-spreadsheet-widget.js` | ES module | For bundlers and `type="module"` scripts |
| `dist/witqq-spreadsheet-widget.umd.cjs` | UMD/IIFE | For `<script>` tags, exposes `Spreadsheet` global |
| `dist/index.d.ts` | TypeScript | Rolled-up type declarations |

The bundle includes `@witqq/spreadsheet` — no external dependencies required.

## License

[Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE). Free for non-commercial use. Change Date: 2030-03-01 → Apache License 2.0.
