// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * CellEditorRegistry — maps column types / predicates to CellEditor instances.
 *
 * The engine queries the registry via `resolve(column, value)` to find the
 * best-matching editor for a cell. Multiple editors may be registered;
 * the one with the highest priority whose matcher returns true wins.
 *
 * InlineEditor (textarea) is NOT managed by the registry — it serves as the
 * engine's built-in fallback when no registered editor matches.
 */

import type { CellValue, ColumnDef } from '../types/interfaces';
import type { SpreadsheetTheme } from '../themes/theme-types';
import type { ResolvedLocale } from '../locale/resolve-locale';
import type { CellEditor, CellEditorMatcher, CellEditorRegistration } from './cell-editor';

export class CellEditorRegistry {
  private entries: CellEditorRegistration[] = [];

  /**
   * Register an editor with a matcher predicate.
   * @param editor The CellEditor instance
   * @param matcher Predicate: (column, value) => boolean
   * @param priority Higher wins when multiple match (default: 0)
   */
  register(editor: CellEditor, matcher: CellEditorMatcher, priority = 0): void {
    this.entries.push({ editor, matcher, priority });
    // Keep sorted by priority descending for fast resolve
    this.entries.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Convenience: register an editor for a specific column `type` string.
   * Equivalent to register(editor, (col) => col.type === type, priority).
   */
  registerForType(editor: CellEditor, type: string, priority = 0): void {
    this.register(editor, (column: ColumnDef) => column.type === type, priority);
  }

  /**
   * Find the best editor for a cell.
   * @returns The matching CellEditor, or null if none match (engine uses InlineEditor).
   */
  resolve(column: ColumnDef, value: CellValue): CellEditor | null {
    for (const entry of this.entries) {
      if (entry.matcher(column, value)) {
        return entry.editor;
      }
    }
    return null;
  }

  /** Get all registered editors (for theme/locale propagation). */
  getAll(): CellEditor[] {
    // Deduplicate — same editor may be registered for multiple matchers
    const seen = new Set<CellEditor>();
    const result: CellEditor[] = [];
    for (const entry of this.entries) {
      if (!seen.has(entry.editor)) {
        seen.add(entry.editor);
        result.push(entry.editor);
      }
    }
    return result;
  }

  /** Propagate theme to all registered editors. */
  setTheme(theme: SpreadsheetTheme): void {
    for (const editor of this.getAll()) {
      editor.setTheme(theme);
    }
  }

  /** Propagate locale to all registered editors. */
  setLocale(locale: ResolvedLocale): void {
    for (const editor of this.getAll()) {
      editor.setLocale(locale);
    }
  }

  /** Destroy all registered editors and clear the registry. */
  destroy(): void {
    for (const editor of this.getAll()) {
      editor.destroy();
    }
    this.entries = [];
  }
}
