import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { generateRows, ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 80, type: 'number' },
  { key: 'department', title: 'Department', width: 130 },
];
const data = generateRows(20);

export function DemoMerging() {
  const ref = useRef<SpreadsheetRef>(null);
  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const mm = engine.getMergeManager();
    mm.merge({ startRow: 0, startCol: 1, endRow: 2, endCol: 1 });
    mm.merge({ startRow: 3, startCol: 2, endRow: 3, endCol: 4 });
    mm.merge({ startRow: 5, startCol: 0, endRow: 7, endCol: 1 });
    engine.requestRender();
  }, []);
  return (
    <ScenarioContainer width={650} height={300}>
      <Spreadsheet ref={ref} columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
