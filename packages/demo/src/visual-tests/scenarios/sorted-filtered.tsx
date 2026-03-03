import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(50);

export function SortedFiltered() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    // Sort by name column (index 1) ascending
    const sortEngine = engine.getSortEngine();
    sortEngine.setSortColumns([{ col: 1, direction: 'asc' }]);
    // Filter: only rows where department (col 4) equals Engineering
    const filterEngine = engine.getFilterEngine();
    filterEngine.setColumnFilter(4, [{ col: 4, operator: 'equals', value: 'Engineering' }]);
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={800} height={400}>
      <Spreadsheet ref={ref} columns={standardColumns} data={data} sortable style={tableStyle} />
    </ScenarioContainer>
  );
}
