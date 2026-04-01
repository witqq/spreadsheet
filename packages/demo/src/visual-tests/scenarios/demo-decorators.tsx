import { useRef, useEffect } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { DecoratorsPlugin } from '@witqq/spreadsheet-plugins';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'task', title: 'Task', width: 180 },
  { key: 'assignee', title: 'Assignee', width: 120 },
  { key: 'progress', title: 'Progress', width: 130, type: 'number' },
  { key: 'priority', title: 'Priority', width: 100 },
  { key: 'link', title: 'Documentation', width: 150 },
  { key: 'status', title: 'Status', width: 100 },
];

const data = [
  { task: 'Platform Migration', assignee: 'Alice', progress: 100, priority: 'High', link: 'Migration Guide', status: 'Complete' },
  { task: '  Auth Module', assignee: 'Bob', progress: 95, priority: 'High', link: 'Auth Docs', status: 'Complete' },
  { task: '    OAuth Provider', assignee: 'Carol', progress: 100, priority: 'Medium', link: '', status: 'Complete' },
  { task: '    Session Store', assignee: 'Dave', progress: 90, priority: 'Medium', link: '', status: 'Complete' },
  { task: '  Data Layer', assignee: 'Eve', progress: 60, priority: 'High', link: 'Data Docs', status: 'Active' },
  { task: '    Query Engine', assignee: 'Frank', progress: 45, priority: 'High', link: '', status: 'Active' },
  { task: '    Cache Layer', assignee: 'Grace', progress: 75, priority: 'Low', link: '', status: 'Active' },
  { task: '  UI Components', assignee: 'Henry', progress: 30, priority: 'Medium', link: 'UI Docs', status: 'Active' },
  { task: '    Grid Widget', assignee: 'Ivy', progress: 10, priority: 'Medium', link: '', status: 'Syncing' },
  { task: '    Charts', assignee: 'Jack', progress: 5, priority: 'Low', link: '', status: 'Syncing' },
];

export function DemoDecorators() {
  const ref = useRef<SpreadsheetRef>(null);

  useEffect(() => {
    const engine = ref.current?.getInstance();
    if (!engine) return;

    engine.installPlugin(new DecoratorsPlugin());

    const cellStore = engine.getCellStore();

    // TreeExpander: hierarchical task list (col 0)
    const treeLevels = [0, 1, 2, 2, 1, 2, 2, 1, 2, 2];
    const treeExpanded = [true, true, true, true, true, true, true, true, true, true];
    for (let row = 0; row < data.length; row++) {
      cellStore.setMetadata(row, 0, {
        treeLevel: treeLevels[row],
        treeExpanded: treeExpanded[row],
      });
    }

    // ProgressBar: show progress percentage (col 2)
    for (let row = 0; row < data.length; row++) {
      cellStore.setMetadata(row, 2, {
        progress: data[row].progress / 100,
      });
    }

    // SortIcon: priority column header indication (col 3)
    const sortDirs: Array<'asc' | 'desc' | undefined> = [
      'desc', undefined, undefined, undefined, 'asc',
      undefined, undefined, undefined, undefined, undefined,
    ];
    for (let row = 0; row < data.length; row++) {
      if (sortDirs[row]) {
        cellStore.setMetadata(row, 3, { sortDirection: sortDirs[row] });
      }
    }

    // Link: documentation links (col 4)
    const links = [
      'https://example.com/migration',
      'https://example.com/auth',
      '', '', 
      'https://example.com/data',
      '', '',
      'https://example.com/ui',
      '', '',
    ];
    for (let row = 0; row < data.length; row++) {
      if (links[row]) {
        cellStore.setMetadata(row, 4, {
          link: { url: links[row], label: data[row].link },
        });
      }
    }

    // Spinner: loading indicator for syncing rows (col 5)
    for (let row = 0; row < data.length; row++) {
      if (data[row].status === 'Syncing') {
        cellStore.setMetadata(row, 5, { loading: true });
      }
    }

    // Image: avatar thumbnails for assignees (col 1)
    // Small SVG data URIs as placeholder avatars with initials
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5'];
    for (let row = 0; row < data.length; row++) {
      const name = data[row].assignee;
      const initial = name.charAt(0);
      const color = colors[row % colors.length];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" rx="4" fill="${color}"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">${initial}</text></svg>`;
      const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`;
      cellStore.setMetadata(row, 1, { imageUrl: dataUri });
    }

    engine.requestRender();
  }, []);

  return (
    <ScenarioContainer width={900} height={400}>
      <Spreadsheet
        ref={ref}
        columns={columns}
        data={data}
        showRowNumbers
        style={tableStyle}
      />
    </ScenarioContainer>
  );
}
