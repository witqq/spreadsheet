// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RowGroupToggleLayer — renders expand/collapse toggle icons in the row number gutter.
 *
 * Draws ▶ (collapsed) or ▼ (expanded) icons for group header rows.
 * Also renders aggregate labels in group header cells when collapsed.
 */

import type { RenderLayer, RenderContext } from '../render-layer';
import type { RowGroupManager } from '../../grouping/row-group-manager';
import type { DataView } from '../../dataview/data-view';

export class RowGroupToggleLayer implements RenderLayer {
  constructor(
    private readonly groupManager: RowGroupManager,
    private readonly dataView: DataView,
  ) {}

  render(rc: RenderContext): void {
    if (!this.groupManager.hasGroups()) return;

    const { ctx, geometry, theme, canvasHeight, viewport, scrollY } = rc;
    const rnWidth = geometry.rowNumberWidth;
    if (rnWidth === 0) return;

    const headerHeight = geometry.headerHeight;

    // --- Toggle icons: clipped to gutter ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerHeight, rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    const fontSize = Math.max(10, theme.fonts.cellSize - 2);
    ctx.font = `${fontSize}px ${theme.fonts.cell}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);
      if (!this.groupManager.isGroupHeader(physRow)) continue;

      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const y = headerHeight + rowY - scrollY;
      const centerY = y + rowH / 2;

      // Clear gutter background for this row to hide underlying row number
      ctx.fillStyle = theme.colors.headerBackground;
      ctx.fillRect(0, y, rnWidth, rowH);

      const expanded = this.groupManager.isExpanded(physRow);
      const icon = expanded ? '▼' : '▶';

      // Indent toggle icon based on nesting depth
      const depth = this.groupManager.getDepth(physRow);
      const iconX = 12 + depth * 10;
      ctx.fillStyle = theme.colors.headerText;
      ctx.fillText(icon, iconX, centerY);
    }

    ctx.restore();

    // --- Aggregate labels: rendered outside gutter clip ---
    this.renderAggregates(rc);
  }

  private renderAggregates(rc: RenderContext): void {
    const { ctx, geometry, theme, viewport, scrollX, scrollY } = rc;
    const headerHeight = geometry.headerHeight;
    const rnWidth = geometry.rowNumberWidth;
    const colRects = geometry.computeColumnRects();
    const lw = theme.borders.gridLineWidth;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, rc.canvasWidth - rnWidth, rc.canvasHeight - headerHeight);
    ctx.clip();

    ctx.font = `italic ${theme.fonts.cellSize - 1}px ${theme.fonts.cell}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);
      if (!this.groupManager.isGroupHeader(physRow)) continue;
      if (this.groupManager.isExpanded(physRow)) continue;

      const aggregates = this.groupManager.computeAggregates(physRow);
      if (aggregates.length === 0) continue;

      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const centerY = headerHeight + rowY - scrollY + rowH / 2;

      for (const agg of aggregates) {
        const colIdx = agg.col - viewport.startCol;
        if (colIdx < 0 || colIdx >= colRects.length) continue;
        const rect = colRects[agg.col];
        if (!rect) continue;

        // Clear cell interior (inset by gridLineWidth to preserve borders)
        const cellX = rect.x - scrollX + lw;
        const cellY = headerHeight + rowY - scrollY + lw;
        ctx.fillStyle = theme.colors.background;
        ctx.fillRect(cellX, cellY, rect.width - lw, rowH - lw);

        // Draw aggregate label
        ctx.fillStyle = theme.colors.headerText;
        ctx.fillText(agg.label, cellX + 4 - lw, centerY);
      }
    }

    ctx.restore();
  }
}
