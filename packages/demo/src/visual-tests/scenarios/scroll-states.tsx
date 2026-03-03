import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = Array.from({ length: 20 }, (_, i) => ({
  key: `col${i}`,
  title: `Column ${i + 1}`,
  width: 120,
}));

const data = Array.from({ length: 200 }, (_, row) => {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    obj[col.key] = `R${row + 1}C${i + 1}`;
  });
  return obj;
});

export function ScrollStates() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    // Scroll to middle of content (both axes)
    engine.scrollTo(600, 3000);
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={700} height={400}>
      <Spreadsheet ref={ref} columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
