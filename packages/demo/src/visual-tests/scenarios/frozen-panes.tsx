import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number', frozen: true },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 60, type: 'number' },
  { key: 'department', title: 'Department', width: 130 },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];

const data = generateRows(50);

export function FrozenPanes() {
  return (
    <ScenarioContainer width={500} height={400}>
      <Spreadsheet
        columns={columns}
        data={data}
        frozenRows={2}
        frozenColumns={1}
        style={tableStyle}
      />
    </ScenarioContainer>
  );
}
