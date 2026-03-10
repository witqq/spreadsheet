// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * GridRenderer — facade for the composable render pipeline.
 *
 * Creates a default pipeline with standard layers:
 * Background → GridLines → Header → RowNumbers → CellText → CellStatus → EmptyState → Selection
 *
 * All layers render on a single canvas context.
 * Delegates geometry computation to GridGeometry.
 */

import type { ColumnDef, CellRect } from '../types/interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { ViewportRange } from './viewport-manager';
import type { RenderMode } from './render-layer';
import type { CellStore } from '../model/cell-store';
import type { SelectionManager } from '../selection/selection-manager';
import type { DataView } from '../dataview/data-view';
import type { FrozenPaneConfig } from './render-pipeline';
import type { MergeManager } from '../merge/merge-manager';
import type { DirtyRect } from './dirty-tracker';
import { GridGeometry } from './grid-geometry';
import { RenderPipeline } from './render-pipeline';
import { BackgroundLayer } from './layers/background-layer';
import { GridLinesLayer } from './layers/grid-lines-layer';
import { HeaderLayer } from './layers/header-layer';
import type { HeaderSortState, HeaderFilterState } from './layers/header-layer';
import { RowNumberLayer } from './layers/row-number-layer';
import { CellTextLayer } from './layers/cell-text-layer';
import { CellStatusLayer } from './layers/cell-status-layer';
import { SelectionOverlayLayer } from './layers/selection-overlay-layer';
import { EmptyStateLayer } from './layers/empty-state-layer';
import { TextMeasureCache } from './text-measure-cache';
import { CellTypeRegistry } from '../types/cell-type-registry';
import type { ResolvedLocale } from '../locale/resolve-locale';

export interface GridRenderConfig {
  columns: ColumnDef[];
  cellStore: CellStore;
  dataView: DataView;
  rowCount: number;
  theme: SpreadsheetTheme;
  showRowNumbers: boolean;
  showGridLines: boolean;
  selectionManager?: SelectionManager;
  cellTypeRegistry?: CellTypeRegistry;
  /** Cumulative row positions from LayoutEngine (shared reference). */
  rowPositions?: Float64Array;
  /** Per-row heights from LayoutEngine (shared reference). */
  rowHeights?: Float64Array;
}

export class GridRenderer {
  private readonly geometry: GridGeometry;
  private readonly pipeline: RenderPipeline;
  private readonly rowCount: number;
  private readonly textMeasureCache: TextMeasureCache;
  private readonly headerLayer: HeaderLayer;
  private readonly emptyStateLayer: EmptyStateLayer;
  private frozenConfig: FrozenPaneConfig | undefined;
  private gridLinesLayer: GridLinesLayer | undefined;
  private selectionOverlayLayer: SelectionOverlayLayer | undefined;

  constructor(config: GridRenderConfig) {
    this.rowCount = config.rowCount;
    this.textMeasureCache = new TextMeasureCache();

    this.geometry = new GridGeometry({
      columns: config.columns,
      theme: config.theme,
      showRowNumbers: config.showRowNumbers,
      rowPositions: config.rowPositions,
      rowHeights: config.rowHeights,
    });

    this.pipeline = new RenderPipeline(this.geometry, config.theme);
    this.pipeline.addLayer(new BackgroundLayer(config.cellStore, config.dataView));
    this.pipeline.addLayer(
      new CellTextLayer(
        config.cellStore,
        config.dataView,
        this.textMeasureCache,
        config.cellTypeRegistry,
      ),
    );
    this.pipeline.addLayer(new CellStatusLayer(config.cellStore, config.dataView));
    this.emptyStateLayer = new EmptyStateLayer();
    this.pipeline.addLayer(this.emptyStateLayer);
    // GridLines renders after cell content so it's always on top of plugin fills
    if (config.showGridLines) {
      this.gridLinesLayer = new GridLinesLayer(config.cellStore, config.dataView);
      this.pipeline.addLayer(this.gridLinesLayer);
    }
    // Headers render after grid lines so header backgrounds cover grid lines cleanly
    this.headerLayer = new HeaderLayer();
    this.pipeline.addLayer(this.headerLayer);
    if (config.showRowNumbers) {
      this.pipeline.addLayer(new RowNumberLayer());
    }
    // Selection overlay is always the very last layer
    if (config.selectionManager) {
      this.selectionOverlayLayer = new SelectionOverlayLayer(
        config.selectionManager,
        config.dataView,
      );
      this.pipeline.addLayer(this.selectionOverlayLayer);
    }
  }

  /** Compute rectangles for visible columns. */
  computeColumnRects(): CellRect[] {
    return this.geometry.computeColumnRects();
  }

  /** Compute rectangle for a specific cell. */
  computeCellRect(rowIndex: number, colIndex: number): CellRect {
    return this.geometry.computeCellRect(rowIndex, colIndex);
  }

  /** Compute rectangles for all cells as 2D array. */
  computeAllCellRects(): CellRect[][] {
    return this.geometry.computeAllCellRects(this.rowCount);
  }

  /** Expose geometry for direct access (e.g. column resize). */
  getGeometry(): GridGeometry {
    return this.geometry;
  }

  /** Add a render layer to the pipeline after construction.
   *  Layers are inserted before GridLines/Selection to keep grid lines on top of plugin content. */
  addLayer(layer: import('./render-layer').RenderLayer): void {
    if (this.gridLinesLayer) {
      this.pipeline.insertLayerBefore(layer, this.gridLinesLayer);
    } else if (this.selectionOverlayLayer) {
      this.pipeline.insertLayerBefore(layer, this.selectionOverlayLayer);
    } else {
      this.pipeline.addLayer(layer);
    }
  }

  /** Insert a render layer before an existing layer in the pipeline. */
  insertLayerBefore(
    layer: import('./render-layer').RenderLayer,
    beforeLayer: import('./render-layer').RenderLayer,
  ): void {
    this.pipeline.insertLayerBefore(layer, beforeLayer);
  }

  /** Get a render layer by constructor type. */
  getLayer<T extends import('./render-layer').RenderLayer>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layerClass: abstract new (...args: any[]) => T,
  ): T | undefined {
    return this.pipeline.getLayer(layerClass);
  }

  /** Remove a render layer from the pipeline. */
  removeLayer(layer: import('./render-layer').RenderLayer): void {
    this.pipeline.removeLayer(layer);
  }

  /** Update sort state for header indicators. */
  setSortState(state: HeaderSortState): void {
    this.headerLayer.setSortState(state);
  }

  /** Update filter state for header indicators. */
  setFilterState(state: HeaderFilterState): void {
    this.headerLayer.setFilterState(state);
  }

  /** Set frozen pane configuration for 4-region rendering. */
  setFrozenConfig(config: FrozenPaneConfig | undefined): void {
    this.frozenConfig = config;
  }

  /** Invalidate frozen pane caches (call when data changes). */
  invalidateFrozenCache(): void {
    this.pipeline.invalidateFrozenCache();
  }

  /** Set merge manager for merge-aware rendering. */
  setMergeManager(manager: MergeManager | undefined): void {
    this.pipeline.setMergeManager(manager);
  }

  /** Update the theme for runtime theme switching. */
  setTheme(theme: SpreadsheetTheme): void {
    this.geometry.setTheme(theme);
    this.pipeline.setTheme(theme);
  }

  /** Update the locale for runtime locale switching. */
  setLocale(locale: ResolvedLocale): void {
    this.emptyStateLayer.setLocale(locale);
  }

  /** Render the grid onto the given canvas context with viewport range. */
  render(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportRange,
    canvasWidth: number,
    canvasHeight: number,
    scrollX: number,
    scrollY: number,
    renderMode: RenderMode = 'full',
  ): void {
    this.pipeline.render(
      ctx,
      viewport,
      canvasWidth,
      canvasHeight,
      scrollX,
      scrollY,
      renderMode,
      this.frozenConfig,
    );
  }

  /** Partial render: only re-draw the specified dirty rectangles. */
  renderPartial(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportRange,
    canvasWidth: number,
    canvasHeight: number,
    scrollX: number,
    scrollY: number,
    dirtyRects: DirtyRect[],
    renderMode: RenderMode = 'full',
  ): void {
    this.pipeline.renderPartial(
      ctx,
      viewport,
      canvasWidth,
      canvasHeight,
      scrollX,
      scrollY,
      dirtyRects,
      renderMode,
      this.frozenConfig,
    );
  }
}
