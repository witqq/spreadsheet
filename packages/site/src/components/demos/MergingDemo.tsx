import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function MergingDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const mm = engine.getMergeManager();
    mm.merge({ startRow: 0, startCol: 2, endRow: 2, endCol: 2 });
    mm.merge({ startRow: 4, startCol: 1, endRow: 4, endCol: 3 });
    mm.merge({ startRow: 7, startCol: 0, endRow: 9, endCol: 0 });
    engine.requestRender();
  }, []);

  return (
    <DemoWrapper
      title="Live Demo"
      description="Three merged regions shown: vertical (rows 1-3 in Department), horizontal (row 5 across Name-Salary), and vertical (rows 8-10 in ID)."
      height={440}
    >
      <Spreadsheet
        theme={witTheme}
        ref={tableRef}
        columns={employeeColumns}
        data={data}
        showRowNumbers
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
