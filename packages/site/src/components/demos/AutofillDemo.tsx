import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'index', title: '#', width: 60, type: 'number' },
  { key: 'value', title: 'Value', width: 120, type: 'number' },
  { key: 'label', title: 'Label', width: 150 },
  { key: 'date', title: 'Date', width: 120, type: 'date' },
];

const data = [
  { index: 1, value: 10, label: 'Alpha', date: '2025-01-01' },
  { index: 2, value: 20, label: 'Beta', date: '2025-01-02' },
  { index: 3, value: 30, label: 'Gamma', date: '2025-01-03' },
  { index: 4, value: 0, label: '', date: '' },
  { index: 5, value: 0, label: '', date: '' },
  { index: 6, value: 0, label: '', date: '' },
  { index: 7, value: 0, label: '', date: '' },
  { index: 8, value: 0, label: '', date: '' },
  { index: 9, value: 0, label: '', date: '' },
  { index: 10, value: 0, label: '', date: '' },
];

export function AutofillDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper
      title="Live Demo"
      description="Select cells 10, 20, 30 in the Value column, then drag the fill handle (small square at bottom-right of selection) downward. Pattern detection extends the sequence."
      height={400}
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
