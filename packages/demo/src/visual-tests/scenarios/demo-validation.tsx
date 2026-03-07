import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'name', title: 'Name (required)', width: 160 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age (18-65)', width: 100, type: 'number' },
  { key: 'code', title: 'Code (ABC-123)', width: 130 },
];
const data = [
  { name: 'Alice', email: 'alice@test.com', age: 30, code: 'ABC-001' },
  { name: '', email: 'bad-email', age: 16, code: 'invalid' },
  { name: 'Carol', email: 'carol@test.com', age: 45, code: 'XYZ-999' },
  { name: '', email: '', age: 70, code: '' },
];

export function DemoValidation() {
  const ref = useRef<SpreadsheetRef>(null);
  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const ve = engine.getValidationEngine();
    ve.setColumnRules(0, [{ type: 'required', message: 'Name is required' }]);
    ve.setColumnRules(1, [
      { type: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$', message: 'Invalid email format' },
    ]);
    ve.setColumnRules(2, [{ type: 'range', min: 18, max: 65, message: 'Age must be 18-65' }]);
    ve.setColumnRules(3, [
      { type: 'regex', pattern: '^[A-Z]{3}-\\d{3}$', message: 'Format: ABC-123' },
    ]);
    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col <= 3; col++) {
        ve.validateCell(row, col);
      }
    }
    engine.requestRender();
  }, []);
  return (
    <ScenarioContainer width={630} height={220}>
      <Spreadsheet
        ref={ref}
        columns={columns}
        data={data}
        editable
        showRowNumbers
        style={tableStyle}
      />
    </ScenarioContainer>
  );
}
