import { useRef, useEffect, useCallback, useState } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef, CellDecoratorRegistration } from '@witqq/spreadsheet';
import {
  lightTheme,
  darkTheme,
  PivotEngine,
  StreamingAdapter,
  enLocale,
  ruLocale,
} from '@witqq/spreadsheet';
import type { PivotColumnDef, CellEvent, PivotResult } from '@witqq/spreadsheet';
import {
  createContextMenuPlugin,
  FormulaPlugin,
  ConditionalFormattingPlugin,
  ExcelPlugin,
  ProgressiveLoaderPlugin,
} from '@witqq/spreadsheet-plugins';
import type { ContextMenuItem } from '@witqq/spreadsheet';
import { CollaborationPlugin } from '../../plugins/src/collaboration/collaboration-plugin';
import { WebSocketTransport } from '../../plugins/src/collaboration/ws-transport';
import type { WebSocketTransportConfig } from '../../plugins/src/collaboration/ws-transport';
import { RemoteCursorLayer } from '../../plugins/src/collaboration/cursor-layer';

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 60, type: 'number' },
  { key: 'firstName', title: 'First Name', width: 120 },
  { key: 'lastName', title: 'Last Name', width: 120 },
  { key: 'email', title: 'Email', width: 200 },
  { key: 'age', title: 'Age', width: 60, type: 'number' },
  { key: 'salary', title: 'Salary', width: 100, type: 'number' },
  { key: 'department', title: 'Department', width: 130 },
  { key: 'title', title: 'Job Title', width: 150 },
  { key: 'city', title: 'City', width: 120 },
  { key: 'country', title: 'Country', width: 100 },
  { key: 'phone', title: 'Phone', width: 130 },
  { key: 'startDate', title: 'Start Date', width: 110, type: 'date' },
  { key: 'hireDate', title: 'Hire Date', width: 110, type: 'date' },
  { key: 'lastLogin', title: 'Last Login', width: 160, type: 'datetime' },
  { key: 'active', title: 'Active', width: 60, type: 'boolean' },
  { key: 'status', title: 'Status', width: 80 },
  { key: 'rating', title: 'Rating', width: 70, type: 'number' },
  { key: 'projects', title: 'Projects', width: 80, type: 'number' },
  { key: 'team', title: 'Team', width: 100 },
  { key: 'office', title: 'Office', width: 80 },
  { key: 'floor', title: 'Floor', width: 60, type: 'number' },
  { key: 'manager', title: 'Manager', width: 120 },
  { key: 'notes', title: 'Notes', width: 200, wrapText: true },
  { key: 'budget', title: 'Budget', width: 100, type: 'number' },
  { key: 'overtime', title: 'Overtime', width: 80, type: 'number' },
  { key: 'bonus', title: 'Bonus', width: 90, type: 'number' },
  { key: 'region', title: 'Region', width: 110 },
  { key: 'skill1', title: 'Primary Skill', width: 130 },
  { key: 'skill2', title: 'Secondary Skill', width: 130 },
  { key: 'certifications', title: 'Certifications', width: 120, type: 'number' },
  { key: 'satisfaction', title: 'Satisfaction', width: 100, type: 'number' },
  { key: 'tenure', title: 'Tenure (yrs)', width: 100, type: 'number' },
  { key: 'lastReview', title: 'Last Review', width: 110 },
  { key: 'nextReview', title: 'Next Review', width: 110 },
  { key: 'mentor', title: 'Mentor', width: 120 },
  { key: 'building', title: 'Building', width: 90 },
  { key: 'parking', title: 'Parking Spot', width: 100 },
  { key: 'laptop', title: 'Laptop Model', width: 130 },
  { key: 'os', title: 'OS', width: 80 },
  { key: 'monitor', title: 'Monitor Size', width: 100 },
  { key: 'languages', title: 'Languages', width: 120, type: 'number' },
  { key: 'comments', title: 'Comments', width: 220, wrapText: true },
];

const firstNames = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
];
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
];
const departments = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Operations',
  'Legal',
  'Support',
];
const titles = [
  'Engineer',
  'Manager',
  'Analyst',
  'Designer',
  'Coordinator',
  'Director',
  'Specialist',
  'Lead',
];
const cities = ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Sydney', 'Toronto', 'Singapore'];
const countries = ['USA', 'UK', 'Japan', 'Germany', 'France', 'Australia', 'Canada', 'Singapore'];
const statuses = ['Active', 'On Leave', 'Remote'];
const teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
const offices = ['HQ', 'West', 'East', 'Remote'];
const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
const skills = [
  'TypeScript',
  'Python',
  'Java',
  'Go',
  'Rust',
  'C++',
  'Kotlin',
  'Swift',
  'Ruby',
  'Scala',
];
const laptops = ['MacBook Pro 16', 'MacBook Pro 14', 'ThinkPad X1', 'Dell XPS 15', 'Surface Pro'];
const oses = ['macOS', 'Windows', 'Linux'];
const monitors = ['27"', '32"', '34" UW', '24"', 'Dual 27"'];
const buildings = ['Main', 'Annex', 'Tower', 'Campus B'];

function generateData(count: number): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@example.com`,
      age: 22 + (i % 40),
      salary: 40000 + (i % 20) * 5000,
      department: departments[i % departments.length],
      title: titles[i % titles.length],
      city: cities[i % cities.length],
      country: countries[i % countries.length],
      phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
      active: i % 3 !== 0,
      startDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      hireDate: `2019-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      lastLogin: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
      status: statuses[i % statuses.length],
      rating: 1 + (i % 5),
      projects: 1 + (i % 10),
      team: teams[i % teams.length],
      office: offices[i % offices.length],
      floor: 1 + (i % 10),
      manager: `${firstNames[(i + 3) % firstNames.length]} ${lastNames[(i + 5) % lastNames.length]}`,
      notes: `Employee #${i + 1} in ${departments[i % departments.length]} department. Key responsibilities include project coordination and team collaboration across ${regions[i % regions.length]} region.`,
      budget: 10000 + (i % 50) * 1000,
      overtime: i % 40,
      bonus: 500 + (i % 30) * 200,
      region: regions[i % regions.length],
      skill1: skills[i % skills.length],
      skill2: skills[(i + 4) % skills.length],
      certifications: i % 8,
      satisfaction: 1 + (i % 10),
      tenure: (i % 20) + 1,
      lastReview: `2025-${String((i % 12) + 1).padStart(2, '0')}-15`,
      nextReview: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
      mentor: `${firstNames[(i + 7) % firstNames.length]} ${lastNames[(i + 2) % lastNames.length]}`,
      building: buildings[i % buildings.length],
      parking: `${String.fromCharCode(65 + (i % 4))}-${100 + (i % 200)}`,
      laptop: laptops[i % laptops.length],
      os: oses[i % oses.length],
      monitor: monitors[i % monitors.length],
      languages: 1 + (i % 5),
      comments: `Performance review cycle ${(i % 4) + 1}Q — ${statuses[i % statuses.length].toLowerCase()} employee based in ${cities[i % cities.length]}. Rated ${1 + (i % 5)}/5 stars with ${1 + (i % 10)} active projects.`,
    });
  }
  return rows;
}

const data1K = generateData(1_000);

export default function App() {
  const tableRef = useRef<SpreadsheetRef>(null);
  const excelPluginRef = useRef<ExcelPlugin | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelStatus, setExcelStatus] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isRu, setIsRu] = useState(false);
  const [rowMode, setRowMode] = useState<'1k' | '1m'>('1k');
  const [data, setData] = useState(data1K);
  const [groupsEnabled, setGroupsEnabled] = useState(false);
  const [pivotMode, setPivotMode] = useState(false);
  const [pivotColumns, setPivotColumns] = useState<PivotColumnDef[]>([]);
  const [pivotData, setPivotData] = useState<Record<string, unknown>[]>([]);
  const [pivotFrozen, setPivotFrozen] = useState(0);
  const [pivotResult, setPivotResult] = useState<PivotResult | null>(null);
  const [drillDown, setDrillDown] = useState<{
    title: string;
    columns: ColumnDef[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingCount, setStreamingCount] = useState(0);
  const [collabMode, setCollabMode] = useState(false);
  const [collabStatus, setCollabStatus] = useState('');
  const [stretchMode, setStretchMode] = useState<'none' | 'all' | 'last'>('none');
  const [autoRowHeightEnabled, setAutoRowHeightEnabled] = useState(true);
  const [progressiveMode, setProgressiveMode] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const collabRef = useRef<{
    plugin: CollaborationPlugin;
    transport: WebSocketTransport;
    cursorLayer: RemoteCursorLayer;
  } | null>(null);
  const pivotEngineRef = useRef(new PivotEngine());
  const streamingRef = useRef<{
    adapter: StreamingAdapter;
    interval: ReturnType<typeof setInterval>;
  } | null>(null);

  // Expose engine for E2E testing — re-run when pivot mode or drill-down changes (key forces remount)
  useEffect(() => {
    const engine = tableRef.current?.getInstance() ?? null;
    (window as unknown as Record<string, unknown>).__witEngine = engine;

    // Install cellClick handler for pivot drill-down
    if (pivotMode && !drillDown && engine && pivotResult) {
      const result = pivotResult;
      const sourceData = data as Record<string, unknown>[];
      const handleCellClick = (event: CellEvent) => {
        if (event.col < result.frozenColumns) return;
        const drillRows = pivotEngineRef.current.getDrillDownRows(
          sourceData,
          result,
          event.row,
          event.col,
        );
        if (drillRows.length === 0) return;

        // Build title from dimension values and column header
        const dimParts: string[] = [];
        for (const col of result.columns) {
          if (!col.frozen) break;
          const val = result.rows[event.row]?.[col.key];
          dimParts.push(`${col.title} = ${val}`);
        }
        const measureCol = result.columns[event.col];
        const title = `${dimParts.join(', ')} | ${measureCol?.title ?? ''}`;

        // Use the full column set for drill-down sheet (same as main table)
        setDrillDown({ title, columns, rows: drillRows });
      };
      engine.on('cellClick', handleCellClick);
      (window as unknown as Record<string, unknown>).__pivotResult = result;
      return () => {
        engine.off('cellClick', handleCellClick);
      };
    }
  }, [pivotMode, pivotResult, drillDown, data]);

  // Install plugins and configure validation — only for main table mode
  useEffect(() => {
    if (pivotMode || drillDown) return;
    const engine = tableRef.current?.getInstance() ?? null;

    // Set validation on Age column (index 4): must be 18-65
    if (engine) {
      engine.setColumnValidation(4, [
        { type: 'range', min: 18, max: 65, message: 'Age must be between 18 and 65' },
      ]);

      // Install context menu plugin with submenu demo items
      const menuItems: ContextMenuItem[] = [
        {
          id: 'insert-submenu',
          label: 'Insert',
          contexts: ['cell', 'header'],
          submenu: [
            { id: 'insert-row-above', label: 'Row Above', contexts: ['cell'], action: () => {} },
            { id: 'insert-row-below', label: 'Row Below', contexts: ['cell'], action: () => {} },
            { id: 'insert-col-left', label: 'Column Left', contexts: ['header'], action: () => {} },
            {
              id: 'insert-col-right',
              label: 'Column Right',
              contexts: ['header'],
              action: () => {},
            },
          ],
        },
        {
          id: 'format-submenu',
          label: 'Format',
          contexts: ['cell'],
          submenu: [
            {
              id: 'format-bold',
              label: 'Bold',
              shortcut: 'Ctrl+B',
              contexts: ['cell'],
              action: () => {},
            },
            {
              id: 'format-italic',
              label: 'Italic',
              shortcut: 'Ctrl+I',
              contexts: ['cell'],
              action: () => {},
            },
            {
              id: 'format-align',
              label: 'Alignment',
              contexts: ['cell'],
              submenu: [
                { id: 'align-left', label: 'Left', contexts: ['cell'], action: () => {} },
                { id: 'align-center', label: 'Center', contexts: ['cell'], action: () => {} },
                { id: 'align-right', label: 'Right', contexts: ['cell'], action: () => {} },
              ],
            },
          ],
        },
        // Copy/Paste/Cut already provided by engine's default context menu items
      ];
      engine.installPlugin(createContextMenuPlugin(menuItems));

      // Install formula plugin
      engine.installPlugin(new FormulaPlugin());

      // Install conditional formatting plugin
      const cfPlugin = new ConditionalFormattingPlugin();
      engine.installPlugin(cfPlugin);

      // Salary column (index 5): gradient scale from red (low) to green (high)
      cfPlugin.addRule(
        ConditionalFormattingPlugin.createGradientScale(
          { startRow: 0, endRow: 99999, startCol: 5, endCol: 5 },
          [
            { value: 40000, color: '#f8696b' },
            { value: 80000, color: '#63be7b' },
            { value: 135000, color: '#006100' },
          ],
        ),
      );

      // Rating column (index 15): icon set (stars, 1-5)
      cfPlugin.addRule(
        ConditionalFormattingPlugin.createIconSet(
          { startRow: 0, endRow: 99999, startCol: 15, endCol: 15 },
          'stars',
          {
            thresholds: [
              { value: 5, icon: '★★★★★' },
              { value: 4, icon: '★★★★☆' },
              { value: 3, icon: '★★★☆☆' },
              { value: 2, icon: '★★☆☆☆' },
              { value: 0, icon: '★☆☆☆☆' },
            ],
          },
        ),
      );

      // Budget column (index 22): data bars
      cfPlugin.addRule(
        ConditionalFormattingPlugin.createDataBar(
          { startRow: 0, endRow: 99999, startCol: 22, endCol: 22 },
          '#5b9bd5',
          { minValue: 10000, maxValue: 100000 },
        ),
      );

      // Install Excel I/O plugin
      const excelPlugin = new ExcelPlugin();
      engine.installPlugin(excelPlugin);
      excelPluginRef.current = excelPlugin;
      (window as unknown as Record<string, unknown>).__excelPlugin = excelPlugin;

      // Demo: merge a 2×3 region (rows 3-4, cols 2-4) with explicit value
      engine.mergeCells({ startRow: 3, startCol: 2, endRow: 4, endCol: 4 }, 'Merged Cell');

      // Cell decorator demo: status indicator dot on Status column (col 15)
      const statusDecorator: CellDecoratorRegistration = {
        decorator: {
          id: 'status-indicator',
          position: 'left',
          getWidth: () => 16,
          render: (ctx, cellData, x, y, width, height) => {
            const val = String(cellData.value ?? '');
            const color = val === 'Active' ? '#63be7b' : val === 'Remote' ? '#5b9bd5' : '#f8696b';
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x + width / 2, y + height / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          },
        },
        appliesTo: (_row, col) => col === 15,
      };
      engine.getCellTypeRegistry().addDecorator(statusDecorator);
    }
  }, [pivotMode, drillDown]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excelPluginRef.current) return;

    try {
      setExcelStatus('Importing...');
      const buffer = await file.arrayBuffer();
      const result = await excelPluginRef.current.importExcel(buffer);
      setExcelStatus(
        `Imported "${result.sheetName}": ${result.rowCount} rows, ${result.columns.length} cols`,
      );
    } catch (err) {
      setExcelStatus(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleExport = useCallback(async () => {
    if (!excelPluginRef.current) return;

    try {
      setExcelStatus('Exporting...');
      const buffer = await excelPluginRef.current.exportExcel({
        sheetName: 'Spreadsheet Export',
        maxRows: 10000,
      });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'witqq-export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setExcelStatus('Exported successfully');
    } catch (err) {
      setExcelStatus(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const handleToggleLocale = useCallback(() => {
    setIsRu((prev) => {
      const next = !prev;
      const engine = tableRef.current?.getInstance();
      if (engine) {
        engine.setLocale(next ? ruLocale : enLocale);
      }
      return next;
    });
  }, []);

  const handleToggleRows = useCallback(() => {
    const next = rowMode === '1k' ? '1m' : '1k';
    setRowMode(next);

    if (next === '1m') {
      // For 1M mode: set row count to 1M but only populate first 1000 rows
      // This tests LayoutEngine, viewport, and scroll at 1M scale
      const engine = tableRef.current?.getInstance();
      if (engine) {
        const start = performance.now();
        engine.setRowCount(1_000_000);
        const elapsed = performance.now() - start;
        setExcelStatus(`Loaded 1M rows in ${elapsed.toFixed(0)}ms`);
      }
    } else {
      // Back to 1K: restore data
      const start = performance.now();
      setData(data1K);
      const elapsed = performance.now() - start;
      setExcelStatus(`Loaded 1K rows in ${elapsed.toFixed(0)}ms`);
    }
  }, [rowMode]);

  const handlePrint = useCallback(() => {
    tableRef.current?.print();
  }, []);

  const handleToggleGroups = useCallback(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    if (groupsEnabled) {
      engine.clearRowGroups();
      setGroupsEnabled(false);
    } else {
      // 3-level nested grouping demo:
      // L1: row 0 → children [1, 10]
      //   L2: row 1 → children [2, 7]
      //     L3: row 2 → children [3, 4, 5, 6]
      //   (row 7..9 are direct children of L2 row 1)
      //   (row 10..14 are direct children of L1 row 0)
      // L1: row 15 → children [16, 20]
      //   L2: row 16 → children [17, 18, 19]
      const groups: { headerRow: number; childRows: number[] }[] = [
        { headerRow: 0, childRows: [1, 10, 11, 12, 13, 14] },
        { headerRow: 1, childRows: [2, 7, 8, 9] },
        { headerRow: 2, childRows: [3, 4, 5, 6] },
        { headerRow: 15, childRows: [16, 20, 21, 22, 23, 24] },
        { headerRow: 16, childRows: [17, 18, 19] },
      ];
      engine.setRowGroups(groups);
      engine.setGroupAggregates([
        { col: 5, fn: 'sum' as const },
        { col: 4, fn: 'average' as const },
      ]);
      setGroupsEnabled(true);
    }
  }, [groupsEnabled]);

  const handleTogglePivot = useCallback(() => {
    if (pivotMode) {
      setPivotMode(false);
      setPivotResult(null);
      setDrillDown(null);
    } else {
      const result = pivotEngineRef.current.compute(data as Record<string, unknown>[], {
        rowDimensions: ['region'],
        columnDimensions: ['department'],
        measures: [
          { field: 'salary', aggregate: 'sum', label: 'Total Salary' },
          { field: 'salary', aggregate: 'count', label: 'Headcount' },
          { field: 'salary', aggregate: 'average', label: 'Avg Salary' },
        ],
      });
      setPivotColumns(result.columns);
      setPivotData(result.rows);
      setPivotFrozen(result.frozenColumns);
      setPivotResult(result);
      setPivotMode(true);
    }
  }, [pivotMode, data]);

  const handleToggleStreaming = useCallback(() => {
    if (streaming) {
      // Stop streaming
      if (streamingRef.current) {
        clearInterval(streamingRef.current.interval);
        streamingRef.current.adapter.dispose();
        streamingRef.current = null;
      }
      setStreaming(false);
      setStreamingCount(0);
    } else {
      // Start streaming: push rows at high frequency
      const engine = tableRef.current?.getInstance();
      if (!engine) return;
      const adapter = new StreamingAdapter(engine, {
        columnKeys: columns.map((c) => c.key),
        throttleMs: 100,
      });
      (window as unknown as Record<string, unknown>).__streamingAdapter = adapter;
      let counter = 0;
      const interval = setInterval(() => {
        const batch: Record<string, unknown>[] = [];
        for (let j = 0; j < 10; j++) {
          const i = engine.getRowCount() + j;
          batch.push({
            id: i + 1,
            firstName: firstNames[i % firstNames.length],
            lastName: lastNames[i % lastNames.length],
            email: `stream.${i}@example.com`,
            age: 22 + (i % 40),
            salary: 40000 + (i % 20) * 5000,
            department: departments[i % departments.length],
            title: titles[i % titles.length],
            city: cities[i % cities.length],
            country: countries[i % countries.length],
            phone: `+1-555-${String(9000 + (counter * 10 + j)).padStart(4, '0')}`,
            active: i % 3 !== 0,
            startDate: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
            hireDate: `2024-06-${String((i % 28) + 1).padStart(2, '0')}`,
            lastLogin: `2025-06-${String((i % 28) + 1).padStart(2, '0')}T${String(9 + (i % 10)).padStart(2, '0')}:${String((i * 3) % 60).padStart(2, '0')}`,
            status: statuses[i % statuses.length],
            rating: 1 + (i % 5),
            projects: 1 + (i % 10),
            team: teams[i % teams.length],
            office: offices[i % offices.length],
            floor: 1 + (i % 10),
            manager: `${firstNames[(i + 3) % firstNames.length]} ${lastNames[(i + 5) % lastNames.length]}`,
            notes: `Streamed #${counter * 10 + j + 1}`,
            budget: 10000 + (i % 50) * 1000,
            overtime: i % 40,
            bonus: 500 + (i % 30) * 200,
            region: regions[i % regions.length],
            skill1: skills[i % skills.length],
            skill2: skills[(i + 4) % skills.length],
            certifications: i % 8,
            satisfaction: 1 + (i % 10),
            tenure: (i % 20) + 1,
            lastReview: `2025-06-15`,
            nextReview: `2026-06-15`,
            mentor: `${firstNames[(i + 7) % firstNames.length]} ${lastNames[(i + 2) % lastNames.length]}`,
            building: buildings[i % buildings.length],
            parking: `S-${100 + (i % 200)}`,
            laptop: laptops[i % laptops.length],
            os: oses[i % oses.length],
            monitor: monitors[i % monitors.length],
            languages: 1 + (i % 5),
            comments: `Stream batch ${counter + 1}`,
          });
        }
        adapter.pushRows(batch);
        counter++;
        setStreamingCount((prev) => prev + 10);
      }, 10); // 10ms interval = 100 batches/sec = 1000 rows/sec
      streamingRef.current = { adapter, interval };
      setStreaming(true);
    }
  }, [streaming]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (streamingRef.current) {
        clearInterval(streamingRef.current.interval);
        streamingRef.current.adapter.dispose();
      }
    };
  }, []);

  const handleToggleCollab = useCallback(async () => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;

    if (collabMode && collabRef.current) {
      engine.removePlugin('collaboration');
      collabRef.current.transport.disconnect();
      collabRef.current = null;
      setCollabMode(false);
      setCollabStatus('');
      return;
    }

    try {
      setCollabStatus('Connecting...');
      const wsHost = window.location.hostname || 'localhost';
      const cursorLayer = new RemoteCursorLayer();
      const config: WebSocketTransportConfig = {
        url: `ws://${wsHost}:3151`,
        onInit: (info) => {
          setCollabStatus(`Connected as ${info.clientId.slice(-4)} (${info.color})`);
          for (const c of info.cursors) {
            if (c.cursor) {
              cursorLayer.setCursor(c.clientId, {
                clientId: c.clientId,
                color: c.color,
                name: c.name,
                row: c.cursor.row,
                col: c.cursor.col,
              });
            }
          }
          engine.requestRender();
        },
        onCursor: (info) => {
          if (info.cursor) {
            cursorLayer.setCursor(info.clientId, {
              clientId: info.clientId,
              color: info.color,
              name: info.name,
              row: info.cursor.row,
              col: info.cursor.col,
            });
          } else {
            cursorLayer.removeCursor(info.clientId);
          }
          engine.requestRender();
        },
        onJoin: (info) => {
          setCollabStatus((s) => s + ` +${info.name}`);
        },
        onLeave: (info) => {
          cursorLayer.removeCursor(info.clientId);
          engine.requestRender();
        },
      };
      const transport = new WebSocketTransport(config);

      await transport.connect();

      const plugin = new CollaborationPlugin({
        clientId: transport.getClientId(),
        transport,
        cursorLayer,
        sendCursor: (cursor: { row: number; col: number } | null) => transport.sendCursor(cursor),
      });

      engine.installPlugin(plugin);
      collabRef.current = { plugin, transport, cursorLayer };
      setCollabMode(true);
    } catch (err) {
      console.error('Collaboration connection failed:', err);
      setCollabStatus('Connection failed');
      setTimeout(() => setCollabStatus(''), 3000);
    }
  }, [collabMode]);

  const handleProgressiveLoad = useCallback(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine || progressiveMode) return;

    setProgressiveMode(true);
    setProgressPct(0);

    const loader = new ProgressiveLoaderPlugin({
      totalRows: 50_000,
      columnKeys: columns.map((c) => c.key),
      generateRow: (i: number) => ({
        id: i + 1,
        firstName: firstNames[i % firstNames.length],
        lastName: lastNames[i % lastNames.length],
        email: `prog.${i}@example.com`,
        age: 22 + (i % 40),
        salary: 40000 + (i % 20) * 5000,
        department: departments[i % departments.length],
        title: titles[i % titles.length],
        city: cities[i % cities.length],
        country: countries[i % countries.length],
        phone: `+1-555-${String(5000 + i).padStart(4, '0')}`,
        active: i % 3 !== 0,
        startDate: `2022-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        hireDate: `2021-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        lastLogin: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T${String(7 + (i % 14)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`,
        status: statuses[i % statuses.length],
        rating: 1 + (i % 5),
        projects: 1 + (i % 10),
        team: teams[i % teams.length],
        office: offices[i % offices.length],
        floor: 1 + (i % 10),
        manager: `${firstNames[(i + 3) % firstNames.length]} ${lastNames[(i + 5) % lastNames.length]}`,
        notes: `Progressive load row #${i + 1} — ${departments[i % departments.length]} dept with extended description for text wrapping demo.`,
        budget: 10000 + (i % 50) * 1000,
        overtime: i % 40,
        bonus: 500 + (i % 30) * 200,
        region: regions[i % regions.length],
        skill1: skills[i % skills.length],
        skill2: skills[(i + 4) % skills.length],
        certifications: i % 8,
        satisfaction: 1 + (i % 10),
        tenure: (i % 20) + 1,
        lastReview: `2025-03-15`,
        nextReview: `2026-03-15`,
        mentor: `${firstNames[(i + 7) % firstNames.length]} ${lastNames[(i + 2) % lastNames.length]}`,
        building: buildings[i % buildings.length],
        parking: `P-${100 + (i % 200)}`,
        laptop: laptops[i % laptops.length],
        os: oses[i % oses.length],
        monitor: monitors[i % monitors.length],
        languages: 1 + (i % 5),
        comments: `Batch loaded employee ${i + 1}. Performance tracked across ${(i % 4) + 1} quarters.`,
      }),
      onProgress: (loaded, total) => {
        setProgressPct(Math.round((loaded / total) * 100));
      },
      onComplete: (loadTimeMs) => {
        setExcelStatus(`Progressive load: 50K rows in ${loadTimeMs.toFixed(0)}ms`);
        setProgressiveMode(false);
      },
    });
    engine.installPlugin(loader);
    loader.start();
  }, [progressiveMode]);

  const handleCycleStretch = useCallback(() => {
    const modes: Array<'none' | 'all' | 'last'> = ['none', 'all', 'last'];
    setStretchMode((prev) => {
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  const bg = isDark ? '#1a1a2e' : '#f8f9fa';
  const cardBg = isDark ? '#16213e' : '#ffffff';
  const borderColor = isDark ? '#2a2a4a' : '#e0e0e0';
  const accentColor = '#4361ee';
  const textMuted = isDark ? '#8888aa' : '#6c757d';
  const sectionTitle = {
    fontSize: 11,
    fontWeight: 700 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: textMuted,
    margin: '0 0 8px 0',
  };
  const btnBase = {
    padding: '6px 12px',
    cursor: 'pointer',
    border: `1px solid ${borderColor}`,
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: cardBg,
    color: isDark ? '#d4d4d4' : '#1f1f1f',
    transition: 'background-color 0.15s',
  };
  const btnActive = {
    ...btnBase,
    backgroundColor: accentColor,
    color: '#fff',
    borderColor: accentColor,
  };
  const badge = (text: string, color: string) => (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        backgroundColor: color + '22',
        color,
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      style={{
        height: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: bg,
        color: isDark ? '#d4d4d4' : '#1f1f1f',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: cardBg,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ ...btnBase, padding: '4px 8px', fontSize: 16, lineHeight: 1 }}
        >
          ☰
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4361ee, #7209b7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          witqq spreadsheet
        </h1>
        <span style={{ fontSize: 12, color: textMuted }}>Interactive Demo</span>
        <div style={{ flex: 1 }} />
        {streaming && badge(`+${streamingCount} rows`, '#2ecc71')}
        {progressiveMode && badge(`Loading ${progressPct}%`, accentColor)}
        {collabStatus && badge(collabStatus, collabMode ? '#2ecc71' : '#e74c3c')}
        {drillDown && (
          <>
            <button
              onClick={() => setDrillDown(null)}
              data-testid="drill-down-back"
              style={btnBase}
            >
              ← Back to Pivot
            </button>
            <span data-testid="drill-down-title" style={{ fontSize: 13, fontWeight: 600 }}>
              {drillDown.title} ({drillDown.rows.length} rows)
            </span>
          </>
        )}
        {excelStatus && (
          <span data-testid="excel-status" style={{ fontSize: 12, color: textMuted }}>
            {excelStatus}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          data-testid="file-input"
        />
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div
            style={{
              width: 240,
              flexShrink: 0,
              borderRight: `1px solid ${borderColor}`,
              backgroundColor: cardBg,
              overflowY: 'auto',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Display */}
            <div>
              <p style={sectionTitle}>Display</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={handleToggleTheme} data-testid="theme-toggle" style={btnBase}>
                  {isDark ? '☀️ Light Theme' : '🌙 Dark Theme'}
                </button>
                <button
                  onClick={handleToggleLocale}
                  data-testid="locale-toggle"
                  style={isRu ? btnActive : btnBase}
                >
                  {isRu ? '🇷🇺 Русский' : '🇬🇧 English'}
                </button>
                <button
                  onClick={handleCycleStretch}
                  data-testid="stretch-toggle"
                  style={stretchMode !== 'none' ? btnActive : btnBase}
                >
                  ↔ Stretch: {stretchMode}
                </button>
                <button
                  onClick={() => setAutoRowHeightEnabled(!autoRowHeightEnabled)}
                  data-testid="autoheight-toggle"
                  style={autoRowHeightEnabled ? btnActive : btnBase}
                >
                  ↕ Auto Row Height: {autoRowHeightEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Data */}
            <div>
              <p style={sectionTitle}>Data</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={handleToggleRows} data-testid="row-toggle" style={btnBase}>
                  📊 {rowMode === '1k' ? '→ 1M Rows' : '→ 1K Rows'}
                </button>
                <button
                  onClick={handleProgressiveLoad}
                  data-testid="progressive-toggle"
                  style={progressiveMode ? btnActive : btnBase}
                  disabled={progressiveMode}
                >
                  ⏳ Progressive Load 50K
                </button>
                <button
                  onClick={handleToggleStreaming}
                  data-testid="streaming-toggle"
                  style={streaming ? btnActive : btnBase}
                >
                  {streaming ? '⏹ Stop Stream' : '📡 Stream 1K/sec'}
                </button>
              </div>
            </div>

            {/* Views */}
            <div>
              <p style={sectionTitle}>Views</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={handleToggleGroups}
                  data-testid="group-toggle"
                  style={groupsEnabled ? btnActive : btnBase}
                >
                  {groupsEnabled ? '📂 Clear Groups' : '📁 Row Grouping'}
                </button>
                <button
                  onClick={handleTogglePivot}
                  data-testid="pivot-toggle"
                  style={pivotMode ? btnActive : btnBase}
                >
                  {pivotMode ? '📋 Table View' : '📊 Pivot Table'}
                </button>
              </div>
            </div>

            {/* I/O */}
            <div>
              <p style={sectionTitle}>Import / Export</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={handleImport} data-testid="import-btn" style={btnBase}>
                  📥 Import Excel
                </button>
                <button onClick={handleExport} data-testid="export-btn" style={btnBase}>
                  📤 Export Excel
                </button>
                <button onClick={handlePrint} data-testid="print-btn" style={btnBase}>
                  🖨️ Print
                </button>
              </div>
            </div>

            {/* Collaboration */}
            <div>
              <p style={sectionTitle}>Collaboration</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={handleToggleCollab}
                  data-testid="collab-toggle"
                  style={collabMode ? btnActive : btnBase}
                >
                  {collabMode ? '🔴 Disconnect' : '👥 Real-time Collab'}
                </button>
              </div>
            </div>

            {/* Features info */}
            <div
              style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${borderColor}` }}
            >
              <p style={sectionTitle}>Active Features</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {badge('Formulas', '#4361ee')}
                {badge('Context Menu', '#7209b7')}
                {badge('Submenus', '#7209b7')}
                {badge('Cond. Format', '#f72585')}
                {badge('Cell Validation', '#e67e22')}
                {badge('Merged Cells', '#3a86a7')}
                {badge('Frozen Panes', '#2d6a4f')}
                {badge('Date Picker', '#d63384')}
                {badge('Text Wrap', '#0077b6')}
                {autoRowHeightEnabled && badge('Auto Height', '#0096c7')}
                {stretchMode !== 'none' && badge(`Stretch: ${stretchMode}`, '#4895ef')}
              </div>
              <p style={{ fontSize: 11, color: textMuted, margin: '8px 0 0 0' }}>
                Right-click cells to see context menu with submenus. Double-click date columns to
                open date picker, or datetime columns for the combined date+time picker. Notes &amp;
                Comments columns have text wrapping enabled.
              </p>
            </div>
          </div>
        )}

        {/* Spreadsheet */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Spreadsheet
            key={
              drillDown
                ? 'drilldown'
                : pivotMode
                  ? 'pivot'
                  : `table-${stretchMode}-${autoRowHeightEnabled}`
            }
            ref={tableRef}
            columns={
              (drillDown ? drillDown.columns : pivotMode ? pivotColumns : columns) as ColumnDef[]
            }
            data={drillDown ? drillDown.rows : pivotMode ? pivotData : data}
            theme={isDark ? darkTheme : lightTheme}
            locale={isRu ? ruLocale : enLocale}
            frozenRows={drillDown ? 1 : pivotMode ? 1 : 2}
            frozenColumns={drillDown ? 0 : pivotMode ? pivotFrozen : 1}
            editable
            stretchColumns={stretchMode === 'none' ? undefined : stretchMode}
            autoRowHeight={autoRowHeightEnabled}
            style={{ width: '100%', flex: 1, minHeight: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
