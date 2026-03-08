import { useRef, useEffect, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import { ExcelPlugin } from '@witqq/spreadsheet-plugins';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { DemoToolbar, StatusText } from './DemoToolbar';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(15);

export function ExcelDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const pluginRef = useRef<ExcelPlugin | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const plugin = new ExcelPlugin();
    engine.installPlugin(plugin);
    pluginRef.current = plugin;
  }, []);

  const handleExport = async () => {
    if (!pluginRef.current) return;
    try {
      setStatus('Exporting...');
      const buffer = await pluginRef.current.exportExcel({ sheetName: 'Employees' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'witqq-export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Exported to witqq-export.xlsx');
    } catch (e) {
      setStatus(`Export error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pluginRef.current) return;
    try {
      setStatus(`Importing ${file.name}...`);
      const buffer = await file.arrayBuffer();
      const result = await pluginRef.current.importExcel(buffer);
      setStatus(`Imported ${result.rowCount} rows from "${result.sheetName}"`);
    } catch (err) {
      setStatus(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }
    e.target.value = '';
  };

  return (
    <DemoWrapper
      title="Live Demo"
      description="Upload an .xlsx file or export the current table to Excel."
      height={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <DemoToolbar>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <DemoButton onClick={() => fileInputRef.current?.click()}>📥 Import Excel</DemoButton>
          <DemoButton onClick={handleExport}>📤 Export Excel</DemoButton>
          <StatusText>{status}</StatusText>
        </DemoToolbar>
        <div style={{ flex: 1 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={employeeColumns}
            data={data}
            showRowNumbers
            editable
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </DemoWrapper>
  );
}
