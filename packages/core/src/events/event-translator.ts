// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * EventTranslator — DOM-to-spreadsheet event translator.
 *
 * Attaches DOM listeners (mousedown, mousemove, mouseup, dblclick, keydown)
 * to the scroll container element and translates pixel coordinates to cell
 * addresses using LayoutEngine hit-testing.
 *
 * Dispatches both internal grid events (gridMouseDown, etc.) and public
 * events (cellClick, cellDoubleClick) via the EventBus.
 */

import type { EventBus } from './event-bus';
import type { HitTestResult, GridMouseEvent } from './event-types';
import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { ColumnDef, CellType, CellValue } from '../types/interfaces';
import type { RowGroupManager } from '../grouping/row-group-manager';
import type { CellTypeRegistry } from '../types/cell-type-registry';
import type { HitZonePadding } from '../types/cell-type-registry';

/** Resolve per-side padding from a HitZonePadding value. */
function resolvePadding(p: HitZonePadding | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  return p;
}

/** Check if a point (relX, relY) falls within a zone expanded by its padding. */
function hitTestZone(
  relX: number,
  relY: number,
  zoneX: number,
  zoneY: number,
  zone: { width: number; height: number; padding?: HitZonePadding },
): boolean {
  const pad = resolvePadding(zone.padding);
  return (
    relX >= zoneX - pad.left &&
    relX <= zoneX + zone.width + pad.right &&
    relY >= zoneY - pad.top &&
    relY <= zoneY + zone.height + pad.bottom
  );
}

export interface EventTranslatorConfig {
  /** Scroll container element to attach listeners to. */
  scrollContainer: HTMLElement;
  /** Layout engine for coordinate-to-cell hit-testing. */
  layoutEngine: LayoutEngine;
  /** Scroll manager for current scroll position. */
  scrollManager: ScrollManager;
  /** Event bus for dispatching translated events. */
  eventBus: EventBus;
  /** Cell store for reading cell values in event payloads. */
  cellStore: CellStore;
  /** DataView for logical→physical row translation. */
  dataView: DataView;
  /** Column definitions for event payloads. */
  columns: ColumnDef[];
  /** Optional RowGroupManager for detecting group toggle clicks. */
  rowGroupManager?: RowGroupManager;
  /** Optional CellTypeRegistry for sub-cell hit zone resolution. */
  cellTypeRegistry?: CellTypeRegistry;
  /** Optional theme getter for hit zone resolution. */
  getTheme?: () => import('../themes/theme-types').SpreadsheetTheme;
}

export class EventTranslator {
  private readonly scrollContainer: HTMLElement;
  private readonly layoutEngine: LayoutEngine;
  private readonly scrollManager: ScrollManager;
  private readonly eventBus: EventBus;
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly columns: ColumnDef[];
  private readonly rowGroupManager?: RowGroupManager;
  private readonly cellTypeRegistry?: CellTypeRegistry;
  private readonly getTheme?: () => import('../themes/theme-types').SpreadsheetTheme;
  private attached = false;
  private frozenRows = 0;
  private frozenColumns = 0;

  // Touch gesture state
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private isTouchScrolling = false;
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  private static readonly TAP_THRESHOLD = 10;
  private static readonly TAP_MAX_DURATION = 300;
  private static readonly DOUBLE_TAP_INTERVAL = 300;
  private static readonly DOUBLE_TAP_DISTANCE = 20;

  constructor(config: EventTranslatorConfig) {
    this.scrollContainer = config.scrollContainer;
    this.layoutEngine = config.layoutEngine;
    this.scrollManager = config.scrollManager;
    this.eventBus = config.eventBus;
    this.cellStore = config.cellStore;
    this.dataView = config.dataView;
    this.columns = config.columns;
    this.rowGroupManager = config.rowGroupManager;
    this.cellTypeRegistry = config.cellTypeRegistry;
    this.getTheme = config.getTheme;
  }

  /** Update frozen pane configuration for hit-testing. */
  setFrozenConfig(frozenRows: number, frozenColumns: number): void {
    this.frozenRows = frozenRows;
    this.frozenColumns = frozenColumns;
  }

  /** Attach DOM event listeners to the scroll container. */
  attach(): void {
    if (this.attached) return;
    this.attached = true;

    const el = this.scrollContainer;
    el.addEventListener('mousedown', this.handleMouseDown);
    el.addEventListener('mousemove', this.handleMouseMove);
    el.addEventListener('mouseup', this.handleMouseUp);
    el.addEventListener('dblclick', this.handleDblClick);
    el.addEventListener('keydown', this.handleKeyDown);
    el.addEventListener('contextmenu', this.handleContextMenu);

    // Touch events for mobile/tablet
    el.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    el.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    el.addEventListener('touchend', this.handleTouchEnd);

    // Prevent pinch-zoom and double-tap zoom, allow pan scroll
    el.style.touchAction = 'pan-x pan-y';

    // Make focusable for keyboard events
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
      el.style.outline = 'none';
    }
  }

  /** Detach all DOM event listeners. */
  detach(): void {
    if (!this.attached) return;
    this.attached = false;

    const el = this.scrollContainer;
    el.removeEventListener('mousedown', this.handleMouseDown);
    el.removeEventListener('mousemove', this.handleMouseMove);
    el.removeEventListener('mouseup', this.handleMouseUp);
    el.removeEventListener('dblclick', this.handleDblClick);
    el.removeEventListener('keydown', this.handleKeyDown);
    el.removeEventListener('contextmenu', this.handleContextMenu);

    // Touch events
    el.removeEventListener('touchstart', this.handleTouchStart);
    el.removeEventListener('touchmove', this.handleTouchMove);
    el.removeEventListener('touchend', this.handleTouchEnd);
  }

  /**
   * Hit-test: convert pixel coordinates (relative to scroll container viewport)
   * to a grid region + cell address, accounting for scroll offset and header/gutter.
   */
  hitTest(offsetX: number, offsetY: number): HitTestResult {
    const scrollX = this.scrollManager.scrollX;
    const scrollY = this.scrollManager.scrollY;
    const headerHeight = this.layoutEngine.headerHeight;
    const rowNumberWidth = this.layoutEngine.rowNumberWidth;

    // Frozen pane boundaries
    const frH = this.layoutEngine.getFrozenRowsHeight(this.frozenRows);
    const frW = this.layoutEngine.getFrozenColsWidth(this.frozenColumns);
    const inFrozenRowZone = offsetY >= headerHeight && offsetY < headerHeight + frH;
    const inFrozenColZone = offsetX >= rowNumberWidth && offsetX < rowNumberWidth + frW;

    // Effective scroll offsets differ per frozen region
    const effectiveScrollX = inFrozenColZone ? 0 : scrollX;
    const effectiveScrollY = inFrozenRowZone ? 0 : scrollY;

    // Headers are rendered at fixed screen position (y=0 to y=headerHeight).
    // offsetY is relative to the scroll container viewport, so the header
    // is always at offsetY < headerHeight regardless of scroll position.
    const headerCheck = offsetY < headerHeight;
    const rowNumberCheck = offsetX < rowNumberWidth;

    if (headerCheck && rowNumberCheck) {
      return { region: 'corner', row: -1, col: -1 };
    }

    if (headerCheck) {
      // Column header click — use effective scrollX (0 for frozen col headers)
      const contentX = offsetX - rowNumberWidth + effectiveScrollX;
      const col = this.layoutEngine.getColAtX(contentX);
      if (col < 0) return { region: 'header', row: -1, col };

      // Check if click is on sort or filter icon zones (right side of header cell)
      const colX = this.layoutEngine.getColumnX(col);
      const colW = this.layoutEngine.getColumnWidth(col);
      const localX = contentX - colX;
      // Icon zone: rightmost 28px of cell (sort icon right, filter icon left)
      const iconZoneStart = colW - 28;

      if (localX >= iconZoneStart) {
        const midPoint = iconZoneStart + 14;
        if (localX >= midPoint) {
          return { region: 'header-sort-icon', row: -1, col };
        } else {
          return { region: 'header-filter-icon', row: -1, col };
        }
      }
      return { region: 'header', row: -1, col };
    }

    if (rowNumberCheck) {
      // Row number click — use effective scrollY (0 for frozen row area)
      const contentY = offsetY - headerHeight + effectiveScrollY;
      const row = this.layoutEngine.getRowAtY(contentY);

      // Check if click is on a row group toggle — entire gutter is toggle target
      if (this.rowGroupManager && row >= 0) {
        const physRow = this.dataView.getPhysicalRow(row);
        if (this.rowGroupManager.isGroupHeader(physRow)) {
          return { region: 'row-group-toggle', row, col: -1 };
        }
      }

      return { region: 'row-number', row, col: -1 };
    }

    // Cell area — translate both X and Y with region-appropriate scroll offsets
    const contentX = offsetX - rowNumberWidth + effectiveScrollX;
    const contentY = offsetY - headerHeight + effectiveScrollY;
    const row = this.layoutEngine.getRowAtY(contentY);
    const col = this.layoutEngine.getColAtX(contentX);

    if (row < 0 || col < 0) {
      return { region: 'outside', row: -1, col: -1 };
    }

    // Sub-cell hit zone resolution
    const zoneResult = this.resolveHitZone(row, col, contentX, contentY);

    return { region: 'cell', row, col, hitZone: zoneResult?.id, hitZoneCursor: zoneResult?.cursor };
  }

  /**
   * Resolve which sub-cell hit zone (if any) the point falls within.
   * Converts content coordinates to cell-relative coordinates and tests
   * against zones declared by the cell type renderer.
   */
  resolveHitZone(
    row: number,
    col: number,
    contentX: number,
    contentY: number,
  ): { id: string; cursor?: string } | undefined {
    if (!this.cellTypeRegistry) return undefined;

    const visibleCols = this.columns.filter((c) => !c.hidden);
    const column = visibleCols[col];
    if (!column) return undefined;

    const physRow = this.dataView.getPhysicalRow(row);
    const cellData = this.cellStore.get(physRow, col);
    const value = cellData?.value ?? null;
    const nullCellData = { value: null as CellValue };
    const safeCellData = cellData ?? nullCellData;

    const cellX = this.layoutEngine.getColumnX(col);
    const cellY = this.layoutEngine.getRowY(row);
    const cellW = this.layoutEngine.getColumnWidth(col);
    const cellH = this.layoutEngine.getRowHeight(row);

    // Convert to cell-relative coordinates
    const relX = contentX - cellX;
    const relY = contentY - cellY;

    // Get current theme from getter if available
    const theme = this.getTheme?.();

    // Check cell type renderer hit zones
    const cellType: CellType =
      column.type ?? cellData?.type ?? this.cellTypeRegistry.detectType(value);
    const renderer = this.cellTypeRegistry.get(cellType);

    if (renderer.getHitZones) {
      try {
        const zones = renderer.getHitZones(safeCellData, cellW, cellH, theme, physRow, col);
        if (zones && zones.length > 0) {
          for (const zone of zones) {
            if (hitTestZone(relX, relY, zone.x, zone.y, zone)) {
              return { id: zone.id, cursor: zone.cursor };
            }
          }
        }
      } catch {
        /* skip broken hit zone provider */
      }
    }

    // Check decorator hit zones
    const decorators = this.cellTypeRegistry.getDecorators(physRow, col, safeCellData);
    if (decorators.length > 0) {
      // Compute decorator offsets to translate zone coordinates
      let leftOffset = 0;
      for (const dec of decorators) {
        if (dec.position === 'left') {
          try {
            const w = dec.getWidth?.(safeCellData, cellH, undefined, theme, physRow, col) ?? 0;
            if (dec.getHitZones) {
              const zones = dec.getHitZones(w, cellH, safeCellData, physRow, col);
              for (const zone of zones) {
                const zoneX = leftOffset + zone.x;
                const zoneY = zone.y;
                if (hitTestZone(relX, relY, zoneX, zoneY, zone)) {
                  return { id: zone.id, cursor: zone.cursor };
                }
              }
            }
            leftOffset += w;
          } catch {
            /* skip broken decorator */
          }
        }
      }

      let rightOffset = 0;
      for (const dec of decorators) {
        if (dec.position === 'right') {
          try {
            const w = dec.getWidth?.(safeCellData, cellH, undefined, theme, physRow, col) ?? 0;
            rightOffset += w;
            if (dec.getHitZones) {
              const zones = dec.getHitZones(w, cellH, safeCellData, physRow, col);
              for (const zone of zones) {
                const zoneX = cellW - rightOffset + zone.x;
                const zoneY = zone.y;
                if (hitTestZone(relX, relY, zoneX, zoneY, zone)) {
                  return { id: zone.id, cursor: zone.cursor };
                }
              }
            }
          } catch {
            /* skip broken decorator */
          }
        }
      }

      // Overlay/underlay decorators — zones relative to cell origin
      for (const dec of decorators) {
        if ((dec.position === 'overlay' || dec.position === 'underlay') && dec.getHitZones) {
          try {
            const zones = dec.getHitZones(cellW, cellH, safeCellData, physRow, col);
            for (const zone of zones) {
              if (hitTestZone(relX, relY, zone.x, zone.y, zone)) {
                return { id: zone.id, cursor: zone.cursor };
              }
            }
          } catch {
            /* skip broken decorator */
          }
        }
      }
    }

    return undefined;
  }

  private translateMouseEvent(e: MouseEvent): GridMouseEvent {
    const hit = this.hitTest(e.offsetX, e.offsetY);
    return {
      ...hit,
      originalEvent: e,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    };
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const gridEvent = this.translateMouseEvent(e);
    this.eventBus.emit('gridMouseDown', gridEvent);

    // Focus the scroll container for keyboard events
    this.scrollContainer.focus();

    // Dispatch public cellClick for cell-region clicks
    if (gridEvent.region === 'cell' && gridEvent.row >= 0 && gridEvent.col >= 0) {
      this.emitCellClick(gridEvent);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (e.buttons === 0) {
      // No button pressed — emit hover event for tooltips/cursor
      const gridEvent = this.translateMouseEvent(e);
      this.eventBus.emit('gridMouseHover', gridEvent);

      // Dispatch public cellHover for cell-region hovers
      if (gridEvent.region === 'cell' && gridEvent.row >= 0 && gridEvent.col >= 0) {
        this.emitCellHover(gridEvent);
      }
      return;
    }
    const gridEvent = this.translateMouseEvent(e);
    this.eventBus.emit('gridMouseMove', gridEvent);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    const gridEvent = this.translateMouseEvent(e);
    this.eventBus.emit('gridMouseUp', gridEvent);
  };

  private handleDblClick = (e: MouseEvent): void => {
    const gridEvent = this.translateMouseEvent(e);
    if (gridEvent.region === 'cell' && gridEvent.row >= 0 && gridEvent.col >= 0) {
      this.emitCellDoubleClick(gridEvent);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.eventBus.emit('gridKeyDown', {
      originalEvent: e,
      key: e.key,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    });
  };

  private handleContextMenu = (e: MouseEvent): void => {
    const gridEvent = this.translateMouseEvent(e);
    e.preventDefault();
    this.eventBus.emit('gridContextMenu', gridEvent);
  };

  // --- Touch event handlers ---

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.isTouchScrolling = false;
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.isTouchScrolling || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - this.touchStartX);
    const dy = Math.abs(touch.clientY - this.touchStartY);
    if (dx > EventTranslator.TAP_THRESHOLD || dy > EventTranslator.TAP_THRESHOLD) {
      this.isTouchScrolling = true;
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (this.isTouchScrolling) return;

    const elapsed = Date.now() - this.touchStartTime;
    if (elapsed > EventTranslator.TAP_MAX_DURATION) return;

    const rect = this.scrollContainer.getBoundingClientRect();
    const offsetX = this.touchStartX - rect.left;
    const offsetY = this.touchStartY - rect.top;

    // Check double-tap
    const now = Date.now();
    const isDoubleTap =
      now - this.lastTapTime < EventTranslator.DOUBLE_TAP_INTERVAL &&
      Math.abs(this.touchStartX - this.lastTapX) < EventTranslator.DOUBLE_TAP_DISTANCE &&
      Math.abs(this.touchStartY - this.lastTapY) < EventTranslator.DOUBLE_TAP_DISTANCE;

    // Create synthetic MouseEvent for downstream compatibility
    const syntheticEvent = new MouseEvent(isDoubleTap ? 'dblclick' : 'mousedown', {
      clientX: this.touchStartX,
      clientY: this.touchStartY,
      button: 0,
      bubbles: true,
    });
    Object.defineProperty(syntheticEvent, 'offsetX', { value: offsetX });
    Object.defineProperty(syntheticEvent, 'offsetY', { value: offsetY });

    const hit = this.hitTest(offsetX, offsetY);
    const gridEvent: GridMouseEvent = {
      ...hit,
      originalEvent: syntheticEvent,
      shiftKey: false,
      ctrlKey: false,
    };

    if (isDoubleTap) {
      if (gridEvent.region === 'cell' && gridEvent.row >= 0 && gridEvent.col >= 0) {
        this.emitCellDoubleClick(gridEvent);
      }
      this.lastTapTime = 0;
    } else {
      this.eventBus.emit('gridMouseDown', gridEvent);
      this.eventBus.emit('gridMouseUp', gridEvent);
      this.scrollContainer.focus();

      if (gridEvent.region === 'cell' && gridEvent.row >= 0 && gridEvent.col >= 0) {
        this.emitCellClick(gridEvent);
      }

      this.lastTapTime = now;
      this.lastTapX = this.touchStartX;
      this.lastTapY = this.touchStartY;
    }

    // Prevent delayed mouse events from firing
    e.preventDefault();
  };

  private emitCellClick(gridEvent: GridMouseEvent): void {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    const column = visibleCols[gridEvent.col];
    if (!column) return;

    const cellData = this.cellStore.get(this.dataView.getPhysicalRow(gridEvent.row), gridEvent.col);
    this.eventBus.emit('cellClick', {
      row: gridEvent.row,
      col: gridEvent.col,
      value: cellData?.value ?? null,
      column,
      hitZone: gridEvent.hitZone,
    });
  }

  private emitCellDoubleClick(gridEvent: GridMouseEvent): void {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    const column = visibleCols[gridEvent.col];
    if (!column) return;

    const cellData = this.cellStore.get(this.dataView.getPhysicalRow(gridEvent.row), gridEvent.col);
    this.eventBus.emit('cellDoubleClick', {
      row: gridEvent.row,
      col: gridEvent.col,
      value: cellData?.value ?? null,
      column,
      hitZone: gridEvent.hitZone,
    });
  }

  private emitCellHover(gridEvent: GridMouseEvent): void {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    const column = visibleCols[gridEvent.col];
    if (!column) return;

    const cellData = this.cellStore.get(this.dataView.getPhysicalRow(gridEvent.row), gridEvent.col);
    this.eventBus.emit('cellHover', {
      row: gridEvent.row,
      col: gridEvent.col,
      value: cellData?.value ?? null,
      column,
      hitZone: gridEvent.hitZone,
    });
  }
}
