import { useState, useRef } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { SortChangeEvent } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(100);
const sortableColumns = employeeColumns.map(col => ({ ...col, sortable: true }));

export function SortingDemo() {
  const { witTheme } = useSiteTheme();
  const [sortInfo, setSortInfo] = useState('Click a column header to sort');
  const tableRef = useRef<SpreadsheetRef>(null);

  const handleSortChange = (event: SortChangeEvent) => {
    const cols = event.sortColumns;
    if (cols.length === 0) {
      setSortInfo('No sort applied');
    } else {
      const desc = cols.map(s => `${sortableColumns[s.col]?.title ?? `col ${s.col}`} (${s.direction})`).join(', ');
      setSortInfo(`Sorted by: ${desc}`);
    }
  };

  return (
    <DemoWrapper title="Live Demo" description="Click headers to sort. Hold Shift and click another header for multi-column sort." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {sortInfo}
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={sortableColumns}
            data={data}
            showRowNumbers
            editable={false}
            sortable
            onSortChange={handleSortChange}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
