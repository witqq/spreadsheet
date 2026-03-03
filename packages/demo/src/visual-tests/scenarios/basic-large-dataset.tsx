import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(1000);

export function BasicLargeDataset() {
  return (
    <ScenarioContainer width={800} height={500}>
      <Spreadsheet columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
