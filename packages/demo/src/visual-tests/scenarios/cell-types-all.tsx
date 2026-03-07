import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'text', title: 'Text', width: 150 },
  { key: 'number', title: 'Number', width: 100, type: 'number' },
  { key: 'boolean', title: 'Boolean', width: 80, type: 'boolean' },
  { key: 'date', title: 'Date', width: 120, type: 'date' },
  { key: 'currency', title: 'Currency', width: 100, type: 'number' },
];

const data: Record<string, unknown>[] = [
  { id: 1, text: 'Hello World', number: 42, boolean: true, date: '2024-01-15', currency: 1234.56 },
  { id: 2, text: 'Test Data', number: -17, boolean: false, date: '2024-06-30', currency: 99999 },
  {
    id: 3,
    text: 'Lorem ipsum dolor',
    number: 0,
    boolean: true,
    date: '2023-12-01',
    currency: 0.99,
  },
  { id: 4, text: '', number: 3.14, boolean: false, date: '2025-03-01', currency: -500 },
  {
    id: 5,
    text: 'Special <>&"chars',
    number: 999999,
    boolean: true,
    date: '2020-01-01',
    currency: 42.0,
  },
  {
    id: 6,
    text: '日本語テスト',
    number: 100,
    boolean: false,
    date: '2024-07-04',
    currency: 1000000,
  },
  { id: 7, text: 'UPPERCASE TEXT', number: -999, boolean: true, date: '2024-02-29', currency: 0 },
  { id: 8, text: 'Mixed 123 CaSe!', number: 1, boolean: false, date: '2024-11-15', currency: 50.5 },
];

export function CellTypesAll() {
  return (
    <ScenarioContainer width={700} height={350}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
