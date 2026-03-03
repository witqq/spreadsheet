import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 400, type: 'number' },
  { key: 'name', title: 'Full Name', width: 400 },
  { key: 'email', title: 'Email Address', width: 400 },
  { key: 'department', title: 'Department', width: 400 },
];

const data = generateRows(20);

export function ColumnsWide() {
  return (
    <ScenarioContainer width={800} height={400}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
