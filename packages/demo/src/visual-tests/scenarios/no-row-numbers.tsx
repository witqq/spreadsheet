import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(30);

export function NoRowNumbers() {
  return (
    <ScenarioContainer width={800} height={400}>
      <Spreadsheet
        columns={standardColumns}
        data={data}
        showRowNumbers={false}
        style={tableStyle}
      />
    </ScenarioContainer>
  );
}
