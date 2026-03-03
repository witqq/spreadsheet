import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelPlugin, EXCEL_PLUGIN_NAME } from '../excel/src/index';

describe('ExcelPlugin', () => {
  let plugin: ExcelPlugin;

  beforeEach(() => {
    plugin = new ExcelPlugin();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe(EXCEL_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('install stores api reference', () => {
    const mockApi = {
      engine: {} as any,
      getPluginState: vi.fn(),
      setPluginState: vi.fn(),
    };
    plugin.install(mockApi);
    // Should not throw after install
    expect(() => plugin.destroy()).not.toThrow();
  });

  it('destroy clears api reference', async () => {
    const mockApi = {
      engine: {} as any,
      getPluginState: vi.fn(),
      setPluginState: vi.fn(),
    };
    plugin.install(mockApi);
    plugin.destroy();
    // After destroy, importExcel should throw
    await expect(plugin.importExcel(new ArrayBuffer(0))).rejects.toThrow('ExcelPlugin not installed');
  });

  it('importExcel throws when not installed', async () => {
    await expect(plugin.importExcel(new ArrayBuffer(0))).rejects.toThrow('ExcelPlugin not installed');
  });

  it('exportExcel throws when not installed', async () => {
    await expect(plugin.exportExcel()).rejects.toThrow('ExcelPlugin not installed');
  });

  it('EXCEL_PLUGIN_NAME is "excel"', () => {
    expect(EXCEL_PLUGIN_NAME).toBe('excel');
  });
});
