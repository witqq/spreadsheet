import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 50, type: 'number' },
  { key: 'text', title: 'String', width: 120, type: 'string' },
  { key: 'amount', title: 'Number', width: 100, type: 'number' },
  { key: 'active', title: 'Boolean', width: 80, type: 'boolean' },
  { key: 'created', title: 'Date', width: 110, type: 'date' },
  { key: 'progress', title: 'Progress', width: 140, type: 'progressBar' as any },
  { key: 'rating', title: 'Rating', width: 120, type: 'rating' as any },
];

const data = [
  { id: 1, text: 'Hello World', amount: 1234.56, active: true, created: '2025-01-15', progress: 85, rating: 5 },
  { id: 2, text: 'Test Data', amount: -42, active: false, created: '2024-06-01', progress: 45, rating: 3 },
  { id: 3, text: 'Long text that will be truncated in the cell', amount: 0, active: true, created: '2023-12-25', progress: 10, rating: 1 },
  { id: 4, text: '', amount: 99999, active: false, created: '2025-03-01', progress: 100, rating: 4 },
  { id: 5, text: 'Final Row', amount: 500, active: true, created: '2025-02-14', progress: 62, rating: 2 },
];

export function CellTypesDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const registry = engine.getCellTypeRegistry();

    registry.register('progressBar' as any, {
      format: (value) => `${value}%`,
      align: 'left',
      render: (ctx, value, x, y, width, height, theme) => {
        const pct = Math.max(0, Math.min(100, Number(value) || 0));
        const barWidth = (width - 8) * (pct / 100);
        const barHeight = 12;
        const barY = y + (height - barHeight) / 2;
        ctx.fillStyle = theme.colors.cellBorder;
        ctx.fillRect(x + 4, barY, width - 8, barHeight);
        ctx.fillStyle = pct >= 80 ? '#63be7b' : pct >= 50 ? '#ffeb84' : '#f8696b';
        ctx.fillRect(x + 4, barY, barWidth, barHeight);
        ctx.fillStyle = theme.colors.cellText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, x + width / 2, y + height / 2);
      },
    });

    registry.register('rating' as any, {
      format: (value) => '★'.repeat(Number(value) || 0),
      align: 'center',
      render: (ctx, value, x, y, width, height) => {
        const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
        const starSize = 14;
        const totalWidth = starSize * 5;
        const startX = x + (width - totalWidth) / 2;
        const centerY = y + height / 2 + 5;
        ctx.font = `${starSize}px sans-serif`;
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i < rating ? '#f4b400' : '#e0e0e0';
          ctx.fillText('★', startX + i * starSize, centerY);
        }
      },
    });

    engine.requestRender();
  }, []);

  return (
    <DemoWrapper title="Live Demo" description="All cell types in one table: string, number (right-aligned), boolean (checkbox), date, progress bar, and star rating." height={300}>
      <Spreadsheet
        theme={witTheme}
        ref={tableRef}
        columns={columns}
        data={data}
        showRowNumbers
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}
