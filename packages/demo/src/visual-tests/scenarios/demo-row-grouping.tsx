import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name', width: 180 },
  { key: 'role', title: 'Role', width: 130 },
  { key: 'hours', title: 'Hours', width: 80, type: 'number' },
  { key: 'rate', title: 'Rate', width: 80, type: 'number' },
];
const data = [
  { name: 'Engineering', role: '', hours: 0, rate: 0 },
  { name: 'Alice', role: 'Senior', hours: 40, rate: 75 },
  { name: 'Bob', role: 'Junior', hours: 35, rate: 50 },
  { name: 'Carol', role: 'Mid', hours: 38, rate: 60 },
  { name: 'Marketing', role: '', hours: 0, rate: 0 },
  { name: 'David', role: 'Lead', hours: 42, rate: 65 },
  { name: 'Eve', role: 'Analyst', hours: 30, rate: 45 },
  { name: 'Support', role: '', hours: 0, rate: 0 },
  { name: 'Frank', role: 'Tier 1', hours: 40, rate: 35 },
  { name: 'Grace', role: 'Tier 2', hours: 36, rate: 40 },
  { name: 'Henry', role: 'Manager', hours: 45, rate: 55 },
];

export function DemoRowGrouping() {
  const ref = useRef<SpreadsheetRef>(null);
  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const rgm = engine.getRowGroupManager();
    rgm.setCellStore(engine.getCellStore());
    rgm.setGroups([
      { headerRow: 0, childRows: [1, 2, 3], expanded: true },
      { headerRow: 4, childRows: [5, 6], expanded: true },
      { headerRow: 7, childRows: [8, 9, 10], expanded: false },
    ]);
    rgm.setAggregates([{ col: 2, fn: 'sum' }]);
    engine.requestRender();
  }, []);
  return (
    <ScenarioContainer width={510} height={350}>
      <Spreadsheet ref={ref} columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
