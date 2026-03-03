import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(20);

export function ContainerTiny() {
  return (
    <ScenarioContainer width={300} height={200}>
      <Spreadsheet columns={standardColumns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
