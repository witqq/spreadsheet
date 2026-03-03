// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AriaManager } from '../src/aria/aria-manager';
import { EventBus } from '../src/events/event-bus';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';
import type { ColumnDef } from '../src/types/interfaces';

// Mock requestAnimationFrame synchronously for tests
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
});

describe('AriaManager', () => {
  let container: HTMLElement;
  let scrollContainer: HTMLElement;
  let eventBus: EventBus;
  let cellStore: CellStore;
  let dataView: DataView;
  let columns: ColumnDef[];
  let manager: AriaManager;

  beforeEach(() => {
    container = document.createElement('div');
    scrollContainer = document.createElement('div');
    container.appendChild(scrollContainer);
    eventBus = new EventBus();
    cellStore = new CellStore();
    dataView = new DataView({ totalRowCount: 100 });
    columns = [
      { key: 'id', title: 'ID', width: 60 },
      { key: 'name', title: 'Name', width: 120 },
      { key: 'email', title: 'Email', width: 200 },
    ] as ColumnDef[];

    manager = new AriaManager({
      container,
      scrollContainer,
      eventBus,
      cellStore,
      dataView,
      columns,
      rowCount: 100,
    });
  });

  describe('attach', () => {
    it('sets role="grid" on scroll container', () => {
      manager.attach();
      expect(scrollContainer.getAttribute('role')).toBe('grid');
    });

    it('sets aria-rowcount reflecting data dimensions', () => {
      manager.attach();
      expect(scrollContainer.getAttribute('aria-rowcount')).toBe('100');
    });

    it('sets aria-colcount reflecting visible columns', () => {
      manager.attach();
      expect(scrollContainer.getAttribute('aria-colcount')).toBe('3');
    });

    it('sets aria-label on scroll container', () => {
      manager.attach();
      expect(scrollContainer.getAttribute('aria-label')).toBe('Spreadsheet');
    });

    it('creates hidden live region with aria-live="polite"', () => {
      manager.attach();
      const liveRegion = container.querySelector('[data-wit-aria="live-region"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion!.getAttribute('role')).toBe('status');
      expect(liveRegion!.getAttribute('aria-atomic')).toBe('true');
    });

    it('live region is visually hidden', () => {
      manager.attach();
      const liveRegion = container.querySelector('[data-wit-aria="live-region"]') as HTMLElement;
      expect(liveRegion.style.position).toBe('absolute');
      expect(liveRegion.style.width).toBe('1px');
      expect(liveRegion.style.height).toBe('1px');
      expect(liveRegion.style.overflow).toBe('hidden');
    });

    it('excludes hidden columns from aria-colcount', () => {
      const colsWithHidden = [
        { key: 'id', title: 'ID', width: 60 },
        { key: 'hidden', title: 'Hidden', width: 100, hidden: true },
        { key: 'name', title: 'Name', width: 120 },
      ] as ColumnDef[];

      const mgr = new AriaManager({
        container,
        scrollContainer,
        eventBus,
        cellStore,
        dataView,
        columns: colsWithHidden,
        rowCount: 50,
      });
      mgr.attach();
      expect(scrollContainer.getAttribute('aria-colcount')).toBe('2');
      mgr.detach();
    });
  });

  describe('detach', () => {
    it('removes ARIA attributes from scroll container', () => {
      manager.attach();
      manager.detach();
      expect(scrollContainer.getAttribute('role')).toBeNull();
      expect(scrollContainer.getAttribute('aria-rowcount')).toBeNull();
      expect(scrollContainer.getAttribute('aria-colcount')).toBeNull();
      expect(scrollContainer.getAttribute('aria-label')).toBeNull();
    });

    it('removes live region from DOM', () => {
      manager.attach();
      manager.detach();
      const liveRegion = container.querySelector('[data-wit-aria="live-region"]');
      expect(liveRegion).toBeNull();
    });

    it('stops responding to events after detach', () => {
      manager.attach();
      manager.detach();

      eventBus.emit('selectionChange', {
        selection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
          type: 'cell',
        },
        previousSelection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [],
          type: 'cell',
        },
      });

      // No live region exists, so no crash
      expect(manager.getLiveRegionText()).toBe('');
    });
  });

  describe('selection announcements', () => {
    it('announces cell content on selection change', () => {
      cellStore.setValue(0, 0, 42);
      manager.attach();

      eventBus.emit('selectionChange', {
        selection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
          type: 'cell',
        },
        previousSelection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [],
          type: 'cell',
        },
      });

      expect(manager.getLiveRegionText()).toBe('ID, Row 1: 42');
    });

    it('announces "empty" for cells without value', () => {
      manager.attach();

      eventBus.emit('selectionChange', {
        selection: {
          activeCell: { row: 5, col: 1 },
          anchorCell: { row: 5, col: 1 },
          ranges: [{ startRow: 5, endRow: 5, startCol: 1, endCol: 1 }],
          type: 'cell',
        },
        previousSelection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [],
          type: 'cell',
        },
      });

      expect(manager.getLiveRegionText()).toBe('Name, Row 6: empty');
    });

    it('uses column title in announcement', () => {
      cellStore.setValue(0, 2, 'test@example.com');
      manager.attach();

      eventBus.emit('selectionChange', {
        selection: {
          activeCell: { row: 0, col: 2 },
          anchorCell: { row: 0, col: 2 },
          ranges: [{ startRow: 0, endRow: 0, startCol: 2, endCol: 2 }],
          type: 'cell',
        },
        previousSelection: {
          activeCell: { row: 0, col: 0 },
          anchorCell: { row: 0, col: 0 },
          ranges: [],
          type: 'cell',
        },
      });

      expect(manager.getLiveRegionText()).toBe('Email, Row 1: test@example.com');
    });
  });

  describe('sort announcements', () => {
    it('announces sort change with column name and direction', () => {
      manager.attach();

      eventBus.emit('sortChange', {
        sortColumns: [{ col: 1, direction: 'asc' }],
      });

      expect(manager.getLiveRegionText()).toBe('Sorted by Name ascending');
    });

    it('announces multi-column sort', () => {
      manager.attach();

      eventBus.emit('sortChange', {
        sortColumns: [
          { col: 0, direction: 'desc' },
          { col: 2, direction: 'asc' },
        ],
      });

      expect(manager.getLiveRegionText()).toBe('Sorted by ID descending, then Email ascending');
    });

    it('announces sort cleared', () => {
      manager.attach();

      eventBus.emit('sortChange', { sortColumns: [] });

      expect(manager.getLiveRegionText()).toBe('Sort cleared');
    });
  });

  describe('filter announcements', () => {
    it('announces filtered row count', () => {
      manager.attach();

      eventBus.emit('filterChange', { visibleRowCount: 25, totalRowCount: 100 });

      expect(manager.getLiveRegionText()).toBe('Filtered: 25 of 100 rows visible');
    });

    it('announces filter cleared when all rows visible', () => {
      manager.attach();

      eventBus.emit('filterChange', { visibleRowCount: 100, totalRowCount: 100 });

      expect(manager.getLiveRegionText()).toBe('Filter cleared, showing all rows');
    });
  });

  describe('validation announcements', () => {
    it('announces validation error message', () => {
      manager.attach();

      eventBus.emit('cellValidation', {
        row: 0,
        col: 1,
        result: { valid: false, message: 'Value must be a number' },
      });

      expect(manager.getLiveRegionText()).toBe('Validation error: Value must be a number');
    });

    it('does not announce valid results', () => {
      manager.attach();

      eventBus.emit('cellValidation', {
        row: 0,
        col: 1,
        result: { valid: true },
      });

      // rAF sets empty string first, then no update since valid
      expect(manager.getLiveRegionText()).toBe('');
    });
  });

  describe('announce', () => {
    it('sets text on live region', () => {
      manager.attach();
      manager.announce('Test message');
      expect(manager.getLiveRegionText()).toBe('Test message');
    });

    it('does nothing when detached', () => {
      // Not attached, so no live region
      manager.announce('Should not crash');
      expect(manager.getLiveRegionText()).toBe('');
    });
  });
});
