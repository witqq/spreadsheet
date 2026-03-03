import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'action', title: 'Action', width: 180 },
  { key: 'shortcut', title: 'Shortcut', width: 120 },
  { key: 'category', title: 'Category', width: 130 },
];
const data = [
  { action: 'Copy', shortcut: 'Ctrl+C', category: 'Clipboard' },
  { action: 'Paste', shortcut: 'Ctrl+V', category: 'Clipboard' },
  { action: 'Undo', shortcut: 'Ctrl+Z', category: 'Edit' },
  { action: 'Redo', shortcut: 'Ctrl+Y', category: 'Edit' },
  { action: 'Select All', shortcut: 'Ctrl+A', category: 'Selection' },
];

export function DemoContextMenu() {
  return (
    <ScenarioContainer width={470} height={250}>
      <Spreadsheet columns={columns} data={data} showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
