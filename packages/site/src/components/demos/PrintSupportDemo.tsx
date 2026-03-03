import { useRef } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar } from './DemoToolbar';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(100);

export function PrintSupportDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);

  return (
    <DemoWrapper title="Live Demo" description="Click Print to generate an HTML table from canvas data and open the browser print dialog. Sorted/filtered data is respected." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton onClick={() => tableRef.current?.print()}>🖨️ Print Table</DemoButton>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            sortable
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
