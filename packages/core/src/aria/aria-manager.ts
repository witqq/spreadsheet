// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * AriaManager — provides WCAG 2.1 AA accessibility for the canvas-based grid.
 *
 * Since the grid renders on canvas (invisible to screen readers), this manager
 * creates a hidden live region that announces cell content on navigation,
 * sort/filter state changes, and validation errors. It also sets ARIA attributes
 * on the scroll container (role="grid", aria-rowcount, aria-colcount).
 */

import type { EventBus } from '../events/event-bus';
import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { ColumnDef } from '../types/interfaces';
import type {
  SelectionChangeEvent,
  SortChangeEvent,
  FilterChangeEvent,
  CellValidationEvent,
} from '../events/event-types';
import type { ResolvedLocale } from '../locale/resolve-locale';

export interface AriaManagerConfig {
  container: HTMLElement;
  scrollContainer: HTMLElement;
  eventBus: EventBus;
  cellStore: CellStore;
  dataView: DataView;
  columns: ColumnDef[];
  rowCount: number;
}

export class AriaManager {
  private readonly container: HTMLElement;
  private readonly scrollContainer: HTMLElement;
  private readonly eventBus: EventBus;
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly columns: ColumnDef[];
  private readonly rowCount: number;
  private liveRegion: HTMLElement | null = null;
  private locale: ResolvedLocale | null = null;

  constructor(config: AriaManagerConfig) {
    this.container = config.container;
    this.scrollContainer = config.scrollContainer;
    this.eventBus = config.eventBus;
    this.cellStore = config.cellStore;
    this.dataView = config.dataView;
    this.columns = config.columns;
    this.rowCount = config.rowCount;
  }

  /** Set locale for accessibility announcements. */
  setLocale(locale: ResolvedLocale): void {
    this.locale = locale;
  }

  attach(): void {
    const visibleCols = this.columns.filter((c) => !c.hidden);

    // Set ARIA attributes on scroll container (it captures keyboard/mouse events)
    this.scrollContainer.setAttribute('role', 'grid');
    this.scrollContainer.setAttribute('aria-rowcount', String(this.rowCount));
    this.scrollContainer.setAttribute('aria-colcount', String(visibleCols.length));
    this.scrollContainer.setAttribute('aria-label', 'Spreadsheet');

    // Create visually-hidden live region for screen reader announcements
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.dataset.witAria = 'live-region';
    Object.assign(this.liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
      margin: '0',
      padding: '0',
      border: 'none',
    });
    this.container.appendChild(this.liveRegion);

    // Subscribe to events
    this.eventBus.on('selectionChange', this.handleSelectionChange);
    this.eventBus.on('sortChange', this.handleSortChange);
    this.eventBus.on('filterChange', this.handleFilterChange);
    this.eventBus.on('cellValidation', this.handleCellValidation);
  }

  detach(): void {
    // Remove ARIA attributes
    this.scrollContainer.removeAttribute('role');
    this.scrollContainer.removeAttribute('aria-rowcount');
    this.scrollContainer.removeAttribute('aria-colcount');
    this.scrollContainer.removeAttribute('aria-label');

    // Remove live region
    if (this.liveRegion) {
      this.liveRegion.remove();
      this.liveRegion = null;
    }

    // Unsubscribe
    this.eventBus.off('selectionChange', this.handleSelectionChange);
    this.eventBus.off('sortChange', this.handleSortChange);
    this.eventBus.off('filterChange', this.handleFilterChange);
    this.eventBus.off('cellValidation', this.handleCellValidation);
  }

  /** Announce a message to screen readers via the live region. */
  announce(message: string): void {
    if (!this.liveRegion) return;
    // Clear first to trigger re-announcement for duplicate messages
    this.liveRegion.textContent = '';
    requestAnimationFrame(() => {
      if (this.liveRegion) this.liveRegion.textContent = message;
    });
  }

  /** Get the current live region text (for testing). */
  getLiveRegionText(): string {
    return this.liveRegion?.textContent ?? '';
  }

  private handleSelectionChange = (event: SelectionChangeEvent): void => {
    const { selection } = event;
    const { row, col } = selection.activeCell;
    const physRow = this.dataView.getPhysicalRow(row);
    const cell = this.cellStore.get(physRow, col);

    const visibleCols = this.columns.filter((c) => !c.hidden);
    const colDef = visibleCols[col];
    const colName = colDef?.title ?? `Column ${col + 1}`;
    const value = cell?.value ?? '';
    const emptyLabel = this.locale?.aria?.cellEmpty ?? 'empty';
    const displayValue = value === '' ? emptyLabel : String(value);

    const tpl = this.locale?.aria?.cellAnnouncement ?? '{column}, Row {row}: {value}';
    this.announce(
      tpl
        .replace('{column}', colName)
        .replace('{row}', String(row + 1))
        .replace('{value}', displayValue),
    );
  };

  private handleSortChange = (event: SortChangeEvent): void => {
    if (event.sortColumns.length === 0) {
      this.announce(this.locale?.aria?.sortCleared ?? 'Sort cleared');
      return;
    }

    const ascLabel = this.locale?.aria?.sortAscending ?? 'ascending';
    const descLabel = this.locale?.aria?.sortDescending ?? 'descending';
    const descriptions = event.sortColumns.map((sc) => {
      const visibleCols = this.columns.filter((c) => !c.hidden);
      const colDef = visibleCols[sc.col];
      const colName = colDef?.title ?? `Column ${sc.col + 1}`;
      const dir = sc.direction === 'asc' ? ascLabel : descLabel;
      return `${colName} ${dir}`;
    });

    const tpl = this.locale?.aria?.sortedBy ?? 'Sorted by {columns}';
    this.announce(tpl.replace('{columns}', descriptions.join(', then ')));
  };

  private handleFilterChange = (event: FilterChangeEvent): void => {
    const { visibleRowCount, totalRowCount } = event;
    if (visibleRowCount === totalRowCount) {
      this.announce(this.locale?.aria?.filterCleared ?? 'Filter cleared, showing all rows');
    } else {
      const tpl = this.locale?.aria?.filterActive ?? 'Filtered: {visible} of {total} rows visible';
      this.announce(
        tpl.replace('{visible}', String(visibleRowCount)).replace('{total}', String(totalRowCount)),
      );
    }
  };

  private handleCellValidation = (event: CellValidationEvent): void => {
    if (!event.result.valid && event.result.message) {
      this.announce(`Validation error: ${event.result.message}`);
    }
  };
}
