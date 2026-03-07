import type { ColumnDef } from '@witqq/spreadsheet';
import type { ReactNode } from 'react';

export const standardColumns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 60, type: 'number' },
  { key: 'department', title: 'Department', width: 130 },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];

const firstNames = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const departments = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Operations',
  'Legal',
  'Support',
];

export function generateRows(count: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      email: `${firstNames[i % firstNames.length].toLowerCase()}@example.com`,
      age: 25 + (i % 40),
      department: departments[i % departments.length],
      salary: 50000 + (i % 10) * 5000,
      active: i % 3 !== 0,
    });
  }
  return rows;
}

export function ScenarioContainer({
  width,
  height,
  background,
  children,
}: {
  width: number;
  height: number;
  background?: string;
  children: ReactNode;
}) {
  return <div style={{ width, height, background }}>{children}</div>;
}

export const tableStyle = { width: '100%' as const, height: '100%' as const };
