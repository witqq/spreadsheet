import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ConditionalFormattingPlugin } from '@witqq/spreadsheet-plugins';
import { DemoWrapper } from './DemoWrapper';
import { useSiteTheme } from './useSiteTheme';

interface StudentRow {
  name: string;
  math: number;
  science: number;
  english: number;
  average: number;
}

const columns: ColumnDef[] = [
  { key: 'name', title: 'Student', width: 140 },
  { key: 'math', title: 'Math', width: 100, type: 'number' },
  { key: 'science', title: 'Science', width: 100, type: 'number' },
  { key: 'english', title: 'English', width: 100, type: 'number' },
  { key: 'average', title: 'Average', width: 100, type: 'number' },
];

function makeStudent(name: string, math: number, science: number, english: number): StudentRow {
  return { name, math, science, english, average: Math.round((math + science + english) / 3) };
}

const data: StudentRow[] = [
  makeStudent('Alice Johnson', 92, 88, 95),
  makeStudent('Bob Smith', 45, 72, 38),
  makeStudent('Carol Davis', 78, 91, 82),
  makeStudent('Dan Wilson', 31, 55, 67),
  makeStudent('Eve Martinez', 88, 64, 71),
  makeStudent('Frank Lee', 56, 83, 49),
  makeStudent('Grace Kim', 97, 95, 99),
  makeStudent('Hank Brown', 63, 41, 58),
  makeStudent('Ivy Chen', 74, 78, 86),
  makeStudent('Jake Taylor', 85, 69, 44),
];

export function ConditionalFormatDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);

    plugin.addRule(ConditionalFormattingPlugin.createGradientScale(
      { startRow: 0, startCol: 1, endRow: 9, endCol: 1 },
      [
        { value: 0, color: '#ef4444' },
        { value: 50, color: '#eab308' },
        { value: 100, color: '#22c55e' },
      ]
    ));

    plugin.addRule(ConditionalFormattingPlugin.createDataBar(
      { startRow: 0, startCol: 2, endRow: 9, endCol: 2 },
      '#3b82f6'
    ));

    plugin.addRule(ConditionalFormattingPlugin.createIconSet(
      { startRow: 0, startCol: 3, endRow: 9, endCol: 3 },
      'arrows'
    ));

    engine.requestRender();
    setStatus('Gradient: Math | Data Bars: Science | Icons: English');
  }, []);

  return (
    <DemoWrapper title="Live Demo" description="Gradient scales on Math (red→yellow→green), data bars on Science (blue), and icon sets on English (arrows)." height={420}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{status}</span>
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={columns}
            data={data}
            showRowNumbers
            editable={false}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
