// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { MergeManager } from '../src/merge/merge-manager';
import type { MergedRegion } from '../src/types/interfaces';
import {
  ContextMenuManager,
  DEFAULT_MENU_ITEM_IDS,
} from '../src/context-menu/context-menu-manager';
import type { ContextMenuItem } from '../src/context-menu/context-menu-manager';
import { EventBus } from '../src/events/event-bus';
import type { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';
import { lightTheme } from '../src/themes/built-in-themes';
import { createDefaultMenuItems } from '../src/context-menu/default-items';

// ─── MergeManager.setRegions ─────────────────────────────────────────────────

describe('MergeManager.setRegions', () => {
  it('replaces all regions atomically', () => {
    const mm = new MergeManager();
    mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    expect(mm.getAllRegions()).toHaveLength(1);

    const result = mm.setRegions([
      { startRow: 5, startCol: 5, endRow: 6, endCol: 6 },
      { startRow: 10, startCol: 0, endRow: 11, endCol: 2 },
    ]);

    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
    expect(mm.getAllRegions()).toHaveLength(2);
    // Old region gone
    expect(mm.getMergedRegion(0, 0)).toBeNull();
    // New regions present
    expect(mm.getMergedRegion(5, 5)).toBeTruthy();
    expect(mm.getMergedRegion(10, 1)).toBeTruthy();
  });

  it('validates overlap within the new set', () => {
    const mm = new MergeManager();
    const result = mm.setRegions([
      { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
      { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }, // overlaps with first
    ]);

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].error).toContain('overlaps');
    expect(mm.getAllRegions()).toHaveLength(1);
  });

  it('rejects invalid regions (single cell, inverted coords)', () => {
    const mm = new MergeManager();
    const result = mm.setRegions([
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, // single cell
      { startRow: 5, startCol: 0, endRow: 2, endCol: 2 }, // inverted rows
      { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, // valid
    ]);

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
    expect(mm.getAllRegions()).toHaveLength(1);
  });

  it('validates frozen pane boundaries', () => {
    const mm = new MergeManager();
    const result = mm.setRegions(
      [
        { startRow: 0, startCol: 0, endRow: 3, endCol: 1 }, // crosses frozen row boundary
        { startRow: 5, startCol: 5, endRow: 6, endCol: 6 }, // valid (outside frozen)
      ],
      2, // frozenRows
      0,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].error).toContain('frozen row');
  });

  it('empty array clears all regions', () => {
    const mm = new MergeManager();
    mm.merge({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    mm.merge({ startRow: 5, startCol: 5, endRow: 6, endCol: 6 });
    expect(mm.getAllRegions()).toHaveLength(2);

    const result = mm.setRegions([]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(mm.getAllRegions()).toHaveLength(0);
    expect(mm.hasAnyRegions()).toBe(false);
  });

  it('rebuilds spatial index correctly after replacement', () => {
    const mm = new MergeManager();
    mm.merge({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
    // Cell (1,1) should be in old region
    expect(mm.getMergedRegion(1, 1)).toBeTruthy();

    mm.setRegions([{ startRow: 10, startCol: 10, endRow: 11, endCol: 11 }]);

    // Old spatial index entries gone
    expect(mm.getMergedRegion(0, 0)).toBeNull();
    expect(mm.getMergedRegion(1, 1)).toBeNull();
    // New spatial index entries present
    expect(mm.getMergedRegion(10, 10)).toBeTruthy();
    expect(mm.getMergedRegion(11, 11)).toBeTruthy();
    expect(mm.isAnchorCell(10, 10)).toBe(true);
    expect(mm.isHiddenCell(11, 11)).toBe(true);
  });

  it('mixed valid and invalid regions: valid ones are all added', () => {
    const mm = new MergeManager();
    const regions: MergedRegion[] = [
      { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
      { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }, // invalid single cell
      { startRow: 5, startCol: 5, endRow: 6, endCol: 6 },
      { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, // overlaps first
      { startRow: 10, startCol: 0, endRow: 11, endCol: 3 },
    ];
    const result = mm.setRegions(regions);

    expect(result.accepted).toHaveLength(3);
    expect(result.rejected).toHaveLength(2);
    expect(mm.getAllRegions()).toHaveLength(3);
  });
});

// ─── ContextMenuManager.setItems ─────────────────────────────────────────────

function createContextMenuManager(): ContextMenuManager {
  const container = document.createElement('div');
  const eventBus = new EventBus();
  const mgr = new ContextMenuManager({
    container,
    engine: {} as SpreadsheetEngine,
    eventBus,
    theme: lightTheme,
  });
  // Simulate engine behavior: register default items
  for (const item of createDefaultMenuItems()) {
    mgr.registerItem(item);
  }
  return mgr;
}

describe('ContextMenuManager.setItems', () => {
  it('replaces custom items while preserving defaults', () => {
    const mgr = createContextMenuManager();

    // Register some custom items
    mgr.registerItem({
      id: 'old-custom',
      label: 'Old Custom',
      contexts: ['cell'],
    });

    // setItems replaces with new custom items
    mgr.setItems([
      { id: 'new-custom-1', label: 'New 1', contexts: ['cell'] },
      { id: 'new-custom-2', label: 'New 2', contexts: ['header'] },
    ]);

    const items = mgr.getItems();
    // Old custom gone
    expect(items.has('old-custom')).toBe(false);
    // New custom present
    expect(items.has('new-custom-1')).toBe(true);
    expect(items.has('new-custom-2')).toBe(true);
    // Defaults preserved
    for (const id of DEFAULT_MENU_ITEM_IDS) {
      expect(items.has(id)).toBe(true);
    }
  });

  it('empty array clears all custom items, keeps defaults', () => {
    const mgr = createContextMenuManager();

    mgr.registerItem({
      id: 'my-action',
      label: 'My Action',
      contexts: ['cell'],
    });

    mgr.setItems([]);

    const items = mgr.getItems();
    expect(items.has('my-action')).toBe(false);
    // All 8 default items still there
    expect(items.size).toBe(DEFAULT_MENU_ITEM_IDS.size);
    for (const id of DEFAULT_MENU_ITEM_IDS) {
      expect(items.has(id)).toBe(true);
    }
  });

  it('allows overriding default items by id', () => {
    const mgr = createContextMenuManager();
    const customCut: ContextMenuItem = {
      id: 'cut',
      label: 'Custom Cut',
      contexts: ['cell', 'header'],
    };

    mgr.setItems([customCut]);

    const items = mgr.getItems();
    // 'cut' now has custom label
    expect(items.get('cut')!.label).toBe('Custom Cut');
    // Other defaults still present
    expect(items.has('copy')).toBe(true);
    expect(items.has('paste')).toBe(true);
  });

  it('multiple setItems calls replace each time', () => {
    const mgr = createContextMenuManager();

    mgr.setItems([
      { id: 'a', label: 'A', contexts: ['cell'] },
      { id: 'b', label: 'B', contexts: ['cell'] },
    ]);
    expect(mgr.getItems().has('a')).toBe(true);
    expect(mgr.getItems().has('b')).toBe(true);

    mgr.setItems([{ id: 'c', label: 'C', contexts: ['cell'] }]);
    expect(mgr.getItems().has('a')).toBe(false);
    expect(mgr.getItems().has('b')).toBe(false);
    expect(mgr.getItems().has('c')).toBe(true);
  });

  it('registerItem after setItems adds to current custom set', () => {
    const mgr = createContextMenuManager();

    mgr.setItems([{ id: 'x', label: 'X', contexts: ['cell'] }]);
    mgr.registerItem({ id: 'y', label: 'Y', contexts: ['cell'] });

    expect(mgr.getItems().has('x')).toBe(true);
    expect(mgr.getItems().has('y')).toBe(true);
  });
});

// ─── DEFAULT_MENU_ITEM_IDS export ────────────────────────────────────────────

describe('DEFAULT_MENU_ITEM_IDS', () => {
  it('contains all 8 known default item ids', () => {
    expect(DEFAULT_MENU_ITEM_IDS.size).toBe(8);
    expect(DEFAULT_MENU_ITEM_IDS.has('cut')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('copy')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('paste')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('sort-asc')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('sort-desc')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('insert-row-above')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('insert-row-below')).toBe(true);
    expect(DEFAULT_MENU_ITEM_IDS.has('delete-row')).toBe(true);
  });
});
