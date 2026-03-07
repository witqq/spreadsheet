// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Default context menu items for the spreadsheet engine.
 *
 * Registers clipboard, sort, and row manipulation items.
 */

import type { ContextMenuItem } from './context-menu-manager';
import { InsertRowCommand, DeleteRowCommand } from '../commands/row-commands';
import { BatchCellEditCommand } from '../commands/batch-cell-edit-command';
import type { CellEdit } from '../commands/batch-cell-edit-command';
import { serializeToTSV } from '../clipboard/clipboard-serializer';
import type { ResolvedLocale } from '../locale/resolve-locale';

export function createDefaultMenuItems(locale?: ResolvedLocale): ContextMenuItem[] {
  const cm = locale?.contextMenu;
  return [
    // ─── Clipboard items (all contexts with selection) ───
    {
      id: 'cut',
      label: cm?.cut ?? 'Cut',
      icon: '✂',
      shortcut: 'Ctrl+X',
      contexts: ['cell', 'header', 'row-number'],
      action: (ctx) => {
        const engine = ctx.engine;
        const clipboard = engine.getClipboardManager();
        if (!clipboard) return;
        const data = clipboard.getSelectedData();
        if (data.length === 0) return;

        const tsv = serializeToTSV(data);
        navigator.clipboard.writeText(tsv).catch(() => {
          /* ignore */
        });

        // Clear source cells
        const sel = engine.getSelectionManager().getSelection();
        if (sel.ranges.length === 0) return;
        const range = sel.ranges[0];
        const dataView = engine.getDataView();
        const cellStore = engine.getCellStore();
        const cmdMgr = engine.getCommandManager();

        const edits: CellEdit[] = [];
        for (let row = range.startRow; row <= range.endRow; row++) {
          const physRow = dataView.getPhysicalRow(row);
          for (let col = range.startCol; col <= range.endCol; col++) {
            const cell = cellStore.get(physRow, col);
            const oldValue = cell?.value ?? null;
            if (oldValue !== null) {
              edits.push({ row: physRow, col, oldValue, newValue: null });
            }
          }
        }
        if (edits.length > 0) {
          const cmd = new BatchCellEditCommand(cellStore, edits);
          cmdMgr.execute(cmd);
          engine.render();
        }
      },
    },
    {
      id: 'copy',
      label: cm?.copy ?? 'Copy',
      icon: '📋',
      shortcut: 'Ctrl+C',
      separator: true,
      contexts: ['cell', 'header', 'row-number'],
      action: (ctx) => {
        const engine = ctx.engine;
        const clipboard = engine.getClipboardManager();
        if (!clipboard) return;
        const data = clipboard.getSelectedData();
        if (data.length === 0) return;

        const tsv = serializeToTSV(data);
        navigator.clipboard.writeText(tsv).catch(() => {
          /* ignore */
        });
      },
    },
    {
      id: 'paste',
      label: cm?.paste ?? 'Paste',
      icon: '📥',
      shortcut: 'Ctrl+V',
      separator: true,
      contexts: ['cell'],
      action: (ctx) => {
        const engine = ctx.engine;
        navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) return;
            const rows = text.split('\n').map((line) => line.split('\t'));
            const sel = engine.getSelectionManager().getSelection();
            const startRow = sel.activeCell.row;
            const startCol = sel.activeCell.col;
            const dataView = engine.getDataView();
            const cellStore = engine.getCellStore();
            const cmdMgr = engine.getCommandManager();
            const maxRow = engine.getSelectionManager().rowCount - 1;
            const maxCol = engine.getSelectionManager().colCount - 1;

            const edits: CellEdit[] = [];
            for (let r = 0; r < rows.length; r++) {
              const targetRow = startRow + r;
              if (targetRow > maxRow) break;
              const physRow = dataView.getPhysicalRow(targetRow);
              if (physRow < 0) continue;
              for (let c = 0; c < rows[r].length; c++) {
                const targetCol = startCol + c;
                if (targetCol > maxCol) break;
                const oldCell = cellStore.get(physRow, targetCol);
                const oldValue = oldCell?.value ?? null;
                const raw = rows[r][c];
                const newValue = raw === '' ? null : isNaN(Number(raw)) ? raw : Number(raw);
                edits.push({ row: physRow, col: targetCol, oldValue, newValue });
              }
            }
            if (edits.length > 0) {
              const cmd = new BatchCellEditCommand(cellStore, edits);
              cmdMgr.execute(cmd);
              engine.render();
            }
          })
          .catch(() => {
            /* clipboard not available */
          });
      },
      isDisabled: () => {
        return !navigator.clipboard?.readText;
      },
    },

    // ─── Sort items (header context) ───
    {
      id: 'sort-asc',
      label: cm?.sortAscending ?? 'Sort Ascending',
      icon: '↑',
      contexts: ['header'],
      action: (ctx) => {
        ctx.engine.sortBy([{ col: ctx.col, direction: 'asc' }]);
      },
    },
    {
      id: 'sort-desc',
      label: cm?.sortDescending ?? 'Sort Descending',
      icon: '↓',
      separator: true,
      contexts: ['header'],
      action: (ctx) => {
        ctx.engine.sortBy([{ col: ctx.col, direction: 'desc' }]);
      },
    },

    // ─── Row operations (row-number context) ───
    {
      id: 'insert-row-above',
      label: cm?.insertRowAbove ?? 'Insert Row Above',
      icon: '⬆',
      contexts: ['row-number'],
      action: (ctx) => {
        const engine = ctx.engine;
        const physRow = engine.getDataView().getPhysicalRow(ctx.row);
        const deps = {
          cellStore: engine.getCellStore(),
          mergeManager: engine.getMergeManager(),
          setRowCount: (count: number) => engine.setRowCount(count),
          getRowCount: () => engine.getRowCount(),
        };
        const cmd = new InsertRowCommand(deps, physRow);
        engine.getCommandManager().execute(cmd);
        engine.render();
      },
    },
    {
      id: 'insert-row-below',
      label: cm?.insertRowBelow ?? 'Insert Row Below',
      icon: '⬇',
      contexts: ['row-number'],
      action: (ctx) => {
        const engine = ctx.engine;
        const physRow = engine.getDataView().getPhysicalRow(ctx.row);
        const deps = {
          cellStore: engine.getCellStore(),
          mergeManager: engine.getMergeManager(),
          setRowCount: (count: number) => engine.setRowCount(count),
          getRowCount: () => engine.getRowCount(),
        };
        const cmd = new InsertRowCommand(deps, physRow + 1);
        engine.getCommandManager().execute(cmd);
        engine.render();
      },
    },
    {
      id: 'delete-row',
      label: cm?.deleteRow ?? 'Delete Row',
      icon: '🗑',
      contexts: ['row-number'],
      action: (ctx) => {
        const engine = ctx.engine;
        const physRow = engine.getDataView().getPhysicalRow(ctx.row);
        const deps = {
          cellStore: engine.getCellStore(),
          mergeManager: engine.getMergeManager(),
          setRowCount: (count: number) => engine.setRowCount(count),
          getRowCount: () => engine.getRowCount(),
        };
        const cmd = new DeleteRowCommand(deps, physRow);
        engine.getCommandManager().execute(cmd);
        engine.render();
      },
    },
  ];
}
