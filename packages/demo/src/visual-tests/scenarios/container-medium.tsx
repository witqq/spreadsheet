import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(50);

export function ContainerMedium() {
  return (
    <ScenarioContainer width={800} height={500}>
      <Spreadsheet columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
