import { useRef, useState, useCallback } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { FormulaPlugin, ConditionalFormattingPlugin } from '@witqq/spreadsheet-plugins';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar } from './DemoToolbar';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'a', title: 'Value A', width: 100, type: 'number' },
  { key: 'b', title: 'Value B', width: 100, type: 'number' },
  { key: 'c', title: 'Sum (A+B)', width: 120 },
  { key: 'score', title: 'Score', width: 100, type: 'number' },
];

const initialData = [
  { a: 10, b: 20, c: '', score: 85 },
  { a: 25, b: 15, c: '', score: 42 },
  { a: 30, b: 10, c: '', score: 95 },
  { a: 5, b: 45, c: '', score: 28 },
  { a: 15, b: 35, c: '', score: 73 },
  { a: 40, b: 20, c: '', score: 58 },
  { a: 20, b: 30, c: '', score: 91 },
  { a: 35, b: 5, c: '', score: 15 },
  { a: 8, b: 42, c: '', score: 67 },
  { a: 50, b: 10, c: '', score: 100 },
];

export function PluginShowcaseDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [formulaEnabled, setFormulaEnabled] = useState(false);
  const [condFormatEnabled, setCondFormatEnabled] = useState(false);
  const formulaPluginRef = useRef<FormulaPlugin | null>(null);
  const condFormatPluginRef = useRef<ConditionalFormattingPlugin | null>(null);

  const toggleFormula = useCallback(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    if (formulaEnabled) {
      engine.removePlugin('formula');
      formulaPluginRef.current = null;
      for (let row = 0; row < 10; row++) {
        engine.setCell(row, 2, '');
      }
      engine.requestRender();
    } else {
      const plugin = new FormulaPlugin({ syncOnly: true });
      engine.installPlugin(plugin);
      formulaPluginRef.current = plugin;
      for (let row = 0; row < 10; row++) {
        const formula = `=A${row + 1}+B${row + 1}`;
        engine.setCell(row, 2, formula);
        engine.getEventBus().emit('cellChange', {
          row,
          col: 2,
          value: formula,
          column: columns[2],
          oldValue: '',
          newValue: formula,
          source: 'edit' as const,
        });
      }
      engine.requestRender();
    }
    setFormulaEnabled(!formulaEnabled);
  }, [formulaEnabled]);

  const toggleCondFormat = useCallback(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    if (condFormatEnabled) {
      engine.removePlugin('conditional-format');
      condFormatPluginRef.current = null;
      engine.requestRender();
    } else {
      const plugin = new ConditionalFormattingPlugin();
      engine.installPlugin(plugin);
      plugin.addRule(
        ConditionalFormattingPlugin.createGradientScale(
          { startRow: 0, startCol: 3, endRow: 9, endCol: 3 },
          [
            { value: 0, color: '#ef4444' },
            { value: 50, color: '#eab308' },
            { value: 100, color: '#22c55e' },
          ],
        ),
      );
      condFormatPluginRef.current = plugin;
      engine.requestRender();
    }
    setCondFormatEnabled(!condFormatEnabled);
  }, [condFormatEnabled]);

  return (
    <DemoWrapper
      height={440}
      title="Live Demo"
      description="Toggle plugins on and off to see their effects. Formula calculates Sum column. Conditional formatting applies gradient to Score."
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton variant="toggle" active={formulaEnabled} onClick={toggleFormula}>
            Formula Plugin: {formulaEnabled ? 'ON' : 'OFF'}
          </DemoButton>
          <DemoButton variant="toggle" active={condFormatEnabled} onClick={toggleCondFormat}>
            Conditional Formatting: {condFormatEnabled ? 'ON' : 'OFF'}
          </DemoButton>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={columns}
            data={initialData}
            editable={true}
            showRowNumbers={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
