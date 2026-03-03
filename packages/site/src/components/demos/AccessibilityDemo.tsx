import { Spreadsheet } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function AccessibilityDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <DemoWrapper title="Live Demo" description="This table has built-in ARIA attributes: role=grid, aria-rowcount, aria-colcount. Use keyboard arrows to navigate; screen reader announces cell positions." height={440}>
      <Spreadsheet
        theme={witTheme}
        columns={employeeColumns}
        data={data}
        showRowNumbers
        aria-label="Employee directory"
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
