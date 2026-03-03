import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];
const data = generateRows(8);

export function DemoPluginShowcase() {
  return (
    <ScenarioContainer width={600} height={300}>
      <Spreadsheet columns={columns} data={data} showRowNumbers editable style={tableStyle} />
    </ScenarioContainer>
  );
}
