import { useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { CellChangeEvent } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(30);
const editableColumns = employeeColumns.map(col => ({ ...col, editable: true }));

export function EditingDemo() {
  const { witTheme } = useSiteTheme();
  const [lastEdit, setLastEdit] = useState('Double-click or press F2 to edit a cell');

  const handleCellChange = (event: CellChangeEvent) => {
    setLastEdit(`Edited row ${event.row}, col ${event.col}: "${event.oldValue}" → "${event.value}"`);
  };

  return (
    <DemoWrapper title="Live Demo" description="Double-click or press F2 to edit. Enter to commit, Escape to cancel." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {lastEdit}
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            columns={editableColumns}
            data={data}
            showRowNumbers
            editable
            onCellChange={handleCellChange}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
