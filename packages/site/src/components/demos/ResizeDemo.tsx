import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

const resizableColumns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number', resizable: false },
  { key: 'name', title: 'Name (resizable)', width: 160, minWidth: 80, maxWidth: 400, resizable: true },
  { key: 'department', title: 'Department', width: 130, minWidth: 60, resizable: true },
  { key: 'salary', title: 'Salary', width: 100, type: 'number', minWidth: 60, resizable: true },
  { key: 'city', title: 'City', width: 120, minWidth: 60, maxWidth: 300, resizable: true },
  { key: 'startDate', title: 'Start Date', width: 110, type: 'date', resizable: true },
  { key: 'active', title: 'Active', width: 70, type: 'boolean', resizable: true },
];

export function ResizeDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper title="Live Demo" description="Drag column header borders to resize. ID column is locked. Row borders in the row-number gutter can also be dragged." height={440}>
      <Spreadsheet
        theme={witTheme}
        columns={resizableColumns}
        data={data}
        showRowNumbers
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
