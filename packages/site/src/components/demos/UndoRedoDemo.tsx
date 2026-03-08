import { useState, useRef, useCallback } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef, CellChangeEvent } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar, StatusText } from './DemoToolbar';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function UndoRedoDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [editCount, setEditCount] = useState(0);

  const handleUndo = useCallback(() => tableRef.current?.undo(), []);
  const handleRedo = useCallback(() => tableRef.current?.redo(), []);
  const handleCellChange = useCallback((_event: CellChangeEvent) => {
    setEditCount((prev) => prev + 1);
  }, []);

  return (
    <DemoWrapper
      title="Live Demo"
      description="Double-click to edit cells. Use the buttons or Ctrl+Z / Ctrl+Y to undo and redo."
      height={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton onClick={handleUndo}>↩ Undo</DemoButton>
          <DemoButton onClick={handleRedo}>↪ Redo</DemoButton>
          <StatusText>Edits: {editCount}</StatusText>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
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
