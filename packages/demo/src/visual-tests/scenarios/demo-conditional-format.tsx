import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ConditionalFormattingPlugin } from '@witqq/spreadsheet-plugins';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Student', width: 120 },
  { key: 'math', title: 'Math', width: 80, type: 'number' },
  { key: 'science', title: 'Science', width: 80, type: 'number' },
  { key: 'english', title: 'English', width: 80, type: 'number' },
  { key: 'avg', title: 'Average', width: 80, type: 'number' },
];

const data = [
  { name: 'Alice', math: 95, science: 88, english: 92, avg: 92 },
  { name: 'Bob', math: 78, science: 85, english: 70, avg: 78 },
  { name: 'Carol', math: 62, science: 55, english: 68, avg: 62 },
  { name: 'David', math: 88, science: 92, english: 85, avg: 88 },
  { name: 'Eve', math: 45, science: 50, english: 55, avg: 50 },
  { name: 'Frank', math: 91, science: 78, english: 95, avg: 88 },
];

export function DemoConditionalFormat() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);
    const range = { startRow: 0, startCol: 1, endRow: data.length - 1, endCol: 4 };
    const rule = ConditionalFormattingPlugin.createGradientScale(range, [
      { value: 0, color: '#ef4444' },
      { value: 50, color: '#eab308' },
      { value: 100, color: '#22c55e' },
    ]);
    plugin.addRule(rule);
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={500} height={300}>
      <Spreadsheet ref={ref} columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
