// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { EventBus } from '../events/event-bus';
import type { CellStore } from '../model/cell-store';
import type { DataView } from '../dataview/data-view';
import type { GridMouseEvent } from '../events/event-types';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { LayoutEngine } from '../renderer/layout-engine';
import type { ScrollManager } from '../renderer/scroll-manager';

export interface TooltipManagerConfig {
  container: HTMLElement;
  eventBus: EventBus;
  cellStore: CellStore;
  dataView: DataView;
  layoutEngine: LayoutEngine;
  scrollManager: ScrollManager;
  theme: SpreadsheetTheme;
}

/**
 * TooltipManager — shows error message tooltips on hover over error cells.
 *
 * Listens for gridMouseHover events and displays a positioned tooltip
 * when hovering over cells with error metadata.
 */
export class TooltipManager {
  private readonly container: HTMLElement;
  private readonly eventBus: EventBus;
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly layoutEngine: LayoutEngine;
  private readonly scrollManager: ScrollManager;
  private theme: SpreadsheetTheme;
  private tooltipEl: HTMLDivElement | null = null;
  private currentRow = -1;
  private currentCol = -1;

  constructor(config: TooltipManagerConfig) {
    this.container = config.container;
    this.eventBus = config.eventBus;
    this.cellStore = config.cellStore;
    this.dataView = config.dataView;
    this.layoutEngine = config.layoutEngine;
    this.scrollManager = config.scrollManager;
    this.theme = config.theme;

    this.eventBus.on('gridMouseHover', this.handleHover);
  }

  private handleHover = (event: GridMouseEvent): void => {
    const { row, col, region } = event;

    if (region !== 'cell' || row < 0 || col < 0) {
      this.hide();
      return;
    }

    // Same cell — no update needed
    if (row === this.currentRow && col === this.currentCol) return;

    this.currentRow = row;
    this.currentCol = col;

    const cellData = this.cellStore.get(this.dataView.getPhysicalRow(row), col);
    if (cellData?.metadata?.status === 'error' && cellData.metadata.errorMessage) {
      this.show(row, col, cellData.metadata.errorMessage);
    } else {
      this.hide();
    }
  };

  private show(row: number, col: number, message: string): void {
    if (!this.tooltipEl) {
      this.tooltipEl = this.createTooltipElement();
      this.container.appendChild(this.tooltipEl);
    }

    this.tooltipEl.textContent = message;

    // Position below the cell
    const scrollX = this.scrollManager.scrollX;
    const scrollY = this.scrollManager.scrollY;
    const cellX = this.layoutEngine.getColumnX(col) - scrollX + this.layoutEngine.rowNumberWidth;
    const cellY =
      this.layoutEngine.getRowY(row) -
      scrollY +
      this.layoutEngine.headerHeight +
      this.layoutEngine.getRowHeight(row);

    this.tooltipEl.style.left = `${cellX}px`;
    this.tooltipEl.style.top = `${cellY + 2}px`;
    this.tooltipEl.style.display = 'block';
  }

  private hide(): void {
    this.currentRow = -1;
    this.currentCol = -1;
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
  }

  /** Update theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
    // Re-style existing tooltip element if present
    if (this.tooltipEl) {
      this.tooltipEl.style.backgroundColor = theme.colors.errorBackground;
      this.tooltipEl.style.color = theme.colors.cellText;
      this.tooltipEl.style.border = `1px solid ${theme.colors.gridLine}`;
    }
  }

  private createTooltipElement(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.zIndex = '1000';
    el.style.margin = '0';
    el.style.padding = '4px 8px';
    el.style.borderRadius = '4px';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.4';
    el.style.maxWidth = '300px';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'pre-wrap';
    el.style.display = 'none';
    el.style.backgroundColor = this.theme.colors.errorBackground;
    el.style.color = this.theme.colors.cellText;
    el.style.border = `1px solid ${this.theme.colors.gridLine}`;
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    el.setAttribute('data-wit-tooltip', 'true');
    return el;
  }

  destroy(): void {
    this.eventBus.off('gridMouseHover', this.handleHover);
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
  }
}
