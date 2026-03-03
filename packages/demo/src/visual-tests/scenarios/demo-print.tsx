import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 80, type: 'number' },
  { key: 'department', title: 'Department', width: 130 },
];
const data = generateRows(15);

export function DemoPrint() {
  return (
    <ScenarioContainer width={660} height={350}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
