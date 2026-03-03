import { describe, it, expect } from 'vitest';
import { generateEmployees, employeeColumns } from '../src/components/demos/generate-data';

describe('generateEmployees', () => {
  it('produces the requested number of rows', () => {
    expect(generateEmployees(0)).toHaveLength(0);
    expect(generateEmployees(10)).toHaveLength(10);
    expect(generateEmployees(500)).toHaveLength(500);
  });

  it('produces deterministic output with same seed', () => {
    const a = generateEmployees(5, 42);
    const b = generateEmployees(5, 42);
    expect(a).toEqual(b);
  });

  it('produces different output with different seeds', () => {
    const a = generateEmployees(5, 1);
    const b = generateEmployees(5, 2);
    expect(a).not.toEqual(b);
  });

  it('produces rows with correct field types', () => {
    const rows = generateEmployees(3);
    for (const row of rows) {
      expect(typeof row.id).toBe('number');
      expect(typeof row.name).toBe('string');
      expect(typeof row.department).toBe('string');
      expect(typeof row.salary).toBe('number');
      expect(typeof row.city).toBe('string');
      expect(typeof row.startDate).toBe('string');
      expect(typeof row.active).toBe('boolean');
    }
  });

  it('produces sequential IDs starting from 1', () => {
    const rows = generateEmployees(5);
    expect(rows.map(r => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('produces valid date strings', () => {
    const rows = generateEmployees(20);
    for (const row of rows) {
      expect(row.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('employeeColumns', () => {
  it('has 7 column definitions', () => {
    expect(employeeColumns).toHaveLength(7);
  });

  it('all columns have key and title', () => {
    for (const col of employeeColumns) {
      expect(col.key).toBeTruthy();
      expect(col.title).toBeTruthy();
    }
  });

  it('column keys match EmployeeRow fields', () => {
    const keys = employeeColumns.map(c => c.key);
    expect(keys).toEqual(['id', 'name', 'department', 'salary', 'city', 'startDate', 'active']);
  });
});
