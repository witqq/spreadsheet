import { useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { CellChangeEvent } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function ClipboardDemo() {
  const { witTheme } = useSiteTheme();
  const [log, setLog] = useState<string[]>(['Select cells and use Ctrl+C / Ctrl+X / Ctrl+V']);

  const handleCellChange = (event: CellChangeEvent) => {
    setLog((prev) => [`Cell (${event.row}, ${event.col}) → "${event.value}"`, ...prev.slice(0, 9)]);
  };

  return (
    <DemoWrapper
      title="Live Demo"
      description="Select cells, copy (Ctrl+C), cut (Ctrl+X), click another cell, paste (Ctrl+V). Changes appear in the log below."
      height={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            editable
            onCellChange={handleCellChange}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: '#64748b',
            borderTop: '1px solid #e2e8f0',
            flexShrink: 0,
            maxHeight: 60,
            overflow: 'auto',
          }}
        >
          {log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))}
        </div>
      </div>
    </DemoWrapper>
  );
}
