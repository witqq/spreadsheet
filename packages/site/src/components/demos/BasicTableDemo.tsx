import { Spreadsheet } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(200);

export function BasicTableDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper
      title="Live Demo"
      description="Scroll through 200 rows. Resize columns by dragging header borders."
    >
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
