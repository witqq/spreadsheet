import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(30);

export function CustomRowHeight() {
  return (
    <ScenarioContainer width={800} height={500}>
      <Spreadsheet
        columns={standardColumns}
        data={data}
        rowHeight={40}
        headerHeight={48}
        style={tableStyle}
      />
    </ScenarioContainer>
  );
}
