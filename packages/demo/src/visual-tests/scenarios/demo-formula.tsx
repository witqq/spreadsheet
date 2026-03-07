import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { FormulaPlugin } from '@witqq/spreadsheet-plugins';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'a', title: 'A', width: 80, type: 'number' },
  { key: 'b', title: 'B', width: 80, type: 'number' },
  { key: 'c', title: 'C (A+B)', width: 100 },
  { key: 'd', title: 'D (A×B)', width: 100 },
];

const data = [
  { a: 10, b: 20, c: '', d: '' },
  { a: 25, b: 15, c: '', d: '' },
  { a: 8, b: 32, c: '', d: '' },
  { a: 42, b: 7, c: '', d: '' },
  { a: 15, b: 28, c: '', d: '' },
];

export function DemoFormula() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const plugin = new FormulaPlugin({ syncOnly: true });
    engine.installPlugin(plugin);
    for (let row = 0; row < data.length; row++) {
      const r = row + 1;
      const formulas: [number, string][] = [
        [2, `=A${r}+B${r}`],
        [3, `=A${r}*B${r}`],
      ];
      for (const [col, formula] of formulas) {
        engine.setCell(row, col, formula);
        engine.getEventBus().emit('cellChange', {
          row,
          col,
          value: formula,
          column: columns[col],
          oldValue: '',
          newValue: formula,
          source: 'edit' as const,
        });
      }
    }
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={500} height={300}>
      <Spreadsheet ref={ref} columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
