import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'title', title: 'Title', width: 120 },
  { key: 'description', title: 'Description', width: 200 },
  { key: 'notes', title: 'Notes', width: 150 },
];

const data: Record<string, unknown>[] = [
  { id: 1, title: 'Short', description: 'Brief description', notes: 'OK' },
  { id: 2, title: 'Medium length title that might clip', description: 'This is a somewhat longer description that should definitely get truncated in the cell', notes: 'This note is also rather long and should be clipped at the column boundary' },
  { id: 3, title: 'A', description: 'The quick brown fox jumps over the lazy dog. This classic pangram is used to test text rendering in many applications.', notes: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { id: 4, title: 'ALLCAPSVERYLONGTITLEWITHOUTSPACES', description: 'DESCRIPTIONWITHNOSPACESORBREAKS', notes: 'normalTextMixedWithCamelCase' },
  { id: 5, title: 'Numbers 123456789', description: '12345678901234567890', notes: '0.123456789012345' },
];

export function LongText() {
  return (
    <ScenarioContainer width={600} height={300}>
      <Spreadsheet columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
