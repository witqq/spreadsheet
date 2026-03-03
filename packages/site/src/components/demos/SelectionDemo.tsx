import { useState, useRef } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { SelectionChangeEvent } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function SelectionDemo() {
  const { witTheme } = useSiteTheme();
  const [selection, setSelection] = useState('Click a cell to see selection info');
  const tableRef = useRef<SpreadsheetRef>(null);

  const handleSelectionChange = (event: SelectionChangeEvent) => {
    const { row, col } = event.selection.activeCell;
    setSelection(`Active cell: row ${row}, col ${col}`);
  };

  return (
    <DemoWrapper title="Live Demo" description="Click cells, use Shift+Click for ranges, Ctrl+Click for multi-select." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {selection}
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            editable={false}
            onSelectionChange={handleSelectionChange}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
