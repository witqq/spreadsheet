import type { ColumnDef } from '@witqq/spreadsheet';

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack', 'Karen', 'Leo', 'Mona', 'Nick', 'Olivia', 'Paul', 'Quinn', 'Rita', 'Sam', 'Tina'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Support', 'Legal'];
const CITIES = ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Sydney', 'Toronto', 'Singapore'];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface EmployeeRow {
  [key: string]: unknown;
  id: number;
  name: string;
  department: string;
  salary: number;
  city: string;
  startDate: string;
  active: boolean;
}

export const employeeColumns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 160, type: 'string' },
  { key: 'department', title: 'Department', width: 130, type: 'string' },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'city', title: 'City', width: 120, type: 'string' },
  { key: 'startDate', title: 'Start Date', width: 110, type: 'date' },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];

export function generateEmployees(count: number, seed = 42): EmployeeRow[] {
  const rng = seededRandom(seed);
  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    department: pick(DEPARTMENTS),
    salary: Math.round(40000 + rng() * 80000),
    city: pick(CITIES),
    startDate: `${2015 + Math.floor(rng() * 10)}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`,
    active: rng() > 0.2,
  }));
}
