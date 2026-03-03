import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'department', title: 'Department', width: 130 },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
];
const data = generateRows(10);

export function DemoExcel() {
  return (
    <ScenarioContainer width={500} height={300}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
