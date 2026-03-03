import { Spreadsheet } from '@witqq/spreadsheet-react';
import { darkTheme } from '@witqq/spreadsheet';
import { standardColumns, generateRows, ScenarioContainer, tableStyle } from './shared';

const data = generateRows(30);

export function DarkTheme() {
  return (
    <ScenarioContainer width={800} height={400} background="#1a1a1a">
      <Spreadsheet columns={standardColumns} data={data} theme={darkTheme} style={tableStyle} />
    </ScenarioContainer>
  );
}
