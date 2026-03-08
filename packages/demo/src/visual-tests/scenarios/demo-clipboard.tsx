import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'item', title: 'Item', width: 150 },
  { key: 'qty', title: 'Quantity', width: 100, type: 'number' },
  { key: 'price', title: 'Price', width: 100, type: 'number' },
  { key: 'note', title: 'Notes', width: 200 },
];
const data = [
  { item: 'Widget A', qty: 10, price: 9.99, note: 'In stock' },
  { item: 'Widget B', qty: 5, price: 14.5, note: 'Low stock' },
  { item: 'Gadget C', qty: 0, price: 29.99, note: 'Out of stock' },
  { item: 'Gadget D', qty: 25, price: 7.25, note: 'Bulk order' },
  { item: 'Part E', qty: 100, price: 1.5, note: 'Standard' },
];

export function DemoClipboard() {
  return (
    <ScenarioContainer width={580} height={250}>
      <Spreadsheet columns={columns} data={data} editable showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
