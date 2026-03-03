import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'seq', title: 'Sequence', width: 100, type: 'number' },
  { key: 'doubled', title: 'Doubled', width: 100, type: 'number' },
  { key: 'label', title: 'Label', width: 150 },
  { key: 'value', title: 'Value', width: 100, type: 'number' },
];
const data = [
  { seq: 1, doubled: 2, label: 'Item 1', value: 10 },
  { seq: 2, doubled: 4, label: 'Item 2', value: 20 },
  { seq: 3, doubled: 6, label: 'Item 3', value: 30 },
  { seq: 4, doubled: 8, label: '', value: 0 },
  { seq: 5, doubled: 10, label: '', value: 0 },
  { seq: 0, doubled: 0, label: '', value: 0 },
  { seq: 0, doubled: 0, label: '', value: 0 },
  { seq: 0, doubled: 0, label: '', value: 0 },
];

export function DemoAutofill() {
  return (
    <ScenarioContainer width={500} height={300}>
      <Spreadsheet columns={columns} data={data} editable showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
