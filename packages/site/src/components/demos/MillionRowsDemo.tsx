import { useRef, useState, useEffect, useCallback } from 'react';
import { Spreadsheet } from '@witqq/spreadsheet-react';
import type { SpreadsheetRef } from '@witqq/spreadsheet-react';
import type { ColumnDef } from '@witqq/spreadsheet';
import { ProgressiveLoaderPlugin } from '@witqq/spreadsheet-plugins';
import { DemoWrapper } from './DemoWrapper';
import { DemoButton } from './DemoButton';
import { useSiteTheme } from './useSiteTheme';

const TARGET_ROWS = 1_000_000;

const columns: ColumnDef[] = [
  { key: 'id', title: 'ID', width: 70, type: 'number', sortable: true },
  { key: 'name', title: 'Name', width: 160, type: 'string', sortable: true, filterable: true },
  { key: 'department', title: 'Department', width: 130, type: 'string', sortable: true, filterable: true },
  { key: 'salary', title: 'Salary', width: 100, type: 'number', sortable: true },
  { key: 'city', title: 'City', width: 120, type: 'string', sortable: true, filterable: true },
  { key: 'startDate', title: 'Start Date', width: 110, type: 'date', sortable: true },
  { key: 'active', title: 'Active', width: 70, type: 'boolean' },
];

const COLUMN_KEYS = columns.map((c) => c.key);

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack', 'Karen', 'Leo', 'Mona', 'Nick', 'Olivia', 'Paul', 'Quinn', 'Rita', 'Sam', 'Tina'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Design', 'Support', 'Legal'];
const CITIES = ['New York', 'London', 'Tokyo', 'Berlin', 'Paris', 'Sydney', 'Toronto', 'Singapore'];

// Stable reference — prevents React useEffect from wiping CellStore on re-renders
const EMPTY_DATA: Record<string, unknown>[] = [];

function generateRow(idx: number): Record<string, unknown> {
  const fi = idx % FIRST_NAMES.length;
  const li = (idx * 7) % LAST_NAMES.length;
  return {
    id: idx + 1,
    name: `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`,
    department: DEPARTMENTS[idx % DEPARTMENTS.length],
    salary: 40000 + (idx % 20) * 5000,
    city: CITIES[(idx * 3) % CITIES.length],
    startDate: `${2015 + (idx % 10)}-${String(1 + (idx % 12)).padStart(2, '0')}-${String(1 + (idx % 28)).padStart(2, '0')}`,
    active: idx % 5 !== 0,
  };
}

interface MillionRowsDemoProps {
  autoPreload?: boolean;
  showExplanation?: boolean;
  height?: number;
}

export function MillionRowsDemo({ height = 500 }: MillionRowsDemoProps) {
  const { witTheme } = useSiteTheme();
  const tableRef = useRef<SpreadsheetRef>(null);
  const loaderRef = useRef<ProgressiveLoaderPlugin | null>(null);
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedRows, setLoadedRows] = useState(0);
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  // FPS counter
  useEffect(() => {
    if (!active) return;
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;
    function tick() {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  const handleActivate = useCallback(() => {
    setActive(true);
  }, []);

  // Install plugin and start loading after table mounts
  useEffect(() => {
    if (!active) return;

    const checkEngine = () => {
      const engine = tableRef.current?.getInstance();
      if (!engine) {
        requestAnimationFrame(checkEngine);
        return;
      }

      const loader = new ProgressiveLoaderPlugin({
        totalRows: TARGET_ROWS,
        columnKeys: COLUMN_KEYS,
        generateRow,
        onProgress: (loaded, total) => {
          setLoadedRows(loaded);
          setProgress(Math.round((loaded / total) * 100));
        },
        onComplete: (elapsed) => {
          setLoadTime(elapsed);
          setProgress(100);
          setLoadedRows(TARGET_ROWS);
        },
      });
      loaderRef.current = loader;
      engine.installPlugin(loader);
      loader.start();
    };

    requestAnimationFrame(checkEngine);

    return () => {
      loaderRef.current?.cancel();
    };
  }, [active]);

  if (!active) {
    return (
      <DemoWrapper title="1,000,000 Rows Demo" description="Canvas virtual scrolling renders only visible rows — constant 60 FPS regardless of dataset size." height={height}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--sl-color-accent, #3b82f6)' }}>1,000,000</div>
          <div style={{ fontSize: '1.1rem', color: 'var(--sl-color-gray-2, #475569)' }}>rows rendered at 60 FPS</div>
          <DemoButton
            variant="primary"
            onClick={handleActivate}
            style={{ padding: '0.75rem 2rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            ▶ Load 1M Rows
          </DemoButton>
          <div style={{ fontSize: '0.8rem', color: 'var(--sl-color-gray-3, #94a3b8)', textAlign: 'center', maxWidth: 400, marginTop: '0.5rem' }}>
            Only visible rows are drawn on canvas. Scroll through a million rows with zero jank.
          </div>
        </div>
      </DemoWrapper>
    );
  }

  const fmt = new Intl.NumberFormat('en-US');
  const desc = loadTime !== null
    ? `Loaded in ${loadTime}ms · ${fmt.format(TARGET_ROWS)} rows · ${fps !== null ? fps + ' FPS' : 'Measuring...'}`
    : `Loading ${fmt.format(loadedRows)} / ${fmt.format(TARGET_ROWS)} (${progress}%) · ${fps !== null ? fps + ' FPS' : ''}`;

  return (
    <DemoWrapper
      title="1,000,000 Rows — Live"
      description={desc}
      height={height}
    >
      <Spreadsheet
        theme={witTheme}
        ref={tableRef}
        columns={columns}
        data={EMPTY_DATA}
        showRowNumbers
        editable={false}
        sortable
        filterable
        style={{ width: '100%', height: '100%' }}
      />
    </DemoWrapper>
  );
}

export function MillionRowsExplanation() {
  return (
    <div style={{ padding: '1rem 0', fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--sl-color-gray-1, #334155)' }}>
      <h3 style={{ marginTop: 0 }}>How It Works</h3>
      <p>
        @witqq/spreadsheet uses <strong>canvas-based virtual scrolling</strong> — only the rows visible in the viewport are
        rendered on each frame. The engine calculates which rows are visible based on scroll position and row heights,
        then draws only those cells on a single <code>&lt;canvas&gt;</code> element.
      </p>
      <p>
        The <strong>ProgressiveLoaderPlugin</strong> streams data in time-budgeted chunks using
        <code>scheduler.yield()</code> (with <code>MessageChannel</code> fallback). Each chunk runs for ~50ms then yields
        to the browser. The table is interactive immediately — you can scroll, sort, and filter
        while remaining data loads. A progress overlay shows loading status.
      </p>
      <p>
        <strong>Why it's fast:</strong>
      </p>
      <ul>
        <li><strong>O(viewport)</strong> rendering — drawing cost is proportional to visible rows (~30-50), not total rows (1M)</li>
        <li><strong>Canvas 2D API</strong> — GPU-accelerated text and shape rendering, no DOM node creation per cell</li>
        <li><strong>Float64Array layout</strong> — cumulative row positions in typed arrays for O(1) cell rect lookups and O(log n) scroll-to-row</li>
        <li><strong>rAF coalescing</strong> — multiple changes within a frame produce a single render, via <code>requestAnimationFrame</code></li>
        <li><strong>Text measurement cache</strong> — LRU cache (10K entries) avoids redundant <code>ctx.measureText()</code> calls</li>
        <li><strong>Progressive loading</strong> — data streams in chunks without blocking the UI thread</li>
      </ul>
      <p>
        The data array itself lives in memory (~200-400MB for 1M rows), but rendering performance is independent
        of dataset size. Scroll at any speed — the frame budget stays under 16ms.
      </p>
    </div>
  );
}
