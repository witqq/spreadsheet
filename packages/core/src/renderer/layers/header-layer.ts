// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { SortDirection } from '../../sort/sort-engine';

export type HeaderSortState = Map<number, SortDirection>;
export type HeaderFilterState = Set<number>;

export class HeaderLayer implements RenderLayer {
  private _sortState: HeaderSortState = new Map();
  private _filterState: HeaderFilterState = new Set();

  /** Update sort state for indicator rendering. */
  setSortState(state: HeaderSortState): void {
    this._sortState = state;
  }

  /** Update filter state — set of column indices that have active filters. */
  setFilterState(state: HeaderFilterState): void {
    this._filterState = state;
  }

  render(rc: RenderContext): void {
    // scrollY NOT used — header is fixed at top (y=0)
    const { ctx, geometry, theme, canvasWidth, viewport, scrollX } = rc;
    const colRects = geometry.computeColumnRects();
    const visibleCols = geometry.getVisibleColumns();
    const headerHeight = geometry.headerHeight;
    const padding = geometry.cellPadding;
    const rnWidth = geometry.rowNumberWidth;

    // Header background — fixed at top, full width
    ctx.fillStyle = theme.colors.headerBackground;
    ctx.fillRect(0, 0, canvasWidth, headerHeight);

    // Header borders — top, bottom, left (outer frame)
    ctx.strokeStyle = theme.colors.headerBorder;
    ctx.lineWidth = theme.borders.gridLineWidth;
    ctx.beginPath();
    // Top border (outer frame)
    ctx.moveTo(0, 0.5);
    ctx.lineTo(canvasWidth, 0.5);
    // Bottom border
    ctx.moveTo(0, headerHeight + 0.5);
    ctx.lineTo(canvasWidth, headerHeight + 0.5);
    // Left border in header area
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, headerHeight + 1);

    // Vertical separators between column headers
    for (let i = viewport.startCol; i <= viewport.endCol && i < colRects.length; i++) {
      const cr = colRects[i];
      const x = cr.x + cr.width - scrollX;
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, headerHeight);
    }

    ctx.stroke();

    // Column header text — x scrolls horizontally, y fixed
    ctx.fillStyle = theme.colors.headerText;
    ctx.font = `bold ${theme.fonts.headerSize}px ${theme.fonts.header}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = viewport.startCol; i <= viewport.endCol && i < colRects.length; i++) {
      const cr = colRects[i];
      const col = visibleCols[i];
      if (!col) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(cr.x + padding - scrollX, 0, cr.width - padding * 2, headerHeight);
      ctx.clip();

      const sortDir = this._sortState.get(i);
      const hasFilter = this._filterState.has(i);

      // Icon zone layout: rightmost 28px of cell
      // [... title ...][filter 14px][sort 14px]
      const iconZoneRight = cr.x + cr.width - padding - scrollX;
      const sortCenterX = iconZoneRight - 7; // center of right 14px
      const filterCenterX = iconZoneRight - 21; // center of left 14px
      const centerY = headerHeight / 2;

      // Title — shift left if icons present, to avoid overlap
      const titleX = cr.x + cr.width / 2 - scrollX;
      ctx.fillText(col.title, titleX, centerY);

      // Sort icon (right 14px of icon zone)
      if (sortDir) {
        const arrowSize = 4;
        ctx.beginPath();
        if (sortDir === 'asc') {
          ctx.moveTo(sortCenterX - arrowSize, centerY + arrowSize);
          ctx.lineTo(sortCenterX + arrowSize, centerY + arrowSize);
          ctx.lineTo(sortCenterX, centerY - arrowSize);
        } else {
          ctx.moveTo(sortCenterX - arrowSize, centerY - arrowSize);
          ctx.lineTo(sortCenterX + arrowSize, centerY - arrowSize);
          ctx.lineTo(sortCenterX, centerY + arrowSize);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Dimmed up/down arrows to indicate sortability
        const arrowSize = 3;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(sortCenterX - arrowSize, centerY - 1);
        ctx.lineTo(sortCenterX + arrowSize, centerY - 1);
        ctx.lineTo(sortCenterX, centerY - arrowSize - 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sortCenterX - arrowSize, centerY + 1);
        ctx.lineTo(sortCenterX + arrowSize, centerY + 1);
        ctx.lineTo(sortCenterX, centerY + arrowSize + 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Filter icon (left 14px of icon zone)
      if (hasFilter) {
        // Active filter: solid funnel with accent color
        const fSize = 4;
        ctx.fillStyle = theme.colors.activeCellBorder;
        ctx.beginPath();
        ctx.moveTo(filterCenterX - fSize, centerY - fSize);
        ctx.lineTo(filterCenterX + fSize, centerY - fSize);
        ctx.lineTo(filterCenterX + 1, centerY + 1);
        ctx.lineTo(filterCenterX + 1, centerY + fSize);
        ctx.lineTo(filterCenterX - 1, centerY + fSize);
        ctx.lineTo(filterCenterX - 1, centerY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = theme.colors.headerText;
      } else {
        // Dimmed funnel to indicate filter availability
        const fSize = 3;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(filterCenterX - fSize, centerY - fSize);
        ctx.lineTo(filterCenterX + fSize, centerY - fSize);
        ctx.lineTo(filterCenterX + 1, centerY + 1);
        ctx.lineTo(filterCenterX + 1, centerY + fSize);
        ctx.lineTo(filterCenterX - 1, centerY + fSize);
        ctx.lineTo(filterCenterX - 1, centerY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    // Corner cell (top-left) — fixed at (0, 0), no scroll offset
    if (rnWidth > 0) {
      ctx.fillStyle = theme.colors.headerBackground;
      ctx.fillRect(0, 0, rnWidth, headerHeight);

      ctx.strokeStyle = theme.colors.headerBorder;
      ctx.beginPath();
      ctx.moveTo(rnWidth + 0.5, 0);
      ctx.lineTo(rnWidth + 0.5, headerHeight);
      ctx.stroke();
    }
  }
}
