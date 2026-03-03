import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(20);

export function Selections() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const sm = engine.getSelectionManager();
    // Select cell at row 2, col 1, then extend to row 5, col 3
    sm.selectCell(2, 1);
    sm.extendSelection(5, 3);
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={800} height={400}>
      <Spreadsheet ref={ref} columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
