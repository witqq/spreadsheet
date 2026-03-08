import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'name', title: 'Name', width: 150 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 80, type: 'number' },
  { key: 'score', title: 'Score', width: 100, type: 'number' },
];

const data = [
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 30, score: 85 },
  { id: 2, name: '', email: 'invalid-email', age: 15, score: 150 },
  { id: 3, name: 'Charlie', email: 'charlie@test.com', age: 25, score: 92 },
  { id: 4, name: '', email: '', age: -5, score: -10 },
  { id: 5, name: 'Eve', email: 'eve@example.com', age: 200, score: 50 },
];

export function ValidationErrors() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const ve = engine.getValidationEngine();
    // Name is required
    ve.setColumnRules(1, [{ type: 'required', message: 'Name is required' }]);
    // Email must match pattern
    ve.setColumnRules(2, [
      { type: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$', message: 'Invalid email' },
    ]);
    // Age: 0-120
    ve.setColumnRules(3, [{ type: 'range', min: 0, max: 120, message: 'Age must be 0-120' }]);
    // Score: 0-100
    ve.setColumnRules(4, [{ type: 'range', min: 0, max: 100, message: 'Score must be 0-100' }]);
    // Trigger validation for all data cells
    for (let row = 0; row < data.length; row++) {
      for (let col = 1; col <= 4; col++) {
        ve.validateCell(row, col);
      }
    }
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={650} height={250}>
      <Spreadsheet ref={ref} columns={columns} data={data} editable style={tableStyle} />
    </ScenarioContainer>
  );
}
