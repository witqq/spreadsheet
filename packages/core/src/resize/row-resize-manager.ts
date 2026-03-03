// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RowResizeManager — handles row resize by dragging row-number bottom borders.
 *
 * Detects mouse proximity to row bottom edges in the row-number column,
 * shows row-resize cursor, manages drag state with visual indicator,
 * and commits resize via commands.
 */

import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';
import type { CommandManager } from '../commands/command-manager';
import type { EventBus } from '../events/event-bus';
import { ResizeRowCommand } from '../commands/resize-row-command';

export interface RowResizeManagerConfig {
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  container: HTMLElement;
  onResize: () => void;
}

/** Pixel threshold for detecting proximity to a row border. */
const BORDER_ZONE = 5;
const DEFAULT_MIN_HEIGHT = 12;
const DEFAULT_MAX_HEIGHT = 400;
const INDICATOR_HEIGHT = 2;

export class RowResizeManager {
  private readonly layoutEngine: LayoutEngine;
  private readonly scrollManager: ScrollManager;
  private readonly commandManager: CommandManager;
  private readonly eventBus: EventBus;
  private readonly container: HTMLElement;
  private readonly onResize: () => void;

  private scrollContainer: HTMLElement | null = null;
  private indicator: HTMLDivElement | null = null;

  private dragging = false;
  private dragRowIndex = -1;
  private dragStartY = 0;
  private dragStartHeight = 0;
  private currentHeight = 0;

  constructor(config: RowResizeManagerConfig) {
    this.layoutEngine = config.layoutEngine;
    this.scrollManager = config.scrollManager;
    this.commandManager = config.commandManager;
    this.eventBus = config.eventBus;
    this.container = config.container;
    this.onResize = config.onResize;
  }

  /** Attach event listeners to the scroll container. */
  attach(scrollContainer: HTMLElement): void {
    this.scrollContainer = scrollContainer;
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
   * Find which row's bottom border the mouse is near.
   * Returns the row index, or -1 if not near any border.
   * Only detects in the row-number column area.
   */
  getResizeRowAt(offsetX: number, offsetY: number): number {
    const rowNumberWidth = this.layoutEngine.rowNumberWidth;
    const headerHeight = this.layoutEngine.headerHeight;

    // Only detect in row-number column area
    if (offsetX >= rowNumberWidth) return -1;

    // Must be below header
    if (offsetY < headerHeight) return -1;

    const scrollY = this.scrollManager.scrollY;
    const contentY = offsetY - headerHeight + scrollY;
    const rowIndex = this.layoutEngine.getRowAtY(contentY);

    // Check bottom border of found row
    if (rowIndex >= 0) {
      const rowBottom =
        this.layoutEngine.getRowY(rowIndex) + this.layoutEngine.getRowHeight(rowIndex);
      if (Math.abs(contentY - rowBottom) <= BORDER_ZONE) {
        return rowIndex;
      }
    }

    // Check bottom border of previous row (mouse just past the border)
    if (rowIndex > 0) {
      const prevBottom =
        this.layoutEngine.getRowY(rowIndex - 1) + this.layoutEngine.getRowHeight(rowIndex - 1);
      if (Math.abs(contentY - prevBottom) <= BORDER_ZONE) {
        return rowIndex - 1;
      }
    }

    // Edge case: mouse past last row's bottom border
    if (rowIndex === -1 && contentY >= 0) {
      const lastRow = this.layoutEngine.rowCount - 1;
      if (lastRow >= 0) {
        const lastBottom =
          this.layoutEngine.getRowY(lastRow) + this.layoutEngine.getRowHeight(lastRow);
        if (Math.abs(contentY - lastBottom) <= BORDER_ZONE) {
          return lastRow;
        }
      }
    }

    return -1;
  }

  private handleMouseDown = (e: MouseEvent): void => {
    const rowIndex = this.getResizeRowAt(e.offsetX, e.offsetY);
    if (rowIndex < 0) return;

    // Intercept event to prevent selection/click handling
    e.stopImmediatePropagation();
    e.preventDefault();

    this.dragging = true;
    this.dragRowIndex = rowIndex;
    this.dragStartY = e.clientY;
    this.dragStartHeight = this.layoutEngine.getRowHeight(rowIndex);
    this.currentHeight = this.dragStartHeight;

    this.eventBus.emit('rowResizeStart', { rowIndex });

    this.showIndicator();
    this.updateIndicatorPosition();

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
  };

  private handleMouseHover = (e: MouseEvent): void => {
    if (this.dragging || !this.scrollContainer) return;

    // Only manage cursor when mouse is in row-number column below header
    const rowNumberWidth = this.layoutEngine.rowNumberWidth;
    const headerHeight = this.layoutEngine.headerHeight;
    if (e.offsetX >= rowNumberWidth || e.offsetY < headerHeight) return;

    const rowIndex = this.getResizeRowAt(e.offsetX, e.offsetY);
    if (rowIndex >= 0) {
      this.scrollContainer.style.cursor = 'row-resize';
    } else if (this.scrollContainer.style.cursor === 'row-resize') {
      this.scrollContainer.style.cursor = '';
    }
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.dragging) return;

    const deltaY = e.clientY - this.dragStartY;
    this.currentHeight = Math.max(
      DEFAULT_MIN_HEIGHT,
      Math.min(DEFAULT_MAX_HEIGHT, this.dragStartHeight + deltaY),
    );

    // Live-update layout for responsive feedback
    this.layoutEngine.setRowHeight(this.dragRowIndex, this.currentHeight);
    this.onResize();

    this.updateIndicatorPosition();
  };

  private handleDragEnd = (e: MouseEvent): void => {
    if (!this.dragging) return;

    const deltaY = e.clientY - this.dragStartY;
    const finalHeight = Math.max(
      DEFAULT_MIN_HEIGHT,
      Math.min(DEFAULT_MAX_HEIGHT, this.dragStartHeight + deltaY),
    );

    // Revert to original height before creating command (command.execute will apply it)
    this.layoutEngine.setRowHeight(this.dragRowIndex, this.dragStartHeight);

    if (finalHeight !== this.dragStartHeight) {
      const command = new ResizeRowCommand(
        this.layoutEngine,
        this.dragRowIndex,
        this.dragStartHeight,
        finalHeight,
      );
      this.commandManager.execute(command);
      this.eventBus.emit('commandExecute', { description: command.description });

      this.eventBus.emit('rowResize', {
        rowIndex: this.dragRowIndex,
        oldHeight: this.dragStartHeight,
        newHeight: finalHeight,
      });

      this.eventBus.emit('rowResizeEnd', {
        rowIndex: this.dragRowIndex,
        oldHeight: this.dragStartHeight,
        newHeight: finalHeight,
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
    s.left = '0';
    s.margin = '0';
    s.height = `${INDICATOR_HEIGHT}px`;
    s.width = '100%';
    s.backgroundColor = 'rgba(59, 130, 246, 0.6)';
    s.pointerEvents = 'none';
    s.zIndex = '20';
    this.container.appendChild(this.indicator);
  }

  private updateIndicatorPosition(): void {
    if (!this.indicator) return;
    const scrollY = this.scrollManager.scrollY;
    const headerHeight = this.layoutEngine.headerHeight;
    const rowY = this.layoutEngine.getRowY(this.dragRowIndex);
    const screenY = headerHeight + rowY + this.currentHeight - scrollY;
    this.indicator.style.top = `${screenY - INDICATOR_HEIGHT / 2}px`;
  }

  private cleanupDrag(): void {
    this.dragging = false;
    this.dragRowIndex = -1;
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
