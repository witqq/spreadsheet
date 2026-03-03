import { Spreadsheet } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function KeyboardNavDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper title="Live Demo" description="Click a cell, then use Arrow keys, Tab, Enter, Home/End, Ctrl+Home/End, Page Up/Down.">
      <Spreadsheet
        theme={witTheme}
        columns={employeeColumns}
        data={data}
        showRowNumbers
        editable={false}
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
