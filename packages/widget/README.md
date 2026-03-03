# @witqq/spreadsheet-widget

Embeddable spreadsheet widget — single IIFE/UMD bundle with zero framework dependencies.

## Installation

```bash
npm install @witqq/spreadsheet-widget
```

Or use from CDN:

```html
<script src="https://unpkg.com/@witqq/spreadsheet-widget"></script>
```

## Usage

```html
<div id="spreadsheet"></div>
<script>
  WitTable.create(document.getElementById('spreadsheet'), {
    columns: [
      { key: 'name', title: 'Name', width: 150 },
      { key: 'value', title: 'Value', width: 100 },
    ],
    rows: [
      { name: 'Item 1', value: 100 },
      { name: 'Item 2', value: 200 },
    ],
    height: 400,
  });
</script>
```

## Bundle Size

< 36KB gzipped, includes `@witqq/spreadsheet`.

## Documentation

Full documentation: https://spreadsheet.witqq.dev/frameworks/widget

## License

BSL 1.1 — see [LICENSE](./LICENSE)
