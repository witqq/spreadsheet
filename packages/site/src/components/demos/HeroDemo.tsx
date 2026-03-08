import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { useSiteTheme } from './useSiteTheme';

const columns: ColumnDef[] = [
  { key: 'product', title: 'Product', width: 140, sortable: true, filterable: true },
  { key: 'region', title: 'Region', width: 110, sortable: true, filterable: true },
  { key: 'q1', title: 'Q1 Revenue', width: 110, type: 'number', sortable: true },
  { key: 'q2', title: 'Q2 Revenue', width: 110, type: 'number', sortable: true },
  { key: 'growth', title: 'Growth %', width: 90, type: 'number', sortable: true },
  { key: 'status', title: 'Status', width: 100, sortable: true },
];

const data = [
  {
    product: 'Cloud Suite',
    region: 'North America',
    q1: 284500,
    q2: 312800,
    growth: 9.9,
    status: 'Active',
  },
  {
    product: 'Analytics Pro',
    region: 'Europe',
    q1: 198200,
    q2: 215600,
    growth: 8.8,
    status: 'Active',
  },
  {
    product: 'SecureVault',
    region: 'Asia Pacific',
    q1: 156800,
    q2: 178400,
    growth: 13.8,
    status: 'Active',
  },
  {
    product: 'DataSync',
    region: 'North America',
    q1: 142300,
    q2: 139700,
    growth: -1.8,
    status: 'Review',
  },
  {
    product: 'Cloud Suite',
    region: 'Europe',
    q1: 221400,
    q2: 248900,
    growth: 12.4,
    status: 'Active',
  },
  {
    product: 'EdgeCompute',
    region: 'Asia Pacific',
    q1: 89500,
    q2: 112300,
    growth: 25.5,
    status: 'Active',
  },
  {
    product: 'Analytics Pro',
    region: 'Latin America',
    q1: 67800,
    q2: 74200,
    growth: 9.4,
    status: 'Pipeline',
  },
  {
    product: 'SecureVault',
    region: 'Europe',
    q1: 134600,
    q2: 151200,
    growth: 12.3,
    status: 'Active',
  },
  {
    product: 'DataSync',
    region: 'Asia Pacific',
    q1: 98400,
    q2: 105800,
    growth: 7.5,
    status: 'Active',
  },
  {
    product: 'EdgeCompute',
    region: 'North America',
    q1: 176200,
    q2: 198500,
    growth: 12.7,
    status: 'Active',
  },
  {
    product: 'Cloud Suite',
    region: 'Latin America',
    q1: 54300,
    q2: 68700,
    growth: 26.5,
    status: 'Pipeline',
  },
  {
    product: 'Analytics Pro',
    region: 'North America',
    q1: 245100,
    q2: 267300,
    growth: 9.1,
    status: 'Active',
  },
];

export function HeroDemo() {
  const { witTheme } = useSiteTheme();
  return (
    <div
      style={{
        borderRadius: '8px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
      }}
    >
      <Spreadsheet
        theme={witTheme}
        columns={columns}
        data={data}
        showRowNumbers={false}
        editable={false}
        sortable
        filterable
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
