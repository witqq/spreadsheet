// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { CellStore } from '../../model/cell-store';
import type { DataView } from '../../dataview/data-view';
import type { BorderStyle } from '../../types/interfaces';

export class GridLinesLayer implements RenderLayer {
  constructor(
    private readonly cellStore?: CellStore,
    private readonly dataView?: DataView,
  ) {}

  render(rc: RenderContext): void {
    const {
      ctx,
      geometry,
      theme,
      canvasWidth,
      canvasHeight,
      viewport,
      scrollX,
      scrollY,
      mergeManager,
    } = rc;
    const colRects = geometry.computeColumnRects();

    ctx.strokeStyle = theme.colors.gridLine;
    ctx.lineWidth = theme.borders.gridLineWidth;
    ctx.beginPath();

    // Collect merged regions for grid line suppression, translating physical→logical rows
    const rawRegions = mergeManager?.getAllRegions() ?? [];
    const regions: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }> =
      [];
    if (this.dataView && !this.dataView.isPassthrough()) {
      for (const r of rawRegions) {
        const logStart = this.dataView.getLogicalRow(r.startRow);
        const logEnd = this.dataView.getLogicalRow(r.endRow);
        if (logStart !== undefined && logEnd !== undefined) {
          regions.push({
            startRow: logStart,
            startCol: r.startCol,
            endRow: logEnd,
            endCol: r.endCol,
          });
        }
      }
    } else {
      for (const r of rawRegions) {
        regions.push(r);
      }
    }

    // Horizontal lines for visible rows only (includes line above first and below last)
    // When no visible rows (filtered to 0), draw phantom grid lines to fill viewport
    if (viewport.endRow < viewport.startRow) {
      // No data rows — draw empty grid skeleton
      const rowH = geometry.getRowY(1); // height of one row
      if (rowH > 0) {
        let y = geometry.headerHeight;
        while (y < canvasHeight) {
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(canvasWidth, y + 0.5);
          y += rowH;
        }
      }
    } else {
      for (let r = viewport.startRow; r <= viewport.endRow + 1; r++) {
        const y = geometry.headerHeight + geometry.getRowY(r) - scrollY;
        // Draw line in segments, skipping merged region interiors
        this.drawHLineWithMergeGaps(
          ctx,
          y,
          r,
          colRects,
          regions,
          scrollX,
          canvasWidth,
          viewport.startCol,
          viewport.endCol,
        );
      }
    }

    // Vertical lines for visible columns only
    for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
      const cr = colRects[c];
      const x = cr.x + cr.width - scrollX;
      // Draw line in segments, skipping merged region interiors
      this.drawVLineWithMergeGaps(ctx, x, c, geometry, regions, scrollY, canvasHeight);
    }

    // Row number gutter right border — fixed at rnWidth (doesn't scroll horizontally)
    if (geometry.rowNumberWidth > 0) {
      const gutterX = geometry.rowNumberWidth;
      ctx.moveTo(gutterX + 0.5, 0);
      ctx.lineTo(gutterX + 0.5, canvasHeight);
    }

    // Outer frame: left border in data area (header portion drawn by HeaderLayer)
    ctx.moveTo(0.5, geometry.headerHeight);
    ctx.lineTo(0.5, canvasHeight);

    ctx.stroke();

    // Per-cell border overrides
    if (this.cellStore) {
      this.drawPerCellBorders(rc, colRects);
    }
  }

  /**
   * Draw per-cell border overrides after standard grid lines.
   * Collects all border edges with conflict resolution (thicker wins;
   * equal thickness → rightmost/bottommost cell wins), then draws
   * grouped by style to minimise canvas state changes.
   */
  private drawPerCellBorders(
    rc: RenderContext,
    colRects: ReadonlyArray<{ x: number; width: number }>,
  ): void {
    const { ctx, geometry, viewport, scrollX, scrollY } = rc;
    const headerHeight = geometry.headerHeight;

    // Collect all border edges with conflict resolution
    const edges = new Map<
      string,
      { x1: number; y1: number; x2: number; y2: number; border: BorderStyle }
    >();

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView?.getPhysicalRow(r) ?? r;

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        const cellData = this.cellStore!.get(physRow, c);
        const style = cellData?.style?.style;
        if (!style) continue;

        const { borderTop, borderRight, borderBottom, borderLeft } = style;
        if (!borderTop && !borderRight && !borderBottom && !borderLeft) continue;

        const cr = colRects[c];
        if (!cr) continue;

        const x = cr.x - scrollX;
        const y = headerHeight + geometry.getRowY(r) - scrollY;
        const w = cr.width;
        const h = geometry.getRowHeight(r);

        if (borderTop) {
          this.resolveEdge(edges, `h:${r}:${c}`, x, y, x + w, y, borderTop);
        }
        if (borderBottom) {
          this.resolveEdge(edges, `h:${r + 1}:${c}`, x, y + h, x + w, y + h, borderBottom);
        }
        if (borderLeft) {
          this.resolveEdge(edges, `v:${r}:${c}`, x, y, x, y + h, borderLeft);
        }
        if (borderRight) {
          this.resolveEdge(edges, `v:${r}:${c + 1}`, x + w, y, x + w, y + h, borderRight);
        }
      }
    }

    if (edges.size === 0) return;

    // Group edges by visual style (color+width+dash) to minimise state changes
    const groups = new Map<
      string,
      { border: BorderStyle; segments: Array<{ x1: number; y1: number; x2: number; y2: number }> }
    >();
    for (const edge of edges.values()) {
      const key = `${edge.border.color}:${edge.border.width}:${edge.border.style}`;
      let group = groups.get(key);
      if (!group) {
        group = { border: edge.border, segments: [] };
        groups.set(key, group);
      }
      group.segments.push({ x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 });
    }

    ctx.save();
    for (const { border, segments } of groups.values()) {
      ctx.strokeStyle = border.color;
      ctx.lineWidth = border.width;

      if (border.style === 'dashed') {
        ctx.setLineDash([border.width * 3, border.width * 2]);
      } else if (border.style === 'dotted') {
        ctx.setLineDash([border.width, border.width * 2]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      for (const seg of segments) {
        const isHorizontal = seg.y1 === seg.y2;
        if (isHorizontal) {
          ctx.moveTo(seg.x1, seg.y1 + 0.5);
          ctx.lineTo(seg.x2, seg.y2 + 0.5);
        } else {
          ctx.moveTo(seg.x1 + 0.5, seg.y1);
          ctx.lineTo(seg.x2 + 0.5, seg.y2);
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Insert or update an edge in the map. Thicker border wins;
   * equal thickness → later cell (rightmost/bottommost in row-major order) wins.
   */
  private resolveEdge(
    edges: Map<string, { x1: number; y1: number; x2: number; y2: number; border: BorderStyle }>,
    key: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    border: BorderStyle,
  ): void {
    const existing = edges.get(key);
    if (!existing || border.width >= existing.border.width) {
      edges.set(key, { x1, y1, x2, y2, border });
    }
  }

  /**
   * Draw a horizontal line at y, skipping segments inside merged regions.
   * A horizontal line at the top of row `r` is internal to a merge if the merge
   * spans from some row < r to some row >= r (i.e., r is between startRow+1 and endRow inclusive).
   */
  private drawHLineWithMergeGaps(
    ctx: CanvasRenderingContext2D,
    y: number,
    r: number,
    colRects: ReadonlyArray<{ x: number; width: number }>,
    regions: ReadonlyArray<{ startRow: number; startCol: number; endRow: number; endCol: number }>,
    scrollX: number,
    canvasWidth: number,
    viewportStartCol: number,
    viewportEndCol: number,
  ): void {
    // Find all column ranges to skip (merge interior horizontal boundaries)
    const gaps: Array<{ startCol: number; endCol: number }> = [];
    for (const region of regions) {
      // This horizontal line is internal if r > startRow AND r <= endRow
      if (r > region.startRow && r <= region.endRow) {
        gaps.push({ startCol: region.startCol, endCol: region.endCol });
      }
    }

    if (gaps.length === 0) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvasWidth, y + 0.5);
      return;
    }

    // Draw line in segments, skipping gap columns (viewport-scoped)
    let currentX = 0;
    const startC = Math.max(0, viewportStartCol);
    const endC = Math.min(colRects.length - 1, viewportEndCol);
    for (let c = startC; c <= endC; c++) {
      const cr = colRects[c];
      const leftX = cr.x - scrollX;
      const rightX = leftX + cr.width;
      const inGap = gaps.some((g) => c >= g.startCol && c <= g.endCol);

      if (inGap) {
        // Draw segment before gap
        if (currentX < leftX) {
          ctx.moveTo(currentX, y + 0.5);
          ctx.lineTo(leftX, y + 0.5);
        }
        currentX = rightX;
      }
    }
    // Draw remaining segment after last gap
    if (currentX < canvasWidth) {
      ctx.moveTo(currentX, y + 0.5);
      ctx.lineTo(canvasWidth, y + 0.5);
    }
  }

  /**
   * Draw a vertical line at x, skipping segments inside merged regions.
   * A vertical line at the right of column `c` is internal to a merge if the merge
   * spans from some col <= c to some col > c (i.e., c is between startCol and endCol-1 inclusive).
   */
  private drawVLineWithMergeGaps(
    ctx: CanvasRenderingContext2D,
    x: number,
    c: number,
    geometry: {
      headerHeight: number;
      getRowY: (r: number) => number;
      getRowHeight: (r: number) => number;
    },
    regions: ReadonlyArray<{ startRow: number; startCol: number; endRow: number; endCol: number }>,
    scrollY: number,
    canvasHeight: number,
  ): void {
    // Find all row ranges to skip (merge interior vertical boundaries)
    const gaps: Array<{ startRow: number; endRow: number }> = [];
    for (const region of regions) {
      // This vertical line is internal if c >= startCol AND c < endCol
      if (c >= region.startCol && c < region.endCol) {
        gaps.push({ startRow: region.startRow, endRow: region.endRow });
      }
    }

    if (gaps.length === 0) {
      ctx.moveTo(x + 0.5, geometry.headerHeight - scrollY);
      ctx.lineTo(x + 0.5, canvasHeight);
      return;
    }

    // Sort gaps by startRow so segments draw top-to-bottom correctly
    gaps.sort((a, b) => a.startRow - b.startRow);

    // Draw line in segments, skipping gap rows
    const headerH = geometry.headerHeight;
    let currentY = headerH - scrollY;

    for (const gap of gaps) {
      const gapTopY = headerH + geometry.getRowY(gap.startRow) - scrollY;
      const gapBottomY =
        headerH + geometry.getRowY(gap.endRow) + geometry.getRowHeight(gap.endRow) - scrollY;

      if (currentY < gapTopY) {
        ctx.moveTo(x + 0.5, currentY);
        ctx.lineTo(x + 0.5, gapTopY);
      }
      currentY = gapBottomY;
    }

    if (currentY < canvasHeight) {
      ctx.moveTo(x + 0.5, currentY);
      ctx.lineTo(x + 0.5, canvasHeight);
    }
  }
}
