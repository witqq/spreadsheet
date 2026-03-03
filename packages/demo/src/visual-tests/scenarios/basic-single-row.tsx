import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(1);

export function BasicSingleRow() {
  return (
    <ScenarioContainer width={800} height={200}>
      <Spreadsheet columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
