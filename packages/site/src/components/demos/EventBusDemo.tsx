import { useRef, useEffect, useState, useCallback } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type {
  CellEvent,
  CellChangeEvent,
  SelectionChangeEvent,
  ScrollEvent,
  SortChangeEvent,
} from '@witqq/spreadsheet';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { generateEmployees, employeeColumns } from './generate-data';
import { useSiteTheme } from './useSiteTheme';

const data = generateEmployees(30);
const sortableColumns = employeeColumns.map((col) => ({ ...col, sortable: true }));

const EVENT_COLORS: Record<string, string> = {
  cellClick: '#2563eb',
  cellChange: '#16a34a',
  selectionChange: '#9333ea',
  scroll: '#64748b',
  sortChange: '#ea580c',
};

interface EventEntry {
  time: string;
  name: string;
  detail: string;
}

export function EventBusDemo() {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);

  const clearLog = useCallback(() => setEvents([]), []);

  useEffect(() => {
    const engine = tableRef.current?.getInstance();
    if (!engine) return;
    const bus = engine.getEventBus();

    const logEvent = (name: string, detail: string) => {
      const time = new Date().toLocaleTimeString('en', { hour12: false });
      setEvents((prev) => [...prev.slice(-49), { time, name, detail }]);
    };

    const unsubs = [
      bus.on('cellClick', (e: CellEvent) => logEvent('cellClick', `row:${e.row} col:${e.col}`)),
      bus.on('cellChange', (e: CellChangeEvent) =>
        logEvent('cellChange', `[${e.row},${e.col}] "${e.oldValue}" → "${e.newValue}"`),
      ),
      bus.on('selectionChange', (e: SelectionChangeEvent) =>
        logEvent('selectionChange', `row:${e.selection.activeRow} col:${e.selection.activeCol}`),
      ),
      bus.on('scroll', (e: ScrollEvent) =>
        logEvent('scroll', `top:${Math.round(e.scrollTop)} left:${Math.round(e.scrollLeft)}`),
      ),
      bus.on('sortChange', (e: SortChangeEvent) =>
        logEvent('sortChange', `${e.sortColumns.length} column(s)`),
      ),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <DemoWrapper
      height={500}
      title="Live Demo"
      description="Interact with the table — click cells, edit values, sort columns, scroll. Events appear in the log below."
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Spreadsheet
            theme={witTheme}
            ref={tableRef}
            columns={sortableColumns}
            data={data}
            showRowNumbers
            editable
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div style={{ borderTop: '1px solid var(--sl-color-gray-5)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              background: 'var(--sl-color-gray-6)',
              fontSize: 11,
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--sl-color-white)' }}>
              Event Log ({events.length})
            </span>
            <DemoButton onClick={clearLog} style={{ padding: '2px 10px', fontSize: '0.72rem' }}>
              Clear
            </DemoButton>
          </div>
          <div
            ref={logRef}
            style={{
              height: 120,
              overflowY: 'auto',
              background: 'var(--sl-color-gray-7, var(--sl-color-gray-6))',
              padding: 8,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {events.length === 0 && (
              <div style={{ color: 'var(--sl-color-gray-3)', fontStyle: 'italic' }}>
                No events yet. Click a cell, edit a value, or scroll the table.
              </div>
            )}
            {events.map((evt, i) => (
              <div
                key={i}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: '18px',
                }}
              >
                <span style={{ color: 'var(--sl-color-gray-3)' }}>[{evt.time}]</span>{' '}
                <span
                  style={{
                    color: EVENT_COLORS[evt.name] || 'var(--sl-color-white)',
                    fontWeight: 600,
                  }}
                >
                  {evt.name}
                </span>
                {': '}
                <span style={{ color: 'var(--sl-color-gray-2)' }}>{evt.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoWrapper>
  );
}
