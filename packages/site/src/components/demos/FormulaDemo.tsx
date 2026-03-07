import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { FormulaPlugin } from '@witqq/spreadsheet-plugins';
import { DemoWrapper } from './DemoWrapper';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'a', title: 'A', width: 100, type: 'number' },
  { key: 'b', title: 'B', width: 100, type: 'number' },
  { key: 'c', title: 'C (A+B)', width: 120 },
  { key: 'd', title: 'D (A×B)', width: 120 },
];

const data = [
  { a: 10, b: 20, c: '', d: '' },
  { a: 25, b: 15, c: '', d: '' },
  { a: 8, b: 32, c: '', d: '' },
  { a: 42, b: 7, c: '', d: '' },
  { a: 15, b: 28, c: '', d: '' },
  { a: 33, b: 11, c: '', d: '' },
  { a: 5, b: 45, c: '', d: '' },
  { a: 19, b: 23, c: '', d: '' },
];

export function FormulaDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    const plugin = new FormulaPlugin({ syncOnly: true });
    engine.installPlugin(plugin);

    // Set formula cells and emit cellChange so the plugin computes them
    const visibleCols = columns;
    for (let row = 0; row < data.length; row++) {
      const r = row + 1; // 1-based cell references
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
          column: visibleCols[col],
          oldValue: '',
          newValue: formula,
          source: 'edit' as const,
        });
      }
    }
    engine.requestRender();
    setActive(true);
  }, []);

  return (
    <DemoWrapper
      title="Live Demo"
      description="Edit values in columns A or B to see formulas in C (sum) and D (product) recalculate automatically."
      height={380}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: active ? '#22c55e' : '#94a3b8',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {active ? 'Formula Engine Active' : 'Initializing…'}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={columns}
            data={data}
            showRowNumbers
            editable
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
