import { useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar } from './DemoToolbar';
import { generateEmployees, employeeColumns } from './generate-data';

const data = generateEmployees(50);

export function ThemeSwitcherDemo() {
  const [isDark, setIsDark] = useState(false);

  return (
    <DemoWrapper
      title="Live Demo"
      description="Toggle between light and dark themes. Theme change propagates to all subsystems instantly."
      height={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton onClick={() => setIsDark((d) => !d)}>
            {isDark ? '☀️ Light Theme' : '🌙 Dark Theme'}
          </DemoButton>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            columns={employeeColumns}
            data={data}
            showRowNumbers
            theme={isDark ? darkTheme : lightTheme}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
