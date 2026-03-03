import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'a', title: 'A', width: 100 },
  { key: 'b', title: 'B', width: 100 },
  { key: 'c', title: 'C', width: 100 },
  { key: 'd', title: 'D', width: 100 },
  { key: 'e', title: 'E', width: 100 },
];

const data = Array.from({ length: 15 }, (_, i) => ({
  a: `A${i + 1}`,
  b: `B${i + 1}`,
  c: `C${i + 1}`,
  d: `D${i + 1}`,
  e: `E${i + 1}`,
}));

export function MergedCells() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;
    const mm = engine.getMergeManager();
    // 2×2 merge at top-left
    mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    // Wide horizontal merge
    mm.merge({ startRow: 3, startCol: 1, endRow: 3, endCol: 4 });
    // Tall vertical merge
    mm.merge({ startRow: 5, startCol: 2, endRow: 9, endCol: 2 });
    // Single-row merge
    mm.merge({ startRow: 11, startCol: 0, endRow: 11, endCol: 2 });
    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={600} height={450}>
      <Spreadsheet ref={ref} columns={columns} data={data} style={tableStyle} />
    </ScenarioContainer>
  );
}
