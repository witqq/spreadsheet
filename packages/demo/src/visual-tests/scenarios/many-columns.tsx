import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = Array.from({ length: 30 }, (_, i) => ({
  key: `col${i}`,
  title: `Column ${i + 1}`,
  width: 80 + (i % 3) * 20,
  type: i % 4 === 0 ? 'number' as const : undefined,
}));

const data: Record<string, unknown>[] = Array.from({ length: 50 }, (_, row) => {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    obj[col.key] = col.type === 'number' ? row * 10 + i : `R${row + 1}C${i + 1}`;
  });
  return obj;
});

export function ManyColumns() {
  return (
    <ScenarioContainer width={1000} height={500}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
