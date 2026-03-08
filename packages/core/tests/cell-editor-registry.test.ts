// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CellEditorRegistry } from '../src/editing/cell-editor-registry';
import type { CellEditor } from '../src/editing/cell-editor';
import type { ColumnDef } from '../src/types/interfaces';
import type { SpreadsheetTheme } from '../src/themes/theme-types';
import type { ResolvedLocale } from '../src/locale/resolve-locale';

/** Minimal CellEditor stub for testing. */
function createStubEditor(id: string): CellEditor {
  return {
    id,
    isOpen: false,
    editingRow: -1,
    editingCol: -1,
    open: vi.fn(),
    close: vi.fn(),
    setTheme: vi.fn(),
    setLocale: vi.fn(),
    destroy: vi.fn(),
  };
}

function colDef(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return { id: 'col-a', header: 'A', width: 100, ...overrides };
}

describe('CellEditorRegistry', () => {
  let registry: CellEditorRegistry;

  beforeEach(() => {
    registry = new CellEditorRegistry();
  });

  it('returns null when no editors registered', () => {
    expect(registry.resolve(colDef({ type: 'date' }), null)).toBeNull();
  });

  it('resolves editor by column type', () => {
    const editor = createStubEditor('date-picker');
    registry.registerForType(editor, 'date');

    expect(registry.resolve(colDef({ type: 'date' }), null)).toBe(editor);
    expect(registry.resolve(colDef({ type: 'text' }), null)).toBeNull();
    expect(registry.resolve(colDef(), null)).toBeNull();
  });

  it('resolves editor by custom predicate', () => {
    const editor = createStubEditor('custom');
    registry.register(editor, (col) => col.id === 'special-col', 0);

    expect(registry.resolve(colDef({ id: 'special-col' }), null)).toBe(editor);
    expect(registry.resolve(colDef({ id: 'other' }), null)).toBeNull();
  });

  it('higher priority wins when multiple editors match', () => {
    const low = createStubEditor('low');
    const high = createStubEditor('high');

    registry.register(low, () => true, 0);
    registry.register(high, () => true, 10);

    expect(registry.resolve(colDef(), null)).toBe(high);
  });

  it('first registered wins at same priority', () => {
    const first = createStubEditor('first');
    const second = createStubEditor('second');

    registry.register(first, () => true, 5);
    registry.register(second, () => true, 5);

    // Same priority — sort is stable, both at 5, order preserved
    const result = registry.resolve(colDef(), null);
    expect(result?.id).toBe('first');
  });

  it('getAll deduplicates same editor registered for multiple types', () => {
    const editor = createStubEditor('multi');
    registry.registerForType(editor, 'date');
    registry.registerForType(editor, 'datetime');

    expect(registry.getAll()).toEqual([editor]);
  });

  it('getAll returns all unique editors', () => {
    const a = createStubEditor('a');
    const b = createStubEditor('b');
    registry.register(a, () => true, 0);
    registry.register(b, () => true, 1);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(a);
    expect(all).toContain(b);
  });

  it('setTheme propagates to all editors', () => {
    const a = createStubEditor('a');
    const b = createStubEditor('b');
    registry.register(a, () => true, 0);
    registry.register(b, () => true, 1);

    const theme = {} as SpreadsheetTheme;
    registry.setTheme(theme);

    expect(a.setTheme).toHaveBeenCalledWith(theme);
    expect(b.setTheme).toHaveBeenCalledWith(theme);
  });

  it('setLocale propagates to all editors', () => {
    const a = createStubEditor('a');
    registry.register(a, () => true, 0);

    const locale = {} as ResolvedLocale;
    registry.setLocale(locale);

    expect(a.setLocale).toHaveBeenCalledWith(locale);
  });

  it('destroy calls destroy on all editors and clears registry', () => {
    const a = createStubEditor('a');
    const b = createStubEditor('b');
    registry.register(a, () => true, 0);
    registry.register(b, () => true, 1);

    registry.destroy();

    expect(a.destroy).toHaveBeenCalled();
    expect(b.destroy).toHaveBeenCalled();
    // After destroy, resolve returns null
    expect(registry.resolve(colDef(), null)).toBeNull();
    expect(registry.getAll()).toEqual([]);
  });

  it('matcher receives both column and value', () => {
    const editor = createStubEditor('value-check');
    const matcher = vi.fn().mockReturnValue(true);
    registry.register(editor, matcher, 0);

    const col = colDef({ id: 'x' });
    registry.resolve(col, 42);

    expect(matcher).toHaveBeenCalledWith(col, 42);
  });
});
