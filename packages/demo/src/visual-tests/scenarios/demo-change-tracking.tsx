import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'status', title: 'Status', width: 120 },
  { key: 'value', title: 'Value', width: 100, type: 'number' },
];
const data = [
  { id: 1, name: 'Record A', status: 'Active', value: 100 },
  { id: 2, name: 'Record B', status: 'Pending', value: 200 },
  { id: 3, name: 'Record C', status: 'Active', value: 300 },
  { id: 4, name: 'Record D', status: 'Inactive', value: 400 },
  { id: 5, name: 'Record E', status: 'Active', value: 500 },
];

export function DemoChangeTracking() {
  const ref = useRef<SpreadsheetRef>(null);
  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const ct = engine.getChangeTracker();
    ct.captureBaseline();
    ct.setCellStatus(0, 1, 'changed');
    ct.setCellStatus(1, 2, 'saving');
    ct.setCellStatus(2, 3, 'saved');
    ct.setCellStatus(3, 1, 'error', 'Save failed');
    engine.requestRender();
  }, []);
  return (
    <ScenarioContainer width={480} height={250}>
      <Spreadsheet ref={ref} columns={columns} data={data} editable showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
