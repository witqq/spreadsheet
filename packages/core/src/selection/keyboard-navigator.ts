// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * KeyboardNavigator — handles keyboard events for spreadsheet navigation.
 *
 * Arrow keys move active cell. Tab/Enter move directionally. Home/End jump
 * to row boundaries. Ctrl+Home/End jump to grid corners. Page Up/Down scroll
 * by visible row count. Shift+Arrow extends selection range.
 */

import type { SelectionManager } from './selection-manager';
import type { GridKeyboardEvent } from '../events/event-types';
import type { CellAddress } from '../types/interfaces';
import type { MergeManager } from '../merge/merge-manager';

export interface KeyboardNavigatorConfig {
  selectionManager: SelectionManager;
  /** Returns the number of fully visible rows in the viewport. */
  getVisibleRowCount: () => number;
}

export class KeyboardNavigator {
  private readonly sm: SelectionManager;
  private readonly getVisibleRowCount: () => number;
  private _mergeManager: MergeManager | null = null;

  constructor(config: KeyboardNavigatorConfig) {
    this.sm = config.selectionManager;
    this.getVisibleRowCount = config.getVisibleRowCount;
  }

  /** Set the merge manager for merge-aware navigation. */
  setMergeManager(mm: MergeManager): void {
    this._mergeManager = mm;
  }

  /**
   * Handle a keyboard event. Returns the new active cell position
   * if navigation occurred (for auto-scroll), or null if the key
   * was not a navigation key.
   */
  handleKeyDown(event: GridKeyboardEvent): CellAddress | null {
    const { key, shiftKey, ctrlKey } = event;
    const sel = this.sm.getSelection();
    const { row, col } = sel.activeCell;
    const maxRow = this.sm.rowCount - 1;
    const maxCol = this.sm.colCount - 1;

    let newRow = row;
    let newCol = col;
    let handled = false;

    switch (key) {
      case 'ArrowUp':
        newRow = Math.max(0, row - 1);
        handled = true;
        break;
      case 'ArrowDown':
        newRow = Math.min(maxRow, row + 1);
        handled = true;
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, col - 1);
        handled = true;
        break;
      case 'ArrowRight':
        newCol = Math.min(maxCol, col + 1);
        handled = true;
        break;
      case 'Tab':
        if (shiftKey) {
          newCol = Math.max(0, col - 1);
        } else {
          newCol = Math.min(maxCol, col + 1);
        }
        handled = true;
        break;
      case 'Enter':
        if (shiftKey) {
          newRow = Math.max(0, row - 1);
        } else {
          newRow = Math.min(maxRow, row + 1);
        }
        handled = true;
        break;
      case 'Home':
        if (ctrlKey) {
          newRow = 0;
          newCol = 0;
        } else {
          newCol = 0;
        }
        handled = true;
        break;
      case 'End':
        if (ctrlKey) {
          newRow = maxRow;
          newCol = maxCol;
        } else {
          newCol = maxCol;
        }
        handled = true;
        break;
      case 'PageUp':
        newRow = Math.max(0, row - this.getVisibleRowCount());
        handled = true;
        break;
      case 'PageDown':
        newRow = Math.min(maxRow, row + this.getVisibleRowCount());
        handled = true;
        break;
      case 'a':
        if (ctrlKey) {
          event.originalEvent.preventDefault();
          this.sm.selectAll();
          return { row, col };
        }
        return null;
    }

    if (!handled) return null;

    // Merge-aware: skip hidden cells in merged regions
    if (this._mergeManager) {
      const region = this._mergeManager.getMergedRegion(newRow, newCol);
      if (region && (region.startRow !== newRow || region.startCol !== newCol)) {
        // Landing on a hidden cell — skip past the merge in the direction of travel
        switch (key) {
          case 'ArrowDown':
            newRow = Math.min(maxRow, region.endRow + 1);
            break;
          case 'Enter':
            if (shiftKey) {
              newRow = Math.max(0, region.startRow - 1);
            } else {
              newRow = Math.min(maxRow, region.endRow + 1);
            }
            break;
          case 'ArrowUp':
            newRow = Math.max(0, region.startRow - 1);
            break;
          case 'ArrowRight':
            newCol = Math.min(maxCol, region.endCol + 1);
            break;
          case 'Tab':
            if (shiftKey) {
              newCol = Math.max(0, region.startCol - 1);
            } else {
              newCol = Math.min(maxCol, region.endCol + 1);
            }
            break;
          case 'ArrowLeft':
            newCol = Math.max(0, region.startCol - 1);
            break;
          case 'PageUp':
            newRow = Math.max(0, region.startRow - 1);
            break;
          case 'PageDown':
            newRow = Math.min(maxRow, region.endRow + 1);
            break;
        }
      }
    }

    event.originalEvent.preventDefault();

    // Shift+Arrow extends selection; all other navigation selects single cell
    if (shiftKey && key.startsWith('Arrow')) {
      this.sm.extendSelection(newRow, newCol);
    } else {
      this.sm.selectCell(newRow, newCol);
    }

    // Return the position used for auto-scroll (resolve to anchor if still in merge)
    if (this._mergeManager) {
      const finalRegion = this._mergeManager.getMergedRegion(newRow, newCol);
      if (finalRegion) {
        return { row: finalRegion.startRow, col: finalRegion.startCol };
      }
    }
    return { row: newRow, col: newCol };
  }
}
