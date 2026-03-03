import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(100);

export function ContainerLarge() {
  return (
    <ScenarioContainer width={1200} height={700}>
      <Spreadsheet columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
