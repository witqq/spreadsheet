import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'department', title: 'Department', width: 130 },
];
const data = generateRows(10);

export function DemoEventBus() {
  return (
    <ScenarioContainer width={600} height={300}>
      <Spreadsheet columns={columns} data={data} showRowNumbers editable style={tableStyle} />
    </ScenarioContainer>
  );
}
