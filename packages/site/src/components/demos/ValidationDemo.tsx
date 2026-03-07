import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  {
    key: 'name',
    title: 'Name',
    width: 160,
    validation: [{ type: 'required', message: 'Name is required', severity: 'error' }],
  },
  {
    key: 'email',
    title: 'Email',
    width: 200,
    validation: [
      { type: 'required', message: 'Email is required', severity: 'error' },
      {
        type: 'regex',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        message: 'Invalid email format',
        severity: 'error',
      },
    ],
  },
  {
    key: 'age',
    title: 'Age',
    width: 80,
    type: 'number',
    validation: [
      { type: 'range', min: 0, max: 150, message: 'Age must be 0-150', severity: 'error' },
    ],
  },
  {
    key: 'salary',
    title: 'Salary',
    width: 100,
    type: 'number',
    validation: [
      { type: 'range', min: 0, max: 1000000, message: 'Salary must be 0-1M', severity: 'warning' },
    ],
  },
  { key: 'department', title: 'Department', width: 130 },
];

const data = [
  {
    name: 'Alice Smith',
    email: 'alice@example.com',
    age: 30,
    salary: 75000,
    department: 'Engineering',
  },
  { name: '', email: 'invalid-email', age: -5, salary: 50000, department: 'Sales' },
  { name: 'Carol Brown', email: '', age: 200, salary: 2000000, department: 'HR' },
  {
    name: 'David Jones',
    email: 'david@example.com',
    age: 45,
    salary: 90000,
    department: 'Finance',
  },
  { name: '', email: '', age: 0, salary: 0, department: '' },
];

export function ValidationDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper
      title="Live Demo"
      description="Row 2 has invalid email and negative age. Row 3 has missing email, age >150, and salary warning. Hover over error cells to see tooltips."
      height={300}
    >
      <Spreadsheet
        theme={witTheme}
        columns={columns}
        data={data}
        showRowNumbers
        editable
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
