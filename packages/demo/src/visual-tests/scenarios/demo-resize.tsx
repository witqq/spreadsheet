import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 50, minWidth: 40, maxWidth: 80, type: 'number' },
  { key: 'name', title: 'Name (resizable)', width: 200, minWidth: 100, maxWidth: 400 },
  { key: 'email', title: 'Email', width: 180, minWidth: 120 },
  { key: 'department', title: 'Department', width: 100, minWidth: 80, maxWidth: 200 },
  { key: 'salary', title: 'Salary', width: 120, type: 'number' },
];
const data = generateRows(20);

export function DemoResize() {
  return (
    <ScenarioContainer width={700} height={300}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
