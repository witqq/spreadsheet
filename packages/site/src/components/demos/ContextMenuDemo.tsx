import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { DemoWrapper } from './DemoWrapper';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(50);

export function ContextMenuDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [lastAction, setLastAction] = useState('Right-click any cell, header, or row number to see the context menu.');

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const cm = engine.getContextMenuManager();
    if (!cm) return;

    cm.registerItem({
      id: 'highlight-row',
      label: '🟡 Highlight Row',
      contexts: ['cell', 'row-number'],
      action: (ctx) => setLastAction(`Highlighted row ${(ctx.row ?? 0) + 1}`),
    });

    cm.registerItem({
      id: 'column-info',
      label: 'ℹ️ Column Info',
      contexts: ['header'],
      action: (ctx) => {
        const col = employeeColumns[ctx.col ?? 0];
        setLastAction(`Column: ${col?.title ?? 'unknown'}, type: ${col?.type ?? 'string'}`);
      },
    });

    cm.registerItem({
      id: 'select-all',
      label: '☐ Select All',
      shortcut: 'Ctrl+A',
      contexts: ['corner'],
      action: () => setLastAction('Select all triggered from corner'),
    });

    return () => {
      cm.unregisterItem('highlight-row');
      cm.unregisterItem('column-info');
      cm.unregisterItem('select-all');
    };
  }, []);

  return (
    <DemoWrapper title="Live Demo" description="Right-click cells, headers, row numbers, or the corner to see context-specific menus with custom items." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#64748b', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          {lastAction}
        </div>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
