// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';
import type { TextMeasureCache } from '../text-measure-cache';
import type { CellStore } from '../../model/cell-store';
import type { DataView } from '../../dataview/data-view';
import type { CellStyle } from '../../types/interfaces';
import type { SpreadsheetTheme } from '../../themes/theme-types';
import type { CellDecorator } from '../../types/cell-type-registry';
import { CellTypeRegistry } from '../../types/cell-type-registry';
import { LINE_HEIGHT_MULTIPLIER } from '../../constants';

export class CellTextLayer implements RenderLayer {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly measureCache: TextMeasureCache;
  private readonly typeRegistry: CellTypeRegistry;

  constructor(
    cellStore: CellStore,
    dataView: DataView,
    measureCache: TextMeasureCache,
    typeRegistry?: CellTypeRegistry,
  ) {
    this.cellStore = cellStore;
    this.dataView = dataView;
    this.measureCache = measureCache;
    this.typeRegistry = typeRegistry ?? new CellTypeRegistry();
  }

  /** Build CSS font string from per-cell style overrides with theme fallbacks. */
  private buildCellFont(style: CellStyle, theme: SpreadsheetTheme): string {
    const parts: string[] = [];
    if (style.fontStyle === 'italic') parts.push('italic');
    if (style.fontWeight === 'bold') parts.push('bold');
    parts.push(`${style.fontSize ?? theme.fonts.cellSize}px`);
    parts.push(style.fontFamily ?? theme.fonts.cell);
    return parts.join(' ');
  }

  render(rc: RenderContext): void {
    this.renderFull(rc);
  }

  /**
   * Measure desired row heights for visible rows that have wrapping enabled
   * (either via column wrapText or per-cell textWrap style).
   * Returns the maximum needed height per row across all wrapping cells.
   */
  measureHeights(rc: RenderContext): Map<number, number> {
    const { ctx, geometry, theme, viewport } = rc;
    const visibleCols = geometry.getVisibleColumns();
    const colRects = geometry.computeColumnRects();
    const padding = geometry.cellPadding;
    const font = `${theme.fonts.cellSize}px ${theme.fonts.cell}`;
    const result = new Map<number, number>();

    ctx.save();
    ctx.font = font;

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);
      let maxHeight = 0;

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        const col = visibleCols[c];
        if (!col) continue;

        const cellData = this.cellStore.get(physRow, c);
        if (!cellData || cellData.value == null) continue;

        const cellStyle = cellData.style?.style;
        const shouldWrap = cellStyle?.textWrap ?? col.wrapText ?? false;
        if (!shouldWrap) continue;

        const cellType = col.type ?? cellData.type ?? this.typeRegistry.detectType(cellData.value);
        const renderer = this.typeRegistry.get(cellType);

        // Custom cell type renderers with measureHeight take priority
        if (renderer.measureHeight) {
          const cr = colRects[c];
          if (!cr) continue;
          const h = renderer.measureHeight(ctx, cellData.value, cr.width, theme);
          if (h > maxHeight) maxHeight = h;
          continue;
        }

        // Default: use text measure cache for wrapped text height
        if (renderer.render) continue; // Custom-rendered cells without measureHeight — skip

        const text = renderer.format(cellData.value);
        if (text === '') continue;

        const cr = colRects[c];
        if (!cr) continue;

        const indentPx = (cellStyle?.indent ?? 0) * padding;

        // Account for decorator reserved widths
        let decoratorOffset = 0;
        const decorators = this.typeRegistry.getDecorators(physRow, c, cellData);
        for (const dec of decorators) {
          if (dec.position === 'left' || dec.position === 'right') {
            try {
              decoratorOffset += dec.getWidth?.(cellData, 0, ctx, theme) ?? 0;
            } catch {
              /* skip broken decorator */
            }
          }
        }

        const availableWidth = cr.width - padding * 2 - indentPx - decoratorOffset;

        // Use per-cell font if custom font properties exist
        const hasCustomFont =
          cellStyle?.fontFamily ||
          cellStyle?.fontSize ||
          cellStyle?.fontWeight ||
          cellStyle?.fontStyle;
        let cellFont = font;
        if (hasCustomFont) {
          cellFont = this.buildCellFont(cellStyle!, theme);
          ctx.font = cellFont;
        }

        const h = this.measureCache.measureWrappedHeight(ctx, text, cellFont, availableWidth);
        if (h > maxHeight) maxHeight = h;

        // Restore default font if changed
        if (hasCustomFont) {
          ctx.font = font;
        }
      }

      if (maxHeight > 0) {
        result.set(r, maxHeight);
      }
    }

    ctx.restore();
    return result;
  }

  /**
   * Full mode: text with truncation, formatting, and proper alignment.
   * Uses CellTypeRegistry for type-aware formatting and custom rendering.
   * Handles merged cells: skips hidden cells, spans anchor cells across merged area.
   */
  private renderFull(rc: RenderContext): void {
    const {
      ctx,
      geometry,
      theme,
      viewport,
      scrollX,
      scrollY,
      canvasWidth,
      canvasHeight,
      mergeManager,
    } = rc;
    const colRects = geometry.computeColumnRects();
    const visibleCols = geometry.getVisibleColumns();
    const headerHeight = geometry.headerHeight;
    const padding = geometry.cellPadding;
    const rnWidth = geometry.rowNumberWidth;
    const font = `${theme.fonts.cellSize}px ${theme.fonts.cell}`;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rnWidth, headerHeight, canvasWidth - rnWidth, canvasHeight - headerHeight);
    ctx.clip();

    ctx.font = font;
    ctx.fillStyle = theme.colors.cellText;
    ctx.textBaseline = 'middle';

    // Collect anchors to render — includes off-screen anchors whose merge overlaps the viewport
    const anchorsToRender: Array<{ logicalRow: number; col: number }> = [];
    let fontChanged = false;

    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      const physRow = this.dataView.getPhysicalRow(r);

      for (let c = viewport.startCol; c <= viewport.endCol && c < colRects.length; c++) {
        if (mergeManager?.isHiddenCell(physRow, c)) {
          // This cell is hidden — check if its anchor is off-screen and needs rendering
          const region = mergeManager.getMergedRegion(physRow, c);
          if (region) {
            const anchorLogical = this.dataView.getLogicalRow(region.startRow);
            if (
              anchorLogical !== undefined &&
              (anchorLogical < viewport.startRow || region.startCol < viewport.startCol)
            ) {
              // Anchor is off-screen — add it if not already queued
              if (
                !anchorsToRender.some(
                  (a) => a.logicalRow === anchorLogical && a.col === region.startCol,
                )
              ) {
                anchorsToRender.push({ logicalRow: anchorLogical, col: region.startCol });
              }
            }
          }
          continue;
        }

        anchorsToRender.push({ logicalRow: r, col: c });
      }
    }

    for (const { logicalRow: r, col: c } of anchorsToRender) {
      const rowY = geometry.getRowY(r);
      const rowH = geometry.getRowHeight(r);
      const y = headerHeight + rowY - scrollY;
      const physRow = this.dataView.getPhysicalRow(r);

      const cellData = this.cellStore.get(physRow, c);
      if (!cellData || cellData.value == null) continue;

      const cr = colRects[c];
      if (!cr) continue;
      const col = visibleCols[c];
      if (!col) continue;

      const rawValue = cellData.value;
      const cellX = cr.x - scrollX;

      // Compute merged cell dimensions if this is an anchor cell
      let cellWidth = cr.width;
      let cellHeight = rowH;
      if (mergeManager?.isAnchorCell(physRow, c)) {
        const region = mergeManager.getMergedRegion(physRow, c);
        if (region) {
          cellWidth = 0;
          for (let mc = region.startCol; mc <= region.endCol && mc < colRects.length; mc++) {
            cellWidth += colRects[mc].width;
          }
          cellHeight = 0;
          for (let mr = region.startRow; mr <= region.endRow; mr++) {
            const logicalMr = this.dataView.getLogicalRow(mr);
            if (logicalMr !== undefined) {
              cellHeight += geometry.getRowHeight(logicalMr);
            }
          }
        }
      }

      const cellType = col.type ?? cellData.type ?? this.typeRegistry.detectType(rawValue);
      const renderer = this.typeRegistry.get(cellType);

      // Collect applicable decorators for this cell
      const decorators = this.typeRegistry.getDecorators(physRow, c, cellData);
      let leftOffset = 0;
      let rightOffset = 0;
      let leftDecorators: CellDecorator[] | undefined;
      let rightDecorators: CellDecorator[] | undefined;
      let underlayDecorators: CellDecorator[] | undefined;
      let overlayDecorators: CellDecorator[] | undefined;

      // Cache decorator widths to avoid redundant getWidth calls
      let decoratorWidths: Map<CellDecorator, number> | undefined;

      if (decorators.length > 0) {
        for (const dec of decorators) {
          if (dec.position === 'left') {
            let w = 0;
            try {
              w = dec.getWidth?.(cellData, cellHeight, ctx, theme) ?? 0;
            } catch {
              /* skip broken decorator */
            }
            (decoratorWidths ??= new Map()).set(dec, w);
            leftOffset += w;
            (leftDecorators ??= []).push(dec);
          } else if (dec.position === 'right') {
            let w = 0;
            try {
              w = dec.getWidth?.(cellData, cellHeight, ctx, theme) ?? 0;
            } catch {
              /* skip broken decorator */
            }
            (decoratorWidths ??= new Map()).set(dec, w);
            rightOffset += w;
            (rightDecorators ??= []).push(dec);
          } else if (dec.position === 'underlay') {
            (underlayDecorators ??= []).push(dec);
          } else {
            (overlayDecorators ??= []).push(dec);
          }
        }
      }

      // Render underlay decorators (behind content)
      if (underlayDecorators) {
        for (const dec of underlayDecorators) {
          ctx.save();
          try {
            dec.render(ctx, cellData, cellX, y, cellWidth, cellHeight, theme);
          } catch {
            /* skip broken decorator */
          }
          ctx.restore();
        }
      }

      // Render left decorators in their reserved area
      if (leftDecorators) {
        let lx = cellX;
        for (const dec of leftDecorators) {
          const w = decoratorWidths!.get(dec) ?? 0;
          if (w > 0) {
            ctx.save();
            try {
              dec.render(ctx, cellData, lx, y, w, cellHeight, theme);
            } catch {
              /* skip broken decorator */
            }
            ctx.restore();
          }
          lx += w;
        }
      }

      // Render right decorators in their reserved area
      if (rightDecorators) {
        let rx = cellX + cellWidth;
        for (const dec of rightDecorators) {
          const w = decoratorWidths!.get(dec) ?? 0;
          rx -= w;
          if (w > 0) {
            ctx.save();
            try {
              dec.render(ctx, cellData, rx, y, w, cellHeight, theme);
            } catch {
              /* skip broken decorator */
            }
            ctx.restore();
          }
        }
      }

      if (renderer.render) {
        ctx.save();
        renderer.render(
          ctx,
          rawValue,
          cellX + leftOffset,
          y,
          cellWidth - leftOffset - rightOffset,
          cellHeight,
          theme,
        );
        ctx.restore();
        // Render overlay decorators (on top of content)
        if (overlayDecorators) {
          for (const dec of overlayDecorators) {
            ctx.save();
            try {
              dec.render(ctx, cellData, cellX, y, cellWidth, cellHeight, theme);
            } catch {
              /* skip broken decorator */
            }
            ctx.restore();
          }
        }
        ctx.font = font;
        ctx.fillStyle = theme.colors.cellText;
        ctx.textBaseline = 'middle';
        fontChanged = false;
        continue;
      }

      // Per-cell style overrides for default text rendering
      const cellStyle = cellData.style?.style;
      const hasCustomFont =
        cellStyle?.fontFamily ||
        cellStyle?.fontSize ||
        cellStyle?.fontWeight ||
        cellStyle?.fontStyle;
      let cellFont: string;

      if (hasCustomFont) {
        cellFont = this.buildCellFont(cellStyle!, theme);
        ctx.font = cellFont;
        fontChanged = true;
      } else {
        cellFont = font;
        if (fontChanged) {
          ctx.font = font;
          fontChanged = false;
        }
      }

      ctx.fillStyle = cellStyle?.textColor ?? theme.colors.cellText;

      const text = renderer.format(rawValue);
      if (text === '') continue;

      // Per-cell alignment, wrapping, and indent
      const effectiveAlign = cellStyle?.textAlign ?? renderer.align;
      const effectiveWrap = cellStyle?.textWrap ?? col.wrapText ?? false;
      const indentPx = (cellStyle?.indent ?? 0) * padding;
      // Indent and decorator offsets reduce available text width
      const availableWidth = cellWidth - padding * 2 - indentPx - leftOffset - rightOffset;
      // Text area boundaries accounting for decorator offsets
      const textLeftX = cellX + leftOffset;
      const textRightX = cellX + cellWidth - rightOffset;

      // Word-wrap mode: render multi-line wrapped text
      if (effectiveWrap) {
        const lines = this.measureCache.getWrappedLines(ctx, text, cellFont, availableWidth);
        const emHeight = this.measureCache.measureEmHeight(ctx, cellFont);
        const lineHeightPx = emHeight * LINE_HEIGHT_MULTIPLIER;
        const totalTextHeight = lines.length * lineHeightPx;

        // Vertical alignment for wrapped text block
        const vAlign = cellStyle?.verticalAlign ?? 'middle';
        let startY: number;
        if (vAlign === 'top') {
          startY = y + padding + lineHeightPx / 2;
        } else if (vAlign === 'bottom') {
          startY = y + cellHeight - padding - totalTextHeight + lineHeightPx / 2;
        } else {
          startY = y + (cellHeight - totalTextHeight) / 2 + lineHeightPx / 2;
        }

        ctx.textAlign = effectiveAlign;

        for (let li = 0; li < lines.length; li++) {
          const lineY = startY + li * lineHeightPx;
          // Skip lines outside cell bounds
          if (lineY < y || lineY > y + cellHeight) continue;

          const line = lines[li];
          if (line === '') continue;

          if (effectiveAlign === 'right') {
            ctx.fillText(line, textRightX - padding, lineY);
          } else if (effectiveAlign === 'center') {
            ctx.fillText(line, (textLeftX + textRightX) / 2, lineY);
          } else {
            ctx.fillText(line, textLeftX + padding + indentPx, lineY);
          }
        }

        // Render overlay decorators after text
        if (overlayDecorators) {
          for (const dec of overlayDecorators) {
            ctx.save();
            try {
              dec.render(ctx, cellData, cellX, y, cellWidth, cellHeight, theme);
            } catch {
              /* skip broken decorator */
            }
            ctx.restore();
          }
        }
        continue;
      }

      // Single-line mode: truncate with ellipsis
      const displayText = this.measureCache.truncateText(ctx, text, cellFont, availableWidth);
      if (displayText === '') continue;

      ctx.textAlign = effectiveAlign;

      // Vertical alignment for single-line text
      const vAlign = cellStyle?.verticalAlign ?? 'middle';
      let textY: number;
      if (vAlign === 'top') {
        const emHeight = this.measureCache.measureEmHeight(ctx, cellFont);
        textY = y + padding + (emHeight * LINE_HEIGHT_MULTIPLIER) / 2;
      } else if (vAlign === 'bottom') {
        const emHeight = this.measureCache.measureEmHeight(ctx, cellFont);
        textY = y + cellHeight - padding - (emHeight * LINE_HEIGHT_MULTIPLIER) / 2;
      } else {
        textY = y + cellHeight / 2;
      }

      if (effectiveAlign === 'right') {
        ctx.fillText(displayText, textRightX - padding, textY);
      } else if (effectiveAlign === 'center') {
        ctx.fillText(displayText, (textLeftX + textRightX) / 2, textY);
      } else {
        ctx.fillText(displayText, textLeftX + padding + indentPx, textY);
      }

      // Render overlay decorators after text
      if (overlayDecorators) {
        for (const dec of overlayDecorators) {
          ctx.save();
          try {
            dec.render(ctx, cellData, cellX, y, cellWidth, cellHeight, theme);
          } catch {
            /* skip broken decorator */
          }
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }
}
