// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RenderPipeline — orchestrates render layers on a single canvas.
 *
 * Each layer is rendered in order on the same canvas context.
 *
 * When frozen panes are active, renders each layer 4 times with
 * different clip rects, scroll offsets, and viewport ranges per region.
 */

import type { RenderLayer, RenderContext, PaneRegion } from './render-layer';
import type { GridGeometry } from './grid-geometry';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { ViewportRange, FrozenViewportRanges } from './viewport-manager';
import type { RenderMode } from './render-layer';
import type { LayoutEngine } from './layout-engine';
import type { MergeManager } from '../merge/merge-manager';
import type { DirtyRect } from './dirty-tracker';

export interface FrozenPaneConfig {
  frozenRows: number;
  frozenColumns: number;
  layoutEngine: LayoutEngine;
  frozenRanges: FrozenViewportRanges;
}

interface RegionSpec {
  region: PaneRegion;
  viewport: ViewportRange;
  clipX: number;
  clipY: number;
  clipW: number;
  clipH: number;
  scrollX: number;
  scrollY: number;
}

export class RenderPipeline {
  private layers: RenderLayer[] = [];
  private readonly geometry: GridGeometry;
  private theme: SpreadsheetTheme;
  private mergeManager: MergeManager | undefined;

  // Frozen pane caching
  private frozenCacheScrollX: number = NaN;
  private frozenCacheScrollY: number = NaN;
  private cornerCache: ImageData | null = null;
  private frozenRowCache: ImageData | null = null;
  private frozenColCache: ImageData | null = null;
  private frozenRowHeaderCache: ImageData | null = null;
  private frozenColRowNumCache: ImageData | null = null;

  constructor(geometry: GridGeometry, theme: SpreadsheetTheme) {
    this.geometry = geometry;
    this.theme = theme;
  }

  addLayer(layer: RenderLayer): void {
    this.layers.push(layer);
  }

  insertLayerBefore(layer: RenderLayer, beforeLayer: RenderLayer): void {
    const idx = this.layers.findIndex((l) => l === beforeLayer);
    if (idx === -1) {
      this.layers.push(layer);
    } else {
      this.layers.splice(idx, 0, layer);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLayer<T extends RenderLayer>(layerClass: abstract new (...args: any[]) => T): T | undefined {
    const entry = this.layers.find((l) => l instanceof layerClass);
    return entry as T | undefined;
  }

  removeLayer(layer: RenderLayer): void {
    this.layers = this.layers.filter((l) => l !== layer);
  }

  setMergeManager(manager: MergeManager | undefined): void {
    this.mergeManager = manager;
  }

  setTheme(theme: SpreadsheetTheme): void {
    this.theme = theme;
    this.invalidateFrozenCache();
  }

  /** Invalidate frozen pane caches (call when data, theme, or structure changes). */
  invalidateFrozenCache(): void {
    this.cornerCache = null;
    this.frozenRowCache = null;
    this.frozenColCache = null;
    this.frozenRowHeaderCache = null;
    this.frozenColRowNumCache = null;
    this.frozenCacheScrollX = NaN;
    this.frozenCacheScrollY = NaN;
  }

  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportRange,
    canvasWidth: number,
    canvasHeight: number,
    scrollX: number,
    scrollY: number,
    renderMode: RenderMode = 'full',
    frozenConfig?: FrozenPaneConfig,
  ): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const hasFrozen =
      frozenConfig && (frozenConfig.frozenRows > 0 || frozenConfig.frozenColumns > 0);

    if (!hasFrozen) {
      for (const layer of this.layers) {
        const rc: RenderContext = {
          ctx,
          geometry: this.geometry,
          theme: this.theme,
          canvasWidth,
          canvasHeight,
          viewport,
          scrollX,
          scrollY,
          renderMode,
          paneRegion: 'full',
          mergeManager: this.mergeManager,
        };

        layer.render(rc);
      }
      return;
    }

    // Frozen pane rendering — 4 regions with caching
    const { frozenRows, frozenColumns, layoutEngine, frozenRanges } = frozenConfig!;
    const headerHeight = this.geometry.headerHeight;
    const rnWidth = this.geometry.rowNumberWidth;
    const frH = layoutEngine.getFrozenRowsHeight(frozenRows);
    const frW = layoutEngine.getFrozenColsWidth(frozenColumns);

    const scrollXChanged = scrollX !== this.frozenCacheScrollX;
    const scrollYChanged = scrollY !== this.frozenCacheScrollY;

    const regions: RegionSpec[] = [];

    // Corner: frozen rows + frozen cols, never scrolls
    if (frozenRows > 0 && frozenColumns > 0) {
      if (!this.cornerCache) {
        regions.push({
          region: 'corner',
          viewport: frozenRanges.corner,
          clipX: rnWidth,
          clipY: headerHeight,
          clipW: frW,
          clipH: frH,
          scrollX: 0,
          scrollY: 0,
        });
      }
    }

    // Frozen-row strip: frozen rows, scrolls horizontally only
    if (frozenRows > 0) {
      if (scrollXChanged || !this.frozenRowCache) {
        regions.push({
          region: 'frozenRow',
          viewport: frozenRanges.frozenRow,
          clipX: rnWidth + frW,
          clipY: headerHeight,
          clipW: canvasWidth - rnWidth - frW,
          clipH: frH,
          scrollX,
          scrollY: 0,
        });
      }
    }

    // Frozen-col strip: frozen cols, scrolls vertically only
    if (frozenColumns > 0) {
      if (scrollYChanged || !this.frozenColCache) {
        regions.push({
          region: 'frozenCol',
          viewport: frozenRanges.frozenCol,
          clipX: rnWidth,
          clipY: headerHeight + frH,
          clipW: frW,
          clipH: canvasHeight - headerHeight - frH,
          scrollX: 0,
          scrollY,
        });
      }
    }

    // Main content: always re-renders
    regions.push({
      region: 'main',
      viewport: frozenRanges.main,
      clipX: rnWidth + frW,
      clipY: headerHeight + frH,
      clipW: canvasWidth - rnWidth - frW,
      clipH: canvasHeight - headerHeight - frH,
      scrollX,
      scrollY,
    });

    // Render each layer across all regions
    for (const layer of this.layers) {
      for (const spec of regions) {
        if (spec.clipW <= 0 || spec.clipH <= 0) continue;

        ctx.save();
        ctx.beginPath();
        ctx.rect(spec.clipX, spec.clipY, spec.clipW, spec.clipH);
        ctx.clip();

        const rc: RenderContext = {
          ctx,
          geometry: this.geometry,
          theme: this.theme,
          canvasWidth,
          canvasHeight,
          viewport: spec.viewport,
          scrollX: spec.scrollX,
          scrollY: spec.scrollY,
          renderMode,
          paneRegion: spec.region,
          mergeManager: this.mergeManager,
        };

        layer.render(rc);
        ctx.restore();
      }
    }

    // Save caches for rendered regions and restore cached regions that were skipped
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Corner region caching
    if (frozenRows > 0 && frozenColumns > 0) {
      if (!this.cornerCache && frW > 0 && frH > 0) {
        this.cornerCache = this.captureRegion(ctx, rnWidth, headerHeight, frW, frH, dpr);
      } else if (this.cornerCache) {
        this.restoreRegion(ctx, this.cornerCache, rnWidth, headerHeight, dpr);
      }
    }

    // Frozen-row region caching
    if (frozenRows > 0) {
      const frRowW = canvasWidth - rnWidth - frW;
      if ((scrollXChanged || !this.frozenRowCache) && frRowW > 0 && frH > 0) {
        this.frozenRowCache = this.captureRegion(
          ctx,
          rnWidth + frW,
          headerHeight,
          frRowW,
          frH,
          dpr,
        );
      } else if (this.frozenRowCache) {
        this.restoreRegion(ctx, this.frozenRowCache, rnWidth + frW, headerHeight, dpr);
      }
    }

    // Frozen-col region caching
    if (frozenColumns > 0) {
      const frColH = canvasHeight - headerHeight - frH;
      if ((scrollYChanged || !this.frozenColCache) && frW > 0 && frColH > 0) {
        this.frozenColCache = this.captureRegion(
          ctx,
          rnWidth,
          headerHeight + frH,
          frW,
          frColH,
          dpr,
        );
      } else if (this.frozenColCache) {
        this.restoreRegion(ctx, this.frozenColCache, rnWidth, headerHeight + frH, dpr);
      }
    }

    // Render headers in frozen col area (no scrollX) — cached
    if (frozenColumns > 0) {
      if (!this.frozenRowHeaderCache) {
        for (const layer of this.layers) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(rnWidth, 0, frW, headerHeight);
          ctx.clip();

          const rc: RenderContext = {
            ctx,
            geometry: this.geometry,
            theme: this.theme,
            canvasWidth,
            canvasHeight,
            viewport: frozenRanges.corner,
            scrollX: 0,
            scrollY: 0,
            renderMode,
            paneRegion: 'corner',
            mergeManager: this.mergeManager,
          };

          layer.render(rc);
          ctx.restore();
        }
        if (frW > 0 && headerHeight > 0) {
          this.frozenRowHeaderCache = this.captureRegion(ctx, rnWidth, 0, frW, headerHeight, dpr);
        }
      } else {
        this.restoreRegion(ctx, this.frozenRowHeaderCache, rnWidth, 0, dpr);
      }
    }

    // Render headers in main col area (with scrollX)
    {
      for (const layer of this.layers) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rnWidth + frW, 0, canvasWidth - rnWidth - frW, headerHeight);
        ctx.clip();

        const rc: RenderContext = {
          ctx,
          geometry: this.geometry,
          theme: this.theme,
          canvasWidth,
          canvasHeight,
          viewport: frozenRanges.main,
          scrollX,
          scrollY: 0,
          renderMode,
          paneRegion: 'frozenRow',
          mergeManager: this.mergeManager,
        };

        layer.render(rc);
        ctx.restore();
      }
    }

    // Render row numbers for frozen rows (no scrollY) — cached
    if (frozenRows > 0) {
      if (!this.frozenColRowNumCache) {
        for (const layer of this.layers) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, headerHeight, rnWidth, frH);
          ctx.clip();

          const rc: RenderContext = {
            ctx,
            geometry: this.geometry,
            theme: this.theme,
            canvasWidth,
            canvasHeight,
            viewport: frozenRanges.corner,
            scrollX: 0,
            scrollY: 0,
            renderMode,
            paneRegion: 'corner',
            mergeManager: this.mergeManager,
          };

          layer.render(rc);
          ctx.restore();
        }
        if (rnWidth > 0 && frH > 0) {
          this.frozenColRowNumCache = this.captureRegion(ctx, 0, headerHeight, rnWidth, frH, dpr);
        }
      } else {
        this.restoreRegion(ctx, this.frozenColRowNumCache, 0, headerHeight, dpr);
      }
    }

    // Render row numbers for scrolling rows (with scrollY)
    {
      for (const layer of this.layers) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, headerHeight + frH, rnWidth, canvasHeight - headerHeight - frH);
        ctx.clip();

        const rc: RenderContext = {
          ctx,
          geometry: this.geometry,
          theme: this.theme,
          canvasWidth,
          canvasHeight,
          viewport: frozenRanges.main,
          scrollX: 0,
          scrollY,
          renderMode,
          paneRegion: 'frozenCol',
          mergeManager: this.mergeManager,
        };

        layer.render(rc);
        ctx.restore();
      }
    }

    // Update cached scroll positions
    this.frozenCacheScrollX = scrollX;
    this.frozenCacheScrollY = scrollY;

    // Draw frozen pane separator lines
    this.drawFrozenSeparators(ctx, canvasWidth, canvasHeight, headerHeight, rnWidth, frW, frH);
  }

  /**
   * Partial render: only re-draw the specified dirty rectangles.
   */
  renderPartial(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportRange,
    canvasWidth: number,
    canvasHeight: number,
    scrollX: number,
    scrollY: number,
    dirtyRects: DirtyRect[],
    renderMode: RenderMode = 'full',
    frozenConfig?: FrozenPaneConfig,
  ): void {
    if (frozenConfig && (frozenConfig.frozenRows > 0 || frozenConfig.frozenColumns > 0)) {
      this.render(
        ctx,
        viewport,
        canvasWidth,
        canvasHeight,
        scrollX,
        scrollY,
        renderMode,
        frozenConfig,
      );
      return;
    }

    if (dirtyRects.length === 0) return;

    ctx.save();
    ctx.beginPath();
    for (const rect of dirtyRects) {
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
    }
    ctx.clip();
    for (const rect of dirtyRects) {
      ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    }

    for (const layer of this.layers) {
      const rc: RenderContext = {
        ctx,
        geometry: this.geometry,
        theme: this.theme,
        canvasWidth,
        canvasHeight,
        viewport,
        scrollX,
        scrollY,
        renderMode,
        paneRegion: 'full',
        mergeManager: this.mergeManager,
      };
      layer.render(rc);
    }

    ctx.restore();
  }

  /** Capture a region of the canvas as ImageData for caching. */
  private captureRegion(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    dpr: number,
  ): ImageData | null {
    try {
      return ctx.getImageData(x * dpr, y * dpr, w * dpr, h * dpr);
    } catch {
      return null;
    }
  }

  /** Restore a cached ImageData region to the canvas. */
  private restoreRegion(
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    x: number,
    y: number,
    dpr: number,
  ): void {
    ctx.putImageData(imageData, x * dpr, y * dpr);
  }

  /** Draw separator lines at frozen pane boundaries. */
  private drawFrozenSeparators(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    headerHeight: number,
    rnWidth: number,
    frW: number,
    frH: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = this.theme.colors.frozenSeparator;
    ctx.lineWidth = this.theme.borders.frozenPaneWidth;

    if (frH > 0) {
      const y = headerHeight + frH;
      ctx.beginPath();
      ctx.moveTo(rnWidth, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    if (frW > 0) {
      const x = rnWidth + frW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    ctx.restore();
  }
}
