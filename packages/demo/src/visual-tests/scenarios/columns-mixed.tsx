import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 40, type: 'number' },
  { key: 'name', title: 'Full Name', width: 300 },
  { key: 'email', title: 'Email', width: 50 },
  { key: 'age', title: 'Age', width: 40, type: 'number' },
  { key: 'department', title: 'Department', width: 250 },
  { key: 'salary', title: 'Salary', width: 50, type: 'number' },
  { key: 'active', title: 'Active', width: 40, type: 'boolean' },
];

const data = generateRows(30);

export function ColumnsMixed() {
  return (
    <ScenarioContainer width={800} height={400}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
