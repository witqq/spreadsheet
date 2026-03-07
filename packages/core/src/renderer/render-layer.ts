// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RenderLayer — interface for composable grid render layers.
 *
 * Each layer draws one visual aspect of the grid (background, lines, headers, etc.).
 * Layers are combined by RenderPipeline in a specific order.
 */

import type { GridGeometry } from './grid-geometry';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { ViewportRange } from './viewport-manager';
import type { MergeManager } from '../merge/merge-manager';

/** Render fidelity mode. Always 'full' after ScrollVelocityTracker removal. */
export type RenderMode = 'full' | 'light' | 'placeholder';

export type PaneRegion = 'corner' | 'frozenRow' | 'frozenCol' | 'main' | 'full';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  geometry: GridGeometry;
  theme: SpreadsheetTheme;
  canvasWidth: number;
  canvasHeight: number;
  viewport: ViewportRange;
  /** Horizontal scroll offset in pixels. */
  scrollX: number;
  /** Vertical scroll offset in pixels. */
  scrollY: number;
  /** Render mode. Always 'full' in current implementation. */
  renderMode: RenderMode;
  /** Which frozen pane region is being rendered. Default: 'full' (no frozen panes). */
  paneRegion: PaneRegion;
  /** MergeManager for merged cell lookup during rendering. */
  mergeManager?: MergeManager;
}

export interface RenderLayer {
  render(rc: RenderContext): void;
  /**
   * Optional bulk row height measurement.
   * Returns a map of row index → desired height for visible rows.
   * Used by the auto row size manager to collect height requirements
   * from all render layers.
   */
  measureHeights?(rc: RenderContext): Map<number, number>;
}
