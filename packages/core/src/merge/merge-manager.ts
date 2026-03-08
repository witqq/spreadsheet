// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { MergedRegion } from '../types/interfaces';

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * MergeManager — manages merged cell regions with O(1) spatial index lookup.
 *
 * The top-left cell of each region is the "anchor" holding the value.
 * All other cells in the region are "hidden" during rendering.
 */
export class MergeManager {
  private readonly spatialIndex = new Map<string, MergedRegion>();
  private readonly regions: MergedRegion[] = [];

  /**
   * Merge a region. Returns false if invalid (overlap, too small, cross-boundary).
   */
  merge(region: MergedRegion): boolean {
    // Reject inverted coordinates
    if (region.startRow > region.endRow || region.startCol > region.endCol) return false;

    // Validate minimum size (at least 2 cells)
    const cellCount = (region.endRow - region.startRow + 1) * (region.endCol - region.startCol + 1);
    if (cellCount < 2) return false;

    // Check for overlaps with existing regions
    if (this.hasOverlap(region)) return false;

    this.regions.push(region);
    this.indexRegion(region);
    return true;
  }

  /**
   * Unmerge the region starting at (startRow, startCol).
   * Returns false if no region starts at that position.
   */
  unmerge(startRow: number, startCol: number): boolean {
    const idx = this.regions.findIndex((r) => r.startRow === startRow && r.startCol === startCol);
    if (idx === -1) return false;

    const region = this.regions[idx];
    this.regions.splice(idx, 1);
    this.clearIndex(region);
    return true;
  }

  /**
   * Get the merged region containing (row, col), or null if not merged.
   */
  getMergedRegion(row: number, col: number): MergedRegion | null {
    return this.spatialIndex.get(cellKey(row, col)) ?? null;
  }

  /**
   * Returns true if (row, col) is the anchor (top-left) of a merged region.
   */
  isAnchorCell(row: number, col: number): boolean {
    const region = this.spatialIndex.get(cellKey(row, col));
    return region !== undefined && region.startRow === row && region.startCol === col;
  }

  /**
   * Returns true if (row, col) is a non-anchor cell within a merged region.
   */
  isHiddenCell(row: number, col: number): boolean {
    const region = this.spatialIndex.get(cellKey(row, col));
    if (!region) return false;
    return region.startRow !== row || region.startCol !== col;
  }

  /**
   * Get all active merged regions.
   */
  getAllRegions(): ReadonlyArray<MergedRegion> {
    return this.regions;
  }

  /**
   * Remove all merged regions, clearing the spatial index.
   */
  clearAll(): void {
    this.spatialIndex.clear();
    this.regions.length = 0;
  }

  /**
   * Returns true if any merged regions exist.
   */
  hasAnyRegions(): boolean {
    return this.regions.length > 0;
  }

  /**
   * Validate a merge against frozen pane boundaries.
   * Returns an error message string, or null if valid.
   */
  validateMerge(region: MergedRegion, frozenRows: number, frozenCols: number): string | null {
    const cellCount = (region.endRow - region.startRow + 1) * (region.endCol - region.startCol + 1);
    if (cellCount < 2 || region.startRow > region.endRow || region.startCol > region.endCol) {
      return 'Merge region must contain at least 2 cells';
    }

    if (this.hasOverlap(region)) {
      return 'Merge region overlaps with an existing merged region';
    }

    // Cross-boundary check for frozen rows
    if (frozenRows > 0) {
      if (region.startRow < frozenRows && region.endRow >= frozenRows) {
        return 'Merge region cannot cross frozen row boundary';
      }
    }

    // Cross-boundary check for frozen columns
    if (frozenCols > 0) {
      if (region.startCol < frozenCols && region.endCol >= frozenCols) {
        return 'Merge region cannot cross frozen column boundary';
      }
    }

    return null;
  }

  private hasOverlap(region: MergedRegion): boolean {
    for (const existing of this.regions) {
      if (
        region.startRow <= existing.endRow &&
        region.endRow >= existing.startRow &&
        region.startCol <= existing.endCol &&
        region.endCol >= existing.startCol
      ) {
        return true;
      }
    }
    return false;
  }

  private indexRegion(region: MergedRegion): void {
    for (let r = region.startRow; r <= region.endRow; r++) {
      for (let c = region.startCol; c <= region.endCol; c++) {
        this.spatialIndex.set(cellKey(r, c), region);
      }
    }
  }

  private clearIndex(region: MergedRegion): void {
    for (let r = region.startRow; r <= region.endRow; r++) {
      for (let c = region.startCol; c <= region.endCol; c++) {
        this.spatialIndex.delete(cellKey(r, c));
      }
    }
  }
}
