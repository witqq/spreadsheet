import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 40, type: 'number' },
  { key: 'name', title: 'Name', width: 40 },
  { key: 'email', title: 'Email', width: 40 },
  { key: 'age', title: 'Age', width: 40, type: 'number' },
  { key: 'department', title: 'Department', width: 40 },
  { key: 'salary', title: 'Salary', width: 40, type: 'number' },
  { key: 'active', title: 'Active', width: 40, type: 'boolean' },
];

const data = generateRows(30);

export function ColumnsNarrow() {
  return (
    <ScenarioContainer width={500} height={400}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
