import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ScenarioContainer, tableStyle } from './shared';

const columns: ColumnDef[] = [
  { key: 'task', title: 'Task', width: 200 },
  { key: 'status', title: 'Status', width: 120 },
  { key: 'priority', title: 'Priority', width: 100 },
  { key: 'assignee', title: 'Assignee', width: 130 },
];
const data = [
  { task: 'Design mockups', status: 'Done', priority: 'High', assignee: 'Alice' },
  { task: 'Implement API', status: 'In Progress', priority: 'High', assignee: 'Bob' },
  { task: 'Write tests', status: 'Pending', priority: 'Medium', assignee: 'Carol' },
  { task: 'Code review', status: 'Pending', priority: 'Low', assignee: 'David' },
  { task: 'Deploy', status: 'Blocked', priority: 'High', assignee: 'Eve' },
];

export function DemoUndoRedo() {
  return (
    <ScenarioContainer width={580} height={250}>
      <Spreadsheet columns={columns} data={data} editable showRowNumbers style={tableStyle} />
    </ScenarioContainer>
  );
}
