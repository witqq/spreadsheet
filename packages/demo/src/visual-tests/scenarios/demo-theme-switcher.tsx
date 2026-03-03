import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { darkTheme } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'department', title: 'Department', width: 130 },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];
const data = generateRows(15);

export function DemoThemeSwitcher() {
  return (
    <ScenarioContainer width={550} height={350} background="#1e1e2e">
      <Spreadsheet columns={columns} data={data} theme={darkTheme} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
