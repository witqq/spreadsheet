// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellRange, CellValue } from '../types/interfaces';
import type { CellStore } from '../model/cell-store';
import type { SelectionManager } from '../selection/selection-manager';
import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CommandManager } from '../commands/command-manager';
import type { EventBus } from '../events/event-bus';
import type { DirtyTracker } from '../renderer/dirty-tracker';
import type { RenderScheduler } from '../renderer/render-scheduler';
import type { DataView } from '../dataview/data-view';
import type { MergeManager } from '../merge/merge-manager';
import { BatchCellEditCommand, type CellEdit } from '../commands/batch-cell-edit-command';
import { detectPattern, extendPattern } from './pattern-detector';

export type FillDirection = 'down' | 'up' | 'right' | 'left';

export interface AutofillManagerConfig {
  cellStore: CellStore;
  dataView: DataView;
  selectionManager: SelectionManager;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  dirtyTracker: DirtyTracker;
  renderScheduler: RenderScheduler;
  container: HTMLElement;
  rowCount: number;
  colCount: number;
  mergeManager?: MergeManager;
}

/** Pixel size of the fill handle square. */
const HANDLE_SIZE = 7;
/** Hit zone around the handle center for mouse detection. */
const HIT_ZONE = 5;

/**
 * AutofillManager — handles drag-to-fill from the selection handle.
 *
 * Renders a small fill handle at the bottom-right of the active selection.
 * Dragging fills cells with detected patterns (numbers, dates, text repeat).
 */
export class AutofillManager {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly selectionManager: SelectionManager;
  private readonly layoutEngine: LayoutEngine;
  private readonly scrollManager: ScrollManager;
  private readonly commandManager: CommandManager;
  private readonly eventBus: EventBus;
  private readonly dirtyTracker: DirtyTracker;
  private readonly renderScheduler: RenderScheduler;
  private readonly container: HTMLElement;
  private readonly rowCount: number;
  private readonly colCount: number;
  private readonly mergeManager?: MergeManager;

  private scrollContainer: HTMLElement | null = null;

  // Drag state
  private dragging = false;
  private fillRange: CellRange | null = null;
  private fillDirection: FillDirection | null = null;

  constructor(config: AutofillManagerConfig) {
    this.cellStore = config.cellStore;
    this.dataView = config.dataView;
    this.selectionManager = config.selectionManager;
    this.layoutEngine = config.layoutEngine;
    this.scrollManager = config.scrollManager;
    this.commandManager = config.commandManager;
    this.eventBus = config.eventBus;
    this.dirtyTracker = config.dirtyTracker;
    this.renderScheduler = config.renderScheduler;
    this.container = config.container;
    this.rowCount = config.rowCount;
    this.colCount = config.colCount;
    this.mergeManager = config.mergeManager;
  }

  attach(scrollContainer: HTMLElement): void {
    this.scrollContainer = scrollContainer;
    scrollContainer.addEventListener('mousedown', this.handleMouseDown, true);
    scrollContainer.addEventListener('mousemove', this.handleMouseHover);
  }

  detach(): void {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('mousedown', this.handleMouseDown, true);
      this.scrollContainer.removeEventListener('mousemove', this.handleMouseHover);
      this.scrollContainer = null;
    }
    this.cleanupDrag();
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** The current fill preview range (used by FillHandleLayer for rendering). */
  getFillRange(): CellRange | null {
    return this.fillRange;
  }

  getFillDirection(): FillDirection | null {
    return this.fillDirection;
  }

  /**
   * Compute the pixel position of the fill handle center relative to the scroll container.
   * Returns null if no selection or selection not visible.
   */
  getHandlePosition(): { x: number; y: number } | null {
    const sel = this.selectionManager.getSelection();
    if (sel.ranges.length === 0) return null;

    const range = sel.ranges[sel.ranges.length - 1];
    const endCol = Math.min(range.endCol, this.colCount - 1);
    const endRow = Math.min(range.endRow, this.rowCount - 1);

    const scrollX = this.scrollManager.scrollX;
    const scrollY = this.scrollManager.scrollY;
    const rnWidth = this.layoutEngine.rowNumberWidth;
    const headerH = this.layoutEngine.headerHeight;

    const colX = this.layoutEngine.getColumnX(endCol);
    const colW = this.layoutEngine.getColumnWidth(endCol);
    const rowY = this.layoutEngine.getRowY(endRow);
    const rowH = this.layoutEngine.getRowHeight(endRow);

    const x = rnWidth + colX + colW - scrollX;
    const y = headerH + rowY + rowH - scrollY;

    return { x, y };
  }

  /** Check if mouse position is within the fill handle hit zone. */
  isOnHandle(offsetX: number, offsetY: number): boolean {
    const pos = this.getHandlePosition();
    if (!pos) return false;
    return Math.abs(offsetX - pos.x) <= HIT_ZONE && Math.abs(offsetY - pos.y) <= HIT_ZONE;
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.isOnHandle(e.offsetX, e.offsetY)) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    this.dragging = true;
    this.fillRange = null;
    this.fillDirection = null;

    this.eventBus.emit('autofillStart', {
      sourceRange: this.getSourceRange(),
    });

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
  };

  private handleMouseHover = (e: MouseEvent): void => {
    if (this.dragging || !this.scrollContainer) return;
    const onHandle = this.isOnHandle(e.offsetX, e.offsetY);
    if (onHandle) {
      this.scrollContainer.style.cursor = 'crosshair';
    } else if (this.scrollContainer.style.cursor === 'crosshair') {
      this.scrollContainer.style.cursor = '';
    }
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.dragging || !this.scrollContainer) return;

    const rect = this.scrollContainer.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const sourceRange = this.getSourceRange();
    const newFill = this.computeFillRange(sourceRange, offsetX, offsetY);

    if (newFill) {
      this.fillRange = newFill.range;
      this.fillDirection = newFill.direction;
    } else {
      this.fillRange = null;
      this.fillDirection = null;
    }

    this.eventBus.emit('autofillPreview', {
      sourceRange,
      fillRange: this.fillRange,
      direction: this.fillDirection,
    });

    this.dirtyTracker.markDirty('full');
    this.renderScheduler.requestRender();
  };

  private handleDragEnd = (): void => {
    if (!this.dragging) return;

    const sourceRange = this.getSourceRange();
    const fillRange = this.fillRange;
    const fillDirection = this.fillDirection;

    this.cleanupDrag();

    if (fillRange && fillDirection) {
      this.executeFill(sourceRange, fillRange, fillDirection);

      this.eventBus.emit('autofillComplete', {
        sourceRange,
        fillRange,
        direction: fillDirection,
      });
    }

    this.dirtyTracker.markDirty('full');
    this.renderScheduler.requestRender();
  };

  private getSourceRange(): CellRange {
    const sel = this.selectionManager.getSelection();
    const r = sel.ranges[sel.ranges.length - 1] ?? {
      startRow: sel.activeCell.row,
      startCol: sel.activeCell.col,
      endRow: sel.activeCell.row,
      endCol: sel.activeCell.col,
    };
    return r;
  }

  /**
   * From mouse position during drag, compute the fill target range
   * and determine fill direction.
   */
  private computeFillRange(
    source: CellRange,
    offsetX: number,
    offsetY: number,
  ): { range: CellRange; direction: FillDirection } | null {
    const scrollX = this.scrollManager.scrollX;
    const scrollY = this.scrollManager.scrollY;
    const rnWidth = this.layoutEngine.rowNumberWidth;
    const headerH = this.layoutEngine.headerHeight;

    // Convert mouse to content coordinates
    const contentX = offsetX - rnWidth + scrollX;
    const contentY = offsetY - headerH + scrollY;

    // Find target cell under mouse
    const targetCol = this.layoutEngine.getColAtX(contentX);
    const targetRow = this.layoutEngine.getRowAtY(contentY);

    if (targetRow < 0 || targetCol < 0) return null;

    // Compute center of source range to determine dominant drag axis
    const srcCenterX =
      this.layoutEngine.getColumnX(source.startCol) +
      (this.layoutEngine.getColumnX(source.endCol) +
        this.layoutEngine.getColumnWidth(source.endCol) -
        this.layoutEngine.getColumnX(source.startCol)) /
        2;
    const srcCenterY =
      this.layoutEngine.getRowY(source.startRow) +
      (this.layoutEngine.getRowY(source.endRow) +
        this.layoutEngine.getRowHeight(source.endRow) -
        this.layoutEngine.getRowY(source.startRow)) /
        2;

    const deltaX = contentX - srcCenterX;
    const deltaY = contentY - srcCenterY;

    // Determine direction based on dominant axis
    const isVertical = Math.abs(deltaY) >= Math.abs(deltaX);

    if (isVertical) {
      if (targetRow > source.endRow) {
        return {
          range: {
            startRow: source.endRow + 1,
            startCol: source.startCol,
            endRow: Math.min(targetRow, this.rowCount - 1),
            endCol: source.endCol,
          },
          direction: 'down',
        };
      } else if (targetRow < source.startRow) {
        return {
          range: {
            startRow: Math.max(targetRow, 0),
            startCol: source.startCol,
            endRow: source.startRow - 1,
            endCol: source.endCol,
          },
          direction: 'up',
        };
      }
    } else {
      if (targetCol > source.endCol) {
        return {
          range: {
            startRow: source.startRow,
            startCol: source.endCol + 1,
            endRow: source.endRow,
            endCol: Math.min(targetCol, this.colCount - 1),
          },
          direction: 'right',
        };
      } else if (targetCol < source.startCol) {
        return {
          range: {
            startRow: source.startRow,
            startCol: Math.max(targetCol, 0),
            endRow: source.endRow,
            endCol: source.startCol - 1,
          },
          direction: 'left',
        };
      }
    }

    return null;
  }

  /**
   * Execute the fill operation: detect patterns in source, extend to fill range,
   * create undoable batch command.
   */
  private executeFill(source: CellRange, fill: CellRange, direction: FillDirection): void {
    const edits: CellEdit[] = [];

    if (direction === 'down' || direction === 'up') {
      // Vertical fill: pattern per column
      const fillRowCount = fill.endRow - fill.startRow + 1;
      for (let c = source.startCol; c <= source.endCol; c++) {
        const sourceValues = this.getColumnValues(source, c);
        const pattern = detectPattern(sourceValues);
        let extended: CellValue[];

        if (direction === 'down') {
          extended = extendPattern(pattern, fillRowCount);
        } else {
          // Up: reverse source values, extend, reverse result
          const reversed = [...sourceValues].reverse();
          const revPattern = detectPattern(reversed);
          extended = extendPattern(revPattern, fillRowCount).reverse();
        }

        for (let i = 0; i < fillRowCount; i++) {
          const r = fill.startRow + i;
          const physR = this.dataView.getPhysicalRow(r);
          // Skip hidden cells in merged regions in target area
          if (this.mergeManager?.isHiddenCell(physR, c)) continue;
          const oldValue = this.cellStore.get(physR, c)?.value ?? null;
          edits.push({ row: physR, col: c, oldValue, newValue: extended[i] });
        }
      }
    } else {
      // Horizontal fill: pattern per row
      const fillColCount = fill.endCol - fill.startCol + 1;
      for (let r = source.startRow; r <= source.endRow; r++) {
        const sourceValues = this.getRowValues(source, r);
        const pattern = detectPattern(sourceValues);
        let extended: CellValue[];

        if (direction === 'right') {
          extended = extendPattern(pattern, fillColCount);
        } else {
          const reversed = [...sourceValues].reverse();
          const revPattern = detectPattern(reversed);
          extended = extendPattern(revPattern, fillColCount).reverse();
        }

        for (let i = 0; i < fillColCount; i++) {
          const c = fill.startCol + i;
          const physR = this.dataView.getPhysicalRow(r);
          // Skip hidden cells in merged regions in target area
          if (this.mergeManager?.isHiddenCell(physR, c)) continue;
          const oldValue = this.cellStore.get(physR, c)?.value ?? null;
          edits.push({ row: physR, col: c, oldValue, newValue: extended[i] });
        }
      }
    }

    if (edits.length > 0) {
      const cmd = new BatchCellEditCommand(this.cellStore, edits);
      this.commandManager.execute(cmd);
      this.eventBus.emit('commandExecute', { description: cmd.description });

      // Select the filled range (source + fill combined)
      const combinedRange: CellRange = {
        startRow: Math.min(source.startRow, fill.startRow),
        startCol: Math.min(source.startCol, fill.startCol),
        endRow: Math.max(source.endRow, fill.endRow),
        endCol: Math.max(source.endCol, fill.endCol),
      };
      this.selectionManager.selectCell(combinedRange.startRow, combinedRange.startCol);
      this.selectionManager.extendSelection(combinedRange.endRow, combinedRange.endCol);
    }
  }

  private getColumnValues(range: CellRange, col: number): CellValue[] {
    const values: CellValue[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const physR = this.dataView.getPhysicalRow(r);
      // Skip hidden cells in merged regions — only read anchor values
      if (this.mergeManager?.isHiddenCell(physR, col)) continue;
      values.push(this.cellStore.get(physR, col)?.value ?? null);
    }
    return values;
  }

  private getRowValues(range: CellRange, row: number): CellValue[] {
    const values: CellValue[] = [];
    const physRow = this.dataView.getPhysicalRow(row);
    for (let c = range.startCol; c <= range.endCol; c++) {
      // Skip hidden cells in merged regions — only read anchor values
      if (this.mergeManager?.isHiddenCell(physRow, c)) continue;
      values.push(this.cellStore.get(physRow, c)?.value ?? null);
    }
    return values;
  }

  private cleanupDrag(): void {
    this.dragging = false;
    this.fillRange = null;
    this.fillDirection = null;
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    if (this.scrollContainer) {
      this.scrollContainer.style.cursor = '';
    }
  }
}

export { HANDLE_SIZE };
