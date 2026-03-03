// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ClipboardManager — handles copy, cut, and paste operations.
 *
 * Listens for native clipboard events on the scroll container.
 * Serializes selected cells as TSV + HTML table on copy/cut.
 * Parses HTML tables (Excel/Sheets) or TSV on paste.
 * All data modifications are undoable via BatchCellEditCommand.
 */

import type { CellStore } from '../model/cell-store';
import type { SelectionManager } from '../selection/selection-manager';
import type { CommandManager } from '../commands/command-manager';
import type { EventBus } from '../events/event-bus';
import type { DataView } from '../dataview/data-view';
import type { CellValue } from '../types/interfaces';
import { BatchCellEditCommand } from '../commands/batch-cell-edit-command';
import type { CellEdit } from '../commands/batch-cell-edit-command';
import { serializeToTSV, serializeToHTML, parseTSV, parseHTML } from './clipboard-serializer';

export interface ClipboardManagerConfig {
  cellStore: CellStore;
  dataView: DataView;
  selectionManager: SelectionManager;
  commandManager: CommandManager;
  eventBus: EventBus;
  /** Returns true when the inline editor is active (clipboard events pass through). */
  isEditing: () => boolean;
  /** Callback to trigger re-render after data changes. */
  onDataChange: () => void;
}

export class ClipboardManager {
  private readonly cellStore: CellStore;
  private readonly dataView: DataView;
  private readonly selectionManager: SelectionManager;
  private readonly commandManager: CommandManager;
  private readonly eventBus: EventBus;
  private readonly isEditing: () => boolean;
  private readonly onDataChange: () => void;
  private scrollContainer: HTMLElement | null = null;

  constructor(config: ClipboardManagerConfig) {
    this.cellStore = config.cellStore;
    this.dataView = config.dataView;
    this.selectionManager = config.selectionManager;
    this.commandManager = config.commandManager;
    this.eventBus = config.eventBus;
    this.isEditing = config.isEditing;
    this.onDataChange = config.onDataChange;
  }

  /** Attach clipboard event listeners to the scroll container. */
  attach(scrollContainer: HTMLElement): void {
    this.scrollContainer = scrollContainer;
    scrollContainer.addEventListener('copy', this.handleCopy);
    scrollContainer.addEventListener('cut', this.handleCut);
    scrollContainer.addEventListener('paste', this.handlePaste);
  }

  /** Detach all clipboard event listeners. */
  detach(): void {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('copy', this.handleCopy);
      this.scrollContainer.removeEventListener('cut', this.handleCut);
      this.scrollContainer.removeEventListener('paste', this.handlePaste);
      this.scrollContainer = null;
    }
  }

  /**
   * Read selected cell values as a 2D array.
   * Uses the first selected range.
   */
  getSelectedData(): CellValue[][] {
    const sel = this.selectionManager.getSelection();
    if (sel.ranges.length === 0) return [];
    const range = sel.ranges[0];
    const data: CellValue[][] = [];
    for (let row = range.startRow; row <= range.endRow; row++) {
      const rowData: CellValue[] = [];
      const physRow = this.dataView.getPhysicalRow(row);
      for (let col = range.startCol; col <= range.endCol; col++) {
        const cell = this.cellStore.get(physRow, col);
        // For formula cells, copy the formula string (not computed value)
        rowData.push(cell?.formula ?? cell?.value ?? null);
      }
      data.push(rowData);
    }
    return data;
  }

  private handleCopy = (e: ClipboardEvent): void => {
    if (this.isEditing()) return;
    e.preventDefault();

    const data = this.getSelectedData();
    if (data.length === 0) return;

    const tsv = serializeToTSV(data);
    const html = serializeToHTML(data);
    e.clipboardData?.setData('text/plain', tsv);
    e.clipboardData?.setData('text/html', html);

    this.eventBus.emit('clipboardCopy', {
      rowCount: data.length,
      colCount: data[0]?.length ?? 0,
    });
  };

  private handleCut = (e: ClipboardEvent): void => {
    if (this.isEditing()) return;
    e.preventDefault();

    const sel = this.selectionManager.getSelection();
    if (sel.ranges.length === 0) return;

    const data = this.getSelectedData();
    if (data.length === 0) return;

    const tsv = serializeToTSV(data);
    const html = serializeToHTML(data);
    e.clipboardData?.setData('text/plain', tsv);
    e.clipboardData?.setData('text/html', html);

    // Clear source cells via undoable command
    const range = sel.ranges[0];
    const edits: CellEdit[] = [];
    for (let row = range.startRow; row <= range.endRow; row++) {
      const physRow = this.dataView.getPhysicalRow(row);
      for (let col = range.startCol; col <= range.endCol; col++) {
        const cell = this.cellStore.get(physRow, col);
        const oldValue = cell?.value ?? null;
        if (oldValue !== null) {
          edits.push({ row: physRow, col, oldValue, newValue: null });
        }
      }
    }
    if (edits.length > 0) {
      const command = new BatchCellEditCommand(this.cellStore, edits);
      this.commandManager.execute(command);
      this.eventBus.emit('commandExecute', { description: command.description });
      this.onDataChange();
    }

    this.eventBus.emit('clipboardCut', {
      rowCount: data.length,
      colCount: data[0]?.length ?? 0,
    });
  };

  private handlePaste = (e: ClipboardEvent): void => {
    if (this.isEditing()) return;
    e.preventDefault();

    // Try HTML first (Excel/Google Sheets format), fall back to TSV
    const htmlContent = e.clipboardData?.getData('text/html') ?? '';
    const textContent = e.clipboardData?.getData('text/plain') ?? '';

    let data: CellValue[][] | null = null;
    if (htmlContent) {
      data = parseHTML(htmlContent);
    }
    if (!data && textContent) {
      data = parseTSV(textContent);
    }
    if (!data || data.length === 0) return;

    // Paste starting at active cell, clip at grid boundaries
    const sel = this.selectionManager.getSelection();
    const startRow = sel.activeCell.row;
    const startCol = sel.activeCell.col;
    const maxRow = this.selectionManager.rowCount - 1;
    const maxCol = this.selectionManager.colCount - 1;

    const edits: CellEdit[] = [];
    for (let r = 0; r < data.length; r++) {
      const targetRow = startRow + r;
      if (targetRow > maxRow) break;
      const physRow = this.dataView.getPhysicalRow(targetRow);
      for (let c = 0; c < data[r].length; c++) {
        const targetCol = startCol + c;
        if (targetCol > maxCol) break;
        const oldCell = this.cellStore.get(physRow, targetCol);
        const oldValue = oldCell?.value ?? null;
        const newValue = data[r][c];
        edits.push({ row: physRow, col: targetCol, oldValue, newValue });
      }
    }

    if (edits.length > 0) {
      const command = new BatchCellEditCommand(this.cellStore, edits);
      this.commandManager.execute(command);
      this.eventBus.emit('commandExecute', { description: command.description });
      this.onDataChange();
    }

    this.eventBus.emit('clipboardPaste', {
      rowCount: data.length,
      colCount: data[0]?.length ?? 0,
    });
  };
}
