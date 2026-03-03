# @witqq/spreadsheet-angular

Angular wrapper for the witqq Canvas spreadsheet engine.

## Installation

```bash
npm install @witqq/spreadsheet-angular @witqq/spreadsheet
```

## Usage

```typescript
import { WitTableComponent } from '@witqq/spreadsheet-angular';

@Component({
  standalone: true,
  imports: [WitTableComponent],
  template: `
    <witqq spreadsheet
      [columns]="columns"
      [rows]="rows"
      [height]="400"
      (cellChange)="onCellChange($event)"
    />
  `,
})
export class MyComponent {
  columns: ColumnDef[] = [
    { key: 'name', title: 'Name', width: 150 },
    { key: 'value', title: 'Value', width: 100 },
  ];
  rows = [
    { name: 'Item 1', value: 100 },
    { name: 'Item 2', value: 200 },
  ];
}
```

## Inputs

| Input | Type | Description |
|-------|------|-------------|
| `columns` | `ColumnDef[]` | Column definitions |
| `rows` | `TRow[]` | Data rows |
| `height` | `number` | Container height in pixels |
| `theme` | `WitTheme` | Theme configuration |
| `options` | `WitEngineOptions` | Engine options |

## Documentation

Full documentation: https://spreadsheet.witqq.dev/frameworks/angular

## License

BSL 1.1 — see [LICENSE](./LICENSE)
