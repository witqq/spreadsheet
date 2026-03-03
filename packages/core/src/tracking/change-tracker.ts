// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ChangeTracker — tracks cell modifications and manages cell metadata status.
 *
 * Hooks into CommandManager callbacks to detect cell changes.
 * Maintains baseline values to determine if a cell is modified.
 * Provides public API for external status transitions (saving/saved).
 */

import type { CellStore } from '../model/cell-store';
import type { EventBus } from '../events/event-bus';
import type { Command } from '../commands/command';
import type { CellValue, CellMetadata } from '../types/interfaces';

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function parseKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':');
  return { row: Number(r), col: Number(c) };
}

interface CellAffecting {
  readonly affectedCells: ReadonlyArray<{
    row: number;
    col: number;
    oldValue: CellValue;
    newValue: CellValue;
  }>;
}

function isCellAffecting(command: Command): command is Command & CellAffecting {
  return 'affectedCells' in command && Array.isArray((command as CellAffecting).affectedCells);
}

export interface ChangeTrackerConfig {
  cellStore: CellStore;
  eventBus: EventBus;
}

export class ChangeTracker {
  private readonly cellStore: CellStore;
  private readonly eventBus: EventBus;
  private readonly baselines = new Map<string, CellValue>();
  private readonly changedCells = new Set<string>();

  constructor(config: ChangeTrackerConfig) {
    this.cellStore = config.cellStore;
    this.eventBus = config.eventBus;
  }

  /** Capture current cell values as baselines (call after bulk load). */
  captureBaseline(): void {
    this.baselines.clear();
    this.changedCells.clear();
  }

  /** CommandManager onAfterExecute callback. */
  handleCommandExecute = (command: Command): void => {
    if (!isCellAffecting(command)) return;
    for (const cell of command.affectedCells) {
      this.trackChange(cell.row, cell.col, cell.oldValue, cell.newValue);
    }
  };

  /** CommandManager onAfterUndo callback. */
  handleCommandUndo = (command: Command): void => {
    if (!isCellAffecting(command)) return;
    // On undo, oldValue is restored (values are swapped from execute perspective)
    for (const cell of command.affectedCells) {
      this.trackChange(cell.row, cell.col, cell.newValue, cell.oldValue);
    }
  };

  /** CommandManager onAfterRedo callback. */
  handleCommandRedo = (command: Command): void => {
    // Redo applies the same changes as execute
    this.handleCommandExecute(command);
  };

  /**
   * Set cell status externally (for saving/saved transitions).
   * Does not validate — directly sets the status.
   */
  setCellStatus(
    row: number,
    col: number,
    status: CellMetadata['status'],
    errorMessage?: string,
  ): void {
    const key = cellKey(row, col);
    const existing = this.cellStore.get(row, col);
    const oldStatus = existing?.metadata?.status;

    if (oldStatus === status) return;

    const meta: Partial<CellMetadata> =
      errorMessage !== undefined
        ? { status, errorMessage }
        : status !== 'error'
          ? { status, errorMessage: undefined }
          : { status };
    this.cellStore.setMetadata(row, col, meta);

    if (status === 'saved') {
      // Update baseline to current value on save
      const current = this.cellStore.get(row, col);
      this.baselines.set(key, current?.value ?? null);
      this.changedCells.delete(key);
    }

    this.eventBus.emit('cellStatusChange', {
      row,
      col,
      oldStatus,
      newStatus: status,
      errorMessage,
    });
  }

  /** Get current status of a cell. */
  getCellStatus(row: number, col: number): CellMetadata['status'] | undefined {
    return this.cellStore.get(row, col)?.metadata?.status;
  }

  /** Get all cells currently marked as changed. */
  getChangedCells(): Array<{ row: number; col: number }> {
    return Array.from(this.changedCells).map(parseKey);
  }

  /** Clear all change tracking, update baselines to current values. */
  clearChanges(): void {
    for (const key of this.changedCells) {
      const { row, col } = parseKey(key);
      const existing = this.cellStore.get(row, col);
      if (existing?.metadata?.status === 'changed' || existing?.metadata?.status === 'error') {
        this.cellStore.clearMetadata(row, col);
      }
    }
    this.changedCells.clear();
    this.baselines.clear();
  }

  private trackChange(row: number, col: number, _oldValue: CellValue, newValue: CellValue): void {
    const key = cellKey(row, col);

    // Capture baseline on first modification
    if (!this.baselines.has(key)) {
      this.baselines.set(key, _oldValue);
    }

    const baseline = this.baselines.get(key);
    const isBackToBaseline = newValue === baseline;

    if (isBackToBaseline) {
      // Value reverted to baseline — clear changed status
      this.changedCells.delete(key);
      const existing = this.cellStore.get(row, col);
      const oldStatus = existing?.metadata?.status;
      if (oldStatus === 'changed' || oldStatus === 'error') {
        this.cellStore.clearMetadata(row, col);
        this.eventBus.emit('cellStatusChange', {
          row,
          col,
          oldStatus,
          newStatus: undefined,
        });
      }
    } else {
      // Value differs from baseline — mark as changed
      this.changedCells.add(key);
      const existing = this.cellStore.get(row, col);
      const oldStatus = existing?.metadata?.status;
      if (oldStatus !== 'changed') {
        this.cellStore.setMetadata(row, col, { status: 'changed', errorMessage: undefined });
        this.eventBus.emit('cellStatusChange', {
          row,
          col,
          oldStatus,
          newStatus: 'changed',
        });
      }
    }
  }
}
