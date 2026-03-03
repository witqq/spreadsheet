import { Spreadsheet } from '@witqq/spreadsheet-react';
import { standardColumns, ScenarioContainer, tableStyle } from './shared';

export function BasicEmpty() {
  return (
    <ScenarioContainer width={800} height={300}>
      <Spreadsheet columns={standardColumns} data={[]} style={tableStyle} />
    </ScenarioContainer>
  );
}
