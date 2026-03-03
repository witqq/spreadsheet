// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DirtyTracker — tracks which visual regions need redrawing.
 *
 * Subsystems mark regions as dirty when state changes. The render
 * loop reads and flushes dirty regions to determine what to redraw.
 *
 * Supports cell-level dirty tracking: when individual cells change,
 * their logical coordinates are recorded. If only cell-update is dirty
 * (no full/viewport-change), the render pipeline can clip to just
 * the affected cell rectangles for partial re-render.
 */

export type DirtyRegion = 'full' | 'viewport-change' | 'cell-update';

export interface DirtyCell {
  row: number; // logical row
  col: number;
}

export interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DirtyTracker {
  private dirtyRegions: Set<DirtyRegion> = new Set();
  private dirtyCells: DirtyCell[] = [];
  private static readonly MAX_DIRTY_CELLS = 50;

  /**
   * Mark a region as needing redraw.
   */
  markDirty(region: DirtyRegion): void {
    this.dirtyRegions.add(region);
  }

  /**
   * Mark a specific cell as dirty with its logical row and column.
   * Also sets 'cell-update' region flag.
   */
  markCellDirty(row: number, col: number): void {
    this.dirtyRegions.add('cell-update');
    if (this.dirtyCells.length < DirtyTracker.MAX_DIRTY_CELLS) {
      if (!this.dirtyCells.some((c) => c.row === row && c.col === col)) {
        this.dirtyCells.push({ row, col });
      }
    }
  }

  /**
   * Whether any region is dirty.
   */
  isDirty(): boolean {
    return this.dirtyRegions.size > 0;
  }

  /**
   * Check if a specific region is dirty.
   */
  isRegionDirty(region: DirtyRegion): boolean {
    return this.dirtyRegions.has(region);
  }

  /**
   * Get all dirty regions and clear them (flush).
   * Returns the set of regions that were dirty.
   */
  flush(): Set<DirtyRegion> {
    const regions = this.dirtyRegions;
    this.dirtyRegions = new Set();
    return regions;
  }

  /**
   * Flush dirty cells and return them. Clears the cell list.
   * Returns cells only if cell-update was the only dirty reason
   * (no full or viewport-change). Otherwise returns null to
   * indicate full re-render is needed.
   */
  flushCells(): DirtyCell[] | null {
    const cells = this.dirtyCells;
    this.dirtyCells = [];

    if (this.dirtyRegions.has('full') || this.dirtyRegions.has('viewport-change')) {
      return null;
    }
    if (cells.length === 0) {
      return null;
    }
    if (cells.length >= DirtyTracker.MAX_DIRTY_CELLS) {
      return null; // too many cells — full render
    }
    return cells;
  }

  /**
   * Clear all dirty flags without returning them.
   */
  clear(): void {
    this.dirtyRegions.clear();
    this.dirtyCells = [];
  }
}
