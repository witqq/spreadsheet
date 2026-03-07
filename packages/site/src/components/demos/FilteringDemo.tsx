import { useState, useRef } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { FilterChangeEvent } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(100);
const filterableColumns = employeeColumns.map((col) => ({
  ...col,
  filterable: true,
  sortable: true,
}));

export function FilteringDemo() {
  const { witTheme } = useSiteTheme();
  const [filterInfo, setFilterInfo] = useState('Click the filter icon in column headers to filter');
  const tableRef = useRef<SpreadsheetRef>(null);

  const handleFilterChange = (event: FilterChangeEvent) => {
    setFilterInfo(`Showing ${event.visibleRowCount} of ${event.totalRowCount} rows`);
  };

  return (
    <DemoWrapper
      title="Live Demo"
      description="Right-click a column header or click filter icons to apply filters. Combine with sorting."
      height={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            color: '#64748b',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          {filterInfo}
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={filterableColumns}
            data={data}
            showRowNumbers
            editable={false}
            sortable
            onFilterChange={handleFilterChange}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
