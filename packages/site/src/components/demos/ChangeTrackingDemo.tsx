import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar, StatusText } from './DemoToolbar';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(30);

export function ChangeTrackingDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [status, setStatus] = useState('Edit cells, then click "Simulate Save" to see the status lifecycle.');

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    engine.getChangeTracker().captureBaseline();
  }, []);

  const handleSimulateSave = async () => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const tracker = engine.getChangeTracker();
    const changed = tracker.getChangedCells();
    if (changed.length === 0) {
      setStatus('No changes to save. Edit some cells first.');
      return;
    }

    setStatus(`Saving ${changed.length} cell(s)...`);
    for (const cell of changed) {
      tracker.setCellStatus(cell.row, cell.col, 'saving');
    }
    engine.requestRender();

    await new Promise(r => setTimeout(r, 1000));

    for (const cell of changed) {
      tracker.setCellStatus(cell.row, cell.col, 'saved');
    }
    engine.requestRender();
    setStatus(`Saved ${changed.length} cell(s). Status will clear shortly.`);

    await new Promise(r => setTimeout(r, 1500));
    for (const cell of changed) {
      engine.getCellStore().clearMetadata(cell.row, cell.col);
    }
    tracker.captureBaseline();
    engine.requestRender();
    setStatus('All changes saved and cleared. Edit more cells to try again.');
  };

  return (
    <DemoWrapper title="Live Demo" description="Edit cells to see 'changed' status (blue border). Click Save to see saving → saved lifecycle." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton onClick={handleSimulateSave}>💾 Simulate Save</DemoButton>
          <StatusText>{status}</StatusText>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            editable
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
