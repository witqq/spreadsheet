// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ColumnResizeManager — handles column resize by dragging header borders.
 *
 * Detects mouse proximity to column header right edges, shows col-resize cursor,
 * manages drag state with visual indicator, and commits resize via commands.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { GridGeometry } from '../renderer/grid-geometry';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CommandManager } from '../commands/command-manager';
import type { EventBus } from '../events/event-bus';
import type { ColumnDef } from '../types/interfaces';
import { ResizeColumnCommand } from '../commands/resize-column-command';

export interface ColumnResizeManagerConfig {
  layoutEngine: LayoutEngine;
  gridGeometry: GridGeometry;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  columns: ColumnDef[];
  container: HTMLElement;
  onResize: () => void;
}

/** Pixel threshold for detecting proximity to a column border. */
const BORDER_ZONE = 5;
const DEFAULT_MIN_WIDTH = 30;
const INDICATOR_WIDTH = 2;

export class ColumnResizeManager {
  private readonly layoutEngine: LayoutEngine;
  private readonly gridGeometry: GridGeometry;
  private readonly scrollManager: ScrollManager;
  private readonly commandManager: CommandManager;
  private readonly eventBus: EventBus;
  private readonly columns: ColumnDef[];
  private readonly container: HTMLElement;
  private readonly onResize: () => void;

  private scrollContainer: HTMLElement | null = null;
  private indicator: HTMLDivElement | null = null;

  private dragging = false;
  private dragColIndex = -1;
  private dragStartX = 0;
  private dragStartWidth = 0;
  private currentWidth = 0;

  constructor(config: ColumnResizeManagerConfig) {
    this.layoutEngine = config.layoutEngine;
    this.gridGeometry = config.gridGeometry;
    this.scrollManager = config.scrollManager;
    this.commandManager = config.commandManager;
    this.eventBus = config.eventBus;
    this.columns = config.columns;
    this.container = config.container;
    this.onResize = config.onResize;
  }

  /** Attach event listeners to the scroll container. */
  attach(scrollContainer: HTMLElement): void {
    this.scrollContainer = scrollContainer;
    // Use capture phase to intercept before EventTranslator's bubble-phase listeners
    scrollContainer.addEventListener('mousedown', this.handleMouseDown, true);
    scrollContainer.addEventListener('mousemove', this.handleMouseHover);
  }

  /** Detach all event listeners. */
  detach(): void {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('mousedown', this.handleMouseDown, true);
      this.scrollContainer.removeEventListener('mousemove', this.handleMouseHover);
      this.scrollContainer = null;
    }
    this.cleanupDrag();
  }

  /** Whether a drag is currently in progress. */
  get isDragging(): boolean {
    return this.dragging;
  }

  /**
   * Find which column's right border the mouse is near.
   * Returns the column index, or -1 if not near any border.
   */
  getResizeColumnAt(offsetX: number, offsetY: number): number {
    // Only detect in header area
    if (offsetY >= this.layoutEngine.headerHeight) return -1;

    const scrollX = this.scrollManager.scrollX;
    const rowNumberWidth = this.layoutEngine.rowNumberWidth;

    // Not in column area
    if (offsetX < rowNumberWidth) return -1;

    const contentX = offsetX - rowNumberWidth + scrollX;
    const colIndex = this.layoutEngine.getColAtX(contentX);

    // Check right border of found column
    if (colIndex >= 0) {
      const colRight =
        this.layoutEngine.getColumnX(colIndex) + this.layoutEngine.getColumnWidth(colIndex);
      if (Math.abs(contentX - colRight) <= BORDER_ZONE) {
        return this.isResizable(colIndex) ? colIndex : -1;
      }
    }

    // Check right border of previous column (mouse just past the border)
    if (colIndex > 0) {
      const prevRight =
        this.layoutEngine.getColumnX(colIndex - 1) + this.layoutEngine.getColumnWidth(colIndex - 1);
      if (Math.abs(contentX - prevRight) <= BORDER_ZONE) {
        return this.isResizable(colIndex - 1) ? colIndex - 1 : -1;
      }
    }

    // Edge case: mouse past last column's right border
    if (colIndex === -1 && contentX >= 0) {
      const lastCol = this.layoutEngine.columnCount - 1;
      if (lastCol >= 0) {
        const lastRight =
          this.layoutEngine.getColumnX(lastCol) + this.layoutEngine.getColumnWidth(lastCol);
        if (Math.abs(contentX - lastRight) <= BORDER_ZONE) {
          return this.isResizable(lastCol) ? lastCol : -1;
        }
      }
    }

    return -1;
  }

  private isResizable(colIndex: number): boolean {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    const col = visibleCols[colIndex];
    return col ? col.resizable !== false : false;
  }

  private getMinWidth(colIndex: number): number {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    return visibleCols[colIndex]?.minWidth ?? DEFAULT_MIN_WIDTH;
  }

  private getMaxWidth(colIndex: number): number {
    const visibleCols = this.columns.filter((c) => !c.hidden);
    return visibleCols[colIndex]?.maxWidth ?? Infinity;
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const colIndex = this.getResizeColumnAt(e.offsetX, e.offsetY);
    if (colIndex < 0) return;

    // Intercept event to prevent selection/click handling
    e.stopImmediatePropagation();
    e.preventDefault();

    this.dragging = true;
    this.dragColIndex = colIndex;
    this.dragStartX = e.clientX;
    this.dragStartWidth = this.layoutEngine.getColumnWidth(colIndex);
    this.currentWidth = this.dragStartWidth;

    this.eventBus.emit('columnResizeStart', { colIndex });

    this.showIndicator();
    this.updateIndicatorPosition();

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
  };

  private handleMouseHover = (e: MouseEvent): void => {
    if (this.dragging || !this.scrollContainer) return;
    const colIndex = this.getResizeColumnAt(e.offsetX, e.offsetY);
    if (colIndex >= 0) {
      this.scrollContainer.style.cursor = 'col-resize';
    } else if (this.scrollContainer.style.cursor === 'col-resize') {
      this.scrollContainer.style.cursor = '';
    }
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.dragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const minW = this.getMinWidth(this.dragColIndex);
    const maxW = this.getMaxWidth(this.dragColIndex);
    this.currentWidth = Math.max(minW, Math.min(maxW, this.dragStartWidth + deltaX));

    // Live-update layout for responsive feedback
    this.layoutEngine.setColumnWidth(this.dragColIndex, this.currentWidth);
    this.gridGeometry.setColumnWidth(this.dragColIndex, this.currentWidth);
    this.onResize();

    this.updateIndicatorPosition();
  };

  private handleDragEnd = (e: MouseEvent): void => {
    if (!this.dragging) return;

    const deltaX = e.clientX - this.dragStartX;
    const minW = this.getMinWidth(this.dragColIndex);
    const maxW = this.getMaxWidth(this.dragColIndex);
    const finalWidth = Math.max(minW, Math.min(maxW, this.dragStartWidth + deltaX));

    // Revert to original width before creating command (command.execute will apply it)
    this.layoutEngine.setColumnWidth(this.dragColIndex, this.dragStartWidth);
    this.gridGeometry.setColumnWidth(this.dragColIndex, this.dragStartWidth);

    if (finalWidth !== this.dragStartWidth) {
      const command = new ResizeColumnCommand(
        this.layoutEngine,
        this.gridGeometry,
        this.dragColIndex,
        this.dragStartWidth,
        finalWidth,
      );
      this.commandManager.execute(command);
      this.eventBus.emit('commandExecute', { description: command.description });

      this.eventBus.emit('columnResize', {
        colIndex: this.dragColIndex,
        oldWidth: this.dragStartWidth,
        newWidth: finalWidth,
      });

      this.eventBus.emit('columnResizeEnd', {
        colIndex: this.dragColIndex,
        oldWidth: this.dragStartWidth,
        newWidth: finalWidth,
      });

      this.onResize();
    } else {
      // No change — just re-render to clear any visual state
      this.onResize();
    }

    this.cleanupDrag();
  };

  private showIndicator(): void {
    if (this.indicator) return;
    this.indicator = document.createElement('div');
    const s = this.indicator.style;
    s.position = 'absolute';
    s.top = '0';
    s.margin = '0';
    s.width = `${INDICATOR_WIDTH}px`;
    s.height = '100%';
    s.backgroundColor = 'rgba(59, 130, 246, 0.6)';
    s.pointerEvents = 'none';
    s.zIndex = '20';
    this.container.appendChild(this.indicator);
  }

  private updateIndicatorPosition(): void {
    if (!this.indicator) return;
    const scrollX = this.scrollManager.scrollX;
    const rowNumberWidth = this.layoutEngine.rowNumberWidth;
    const colX = this.layoutEngine.getColumnX(this.dragColIndex);
    const screenX = rowNumberWidth + colX + this.currentWidth - scrollX;
    this.indicator.style.left = `${screenX - INDICATOR_WIDTH / 2}px`;
  }

  private cleanupDrag(): void {
    this.dragging = false;
    this.dragColIndex = -1;
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    if (this.indicator && this.indicator.parentNode) {
      this.indicator.parentNode.removeChild(this.indicator);
    }
    this.indicator = null;

    if (this.scrollContainer) {
      this.scrollContainer.style.cursor = '';
    }
  }
}
