import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar, StatusText } from './DemoToolbar';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'category', title: 'Category', width: 180 },
  { key: 'product', title: 'Product', width: 160 },
  { key: 'sales', title: 'Sales', width: 100, type: 'number' },
  { key: 'revenue', title: 'Revenue', width: 120, type: 'number' },
];

const data = [
  { category: 'Electronics', product: '', sales: 0, revenue: 0 },
  { category: '', product: 'Laptop', sales: 150, revenue: 225000 },
  { category: '', product: 'Phone', sales: 320, revenue: 256000 },
  { category: '', product: 'Tablet', sales: 80, revenue: 48000 },
  { category: 'Clothing', product: '', sales: 0, revenue: 0 },
  { category: '', product: 'Shirt', sales: 500, revenue: 25000 },
  { category: '', product: 'Pants', sales: 300, revenue: 24000 },
  { category: '', product: 'Jacket', sales: 120, revenue: 36000 },
  { category: '', product: 'Shoes', sales: 200, revenue: 30000 },
  { category: 'Food', product: '', sales: 0, revenue: 0 },
  { category: '', product: 'Bread', sales: 1000, revenue: 5000 },
  { category: '', product: 'Milk', sales: 800, revenue: 3200 },
];

export function RowGroupingDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const [info, setInfo] = useState('3 groups: Electronics (3 items), Clothing (4 items), Food (2 items)');

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const rgm = engine.getRowGroupManager();

    rgm.setCellStore(engine.getCellStore());
    rgm.setGroups([
      { headerRow: 0, childRows: [1, 2, 3], expanded: true },
      { headerRow: 4, childRows: [5, 6, 7, 8], expanded: true },
      { headerRow: 9, childRows: [10, 11], expanded: true },
    ]);
    rgm.setAggregates([
      { col: 2, fn: 'sum' },
      { col: 3, fn: 'sum' },
    ]);

    engine.requestRender();
  }, []);

  const handleToggleAll = (expand: boolean) => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const rgm = engine.getRowGroupManager();
    if (expand) rgm.expandAll(); else rgm.collapseAll();
    engine.requestRender();
    setInfo(expand ? 'All groups expanded' : 'All groups collapsed');
  };

  return (
    <DemoWrapper title="Live Demo" description="Click group headers to expand/collapse. Sales and Revenue show sum aggregates for each group." height={440}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <DemoButton onClick={() => handleToggleAll(true)}>➕ Expand All</DemoButton>
          <DemoButton onClick={() => handleToggleAll(false)}>➖ Collapse All</DemoButton>
          <StatusText>{info}</StatusText>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={columns}
            data={data}
            showRowNumbers
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
