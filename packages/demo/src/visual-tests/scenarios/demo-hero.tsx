import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Employee', width: 140 },
  { key: 'role', title: 'Role', width: 130 },
  { key: 'department', title: 'Department', width: 110 },
  { key: 'salary', title: 'Salary', width: 90, type: 'number' },
  { key: 'status', title: 'Status', width: 80 },
];

const data = [
  {
    name: 'Alice Chen',
    role: 'Senior Engineer',
    department: 'Engineering',
    salary: 145000,
    status: 'Active',
  },
  {
    name: 'Bob Smith',
    role: 'Product Manager',
    department: 'Product',
    salary: 135000,
    status: 'Active',
  },
  { name: 'Carol Davis', role: 'Designer', department: 'Design', salary: 115000, status: 'Active' },
  {
    name: 'David Lee',
    role: 'DevOps Lead',
    department: 'Infrastructure',
    salary: 140000,
    status: 'Active',
  },
  {
    name: 'Eve Wilson',
    role: 'Data Analyst',
    department: 'Analytics',
    salary: 105000,
    status: 'On Leave',
  },
  {
    name: 'Frank Brown',
    role: 'QA Engineer',
    department: 'Engineering',
    salary: 110000,
    status: 'Active',
  },
];

export function DemoHero() {
  return (
    <ScenarioContainer width={600} height={280}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
