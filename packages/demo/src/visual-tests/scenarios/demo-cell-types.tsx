import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'text', title: 'Text', width: 120 },
  { key: 'num', title: 'Number', width: 80, type: 'number' },
  { key: 'bool', title: 'Boolean', width: 80, type: 'boolean' },
  { key: 'date', title: 'Date', width: 120, type: 'date' },
  { key: 'pct', title: 'Percent', width: 100, type: 'number' },
];
const data = [
  { text: 'Alpha', num: 42, bool: true, date: '2025-01-15', pct: 75 },
  { text: 'Beta', num: 99, bool: false, date: '2025-06-30', pct: 30 },
  { text: 'Gamma', num: 7, bool: true, date: '2024-12-01', pct: 100 },
  { text: 'Delta', num: 0, bool: false, date: '2025-03-10', pct: 50 },
];

export function DemoCellTypes() {
  return (
    <ScenarioContainer width={560} height={220}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
