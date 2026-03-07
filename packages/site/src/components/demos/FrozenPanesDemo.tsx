import { Spreadsheet } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(100);

export function FrozenPanesDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper
      title="Live Demo"
      description="Scroll to see row 1 and first 2 columns stay frozen in place."
      height={440}
    >
      <Spreadsheet
        theme={witTheme}
        columns={employeeColumns}
        data={data}
        frozenRows={1}
        frozenColumns={2}
        showRowNumbers
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
