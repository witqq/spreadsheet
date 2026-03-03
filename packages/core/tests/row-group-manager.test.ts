import { describe, it, expect, beforeEach } from 'vitest';
import { RowGroupManager } from '../src/grouping/row-group-manager';
import type { RowGroupDef, ColumnAggregate } from '../src/grouping/row-group-manager';
import { CellStore } from '../src/model/cell-store';
import { DataView } from '../src/dataview/data-view';

describe('RowGroupManager', () => {
  let manager: RowGroupManager;

  beforeEach(() => {
    manager = new RowGroupManager();
  });

  describe('group definition', () => {
    it('sets and retrieves groups', () => {
      const groups: RowGroupDef[] = [
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ];
      manager.setGroups(groups);

      expect(manager.hasGroups()).toBe(true);
      expect(manager.isGroupHeader(0)).toBe(true);
      expect(manager.isGroupHeader(4)).toBe(true);
      expect(manager.isGroupHeader(1)).toBe(false);
      expect(manager.isGroupChild(1)).toBe(true);
      expect(manager.isGroupChild(0)).toBe(false);
      expect(manager.getParentHeader(2)).toBe(0);
      expect(manager.getParentHeader(5)).toBe(4);
    });

    it('defaults to expanded', () => {
      manager.setGroups([{ headerRow: 0, childRows: [1, 2] }]);
      expect(manager.isExpanded(0)).toBe(true);
    });

    it('respects initial expanded state', () => {
      manager.setGroups([{ headerRow: 0, childRows: [1, 2], expanded: false }]);
      expect(manager.isExpanded(0)).toBe(false);
    });

    it('clears groups', () => {
      manager.setGroups([{ headerRow: 0, childRows: [1] }]);
      manager.clear();
      expect(manager.hasGroups()).toBe(false);
      expect(manager.isGroupHeader(0)).toBe(false);
    });

    it('replaces existing groups on setGroups', () => {
      manager.setGroups([{ headerRow: 0, childRows: [1] }]);
      manager.setGroups([{ headerRow: 5, childRows: [6, 7] }]);
      expect(manager.isGroupHeader(0)).toBe(false);
      expect(manager.isGroupHeader(5)).toBe(true);
    });

    it('throws on overlapping child rows', () => {
      expect(() => {
        manager.setGroups([
          { headerRow: 0, childRows: [1, 2, 3] },
          { headerRow: 4, childRows: [2, 5] },
        ]);
      }).toThrow('Row 2 is already a child of group 0');
    });
  });

  describe('expand/collapse', () => {
    beforeEach(() => {
      manager.setGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);
    });

    it('toggles group expansion', () => {
      expect(manager.toggleGroup(0)).toBe(false);
      expect(manager.isExpanded(0)).toBe(false);
      expect(manager.toggleGroup(0)).toBe(true);
      expect(manager.isExpanded(0)).toBe(true);
    });

    it('expands a specific group', () => {
      manager.collapseGroup(0);
      manager.expandGroup(0);
      expect(manager.isExpanded(0)).toBe(true);
    });

    it('collapses a specific group', () => {
      manager.collapseGroup(0);
      expect(manager.isExpanded(0)).toBe(false);
    });

    it('expands all groups', () => {
      manager.collapseGroup(0);
      manager.collapseGroup(4);
      manager.expandAll();
      expect(manager.isExpanded(0)).toBe(true);
      expect(manager.isExpanded(4)).toBe(true);
    });

    it('collapses all groups', () => {
      manager.collapseAll();
      expect(manager.isExpanded(0)).toBe(false);
      expect(manager.isExpanded(4)).toBe(false);
    });

    it('returns true for toggle on non-existent group', () => {
      expect(manager.toggleGroup(99)).toBe(true);
    });
  });

  describe('filterCollapsed', () => {
    beforeEach(() => {
      manager.setGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);
    });

    it('returns all indices when all groups expanded', () => {
      const indices = [0, 1, 2, 3, 4, 5, 6];
      expect(manager.filterCollapsed(indices)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('filters collapsed children', () => {
      manager.collapseGroup(0);
      const indices = [0, 1, 2, 3, 4, 5, 6];
      expect(manager.filterCollapsed(indices)).toEqual([0, 4, 5, 6]);
    });

    it('filters multiple collapsed groups', () => {
      manager.collapseAll();
      const indices = [0, 1, 2, 3, 4, 5, 6];
      expect(manager.filterCollapsed(indices)).toEqual([0, 4]);
    });

    it('works with pre-filtered indices', () => {
      manager.collapseGroup(0);
      const indices = [0, 2, 4, 6]; // some rows already filtered
      expect(manager.filterCollapsed(indices)).toEqual([0, 4, 6]);
    });

    it('returns input when no groups defined', () => {
      const noGroups = new RowGroupManager();
      const indices = [0, 1, 2];
      expect(noGroups.filterCollapsed(indices)).toBe(indices);
    });
  });

  describe('aggregates', () => {
    let cellStore: CellStore;

    beforeEach(() => {
      cellStore = new CellStore();
      manager.setCellStore(cellStore);

      // Set up data: group header at row 0, children at 1,2,3
      cellStore.setValue(1, 0, 10);
      cellStore.setValue(2, 0, 20);
      cellStore.setValue(3, 0, 30);

      cellStore.setValue(1, 1, 'alpha');
      cellStore.setValue(2, 1, 'beta');
      cellStore.setValue(3, 1, 'gamma');

      manager.setGroups([{ headerRow: 0, childRows: [1, 2, 3] }]);
    });

    it('computes sum aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'sum' }]);
      const results = manager.computeAggregates(0);
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe(60);
      expect(results[0].label).toBe('Sum: 60');
    });

    it('computes count aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'count' }]);
      const results = manager.computeAggregates(0);
      expect(results[0].value).toBe(3);
      expect(results[0].label).toBe('Count: 3');
    });

    it('computes average aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'average' }]);
      const results = manager.computeAggregates(0);
      expect(results[0].value).toBe(20);
      expect(results[0].label).toBe('Avg: 20');
    });

    it('computes min aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'min' }]);
      const results = manager.computeAggregates(0);
      expect(results[0].value).toBe(10);
    });

    it('computes max aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'max' }]);
      const results = manager.computeAggregates(0);
      expect(results[0].value).toBe(30);
    });

    it('skips non-numeric values for numeric aggregates', () => {
      manager.setAggregates([{ col: 1, fn: 'sum' }]);
      const results = manager.computeAggregates(0);
      expect(results[0].value).toBe(0);
    });

    it('returns empty for non-existent group', () => {
      manager.setAggregates([{ col: 0, fn: 'sum' }]);
      expect(manager.computeAggregates(99)).toEqual([]);
    });

    it('skips none aggregate', () => {
      manager.setAggregates([{ col: 0, fn: 'none' }]);
      expect(manager.computeAggregates(0)).toEqual([]);
    });

    it('computes multiple aggregates', () => {
      manager.setAggregates([
        { col: 0, fn: 'sum' },
        { col: 0, fn: 'count' },
      ]);
      const results = manager.computeAggregates(0);
      expect(results).toHaveLength(2);
      expect(results[0].label).toBe('Sum: 60');
      expect(results[1].label).toBe('Count: 3');
    });
  });

  describe('DataView integration', () => {
    it('hides collapsed children from DataView', () => {
      const dataView = new DataView({ totalRowCount: 7 });

      manager.setGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);

      // Collapse first group
      manager.collapseGroup(0);

      // Simulate what applyFilterAndSortToDataView does
      const allRows = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(allRows);
      dataView.recompute(visible);

      expect(dataView.visibleRowCount).toBe(4);
      expect(dataView.getPhysicalRow(0)).toBe(0); // header
      expect(dataView.getPhysicalRow(1)).toBe(4); // second group header
      expect(dataView.getPhysicalRow(2)).toBe(5); // second group child
      expect(dataView.getPhysicalRow(3)).toBe(6); // second group child
    });

    it('restores children when group is expanded', () => {
      const dataView = new DataView({ totalRowCount: 7 });

      manager.setGroups([
        { headerRow: 0, childRows: [1, 2, 3] },
        { headerRow: 4, childRows: [5, 6] },
      ]);

      manager.collapseGroup(0);
      let visible = manager.filterCollapsed([0, 1, 2, 3, 4, 5, 6]);
      dataView.recompute(visible);
      expect(dataView.visibleRowCount).toBe(4);

      manager.expandGroup(0);
      visible = manager.filterCollapsed([0, 1, 2, 3, 4, 5, 6]);
      dataView.recompute(visible);
      expect(dataView.visibleRowCount).toBe(7);
    });

    it('works with sorted/filtered indices', () => {
      manager.setGroups([{ headerRow: 0, childRows: [1, 2, 3] }]);
      manager.collapseGroup(0);

      // Simulated sorted/filtered output that still includes group children
      const sortedFiltered = [3, 0, 2, 1]; // rows in some sort order
      const result = manager.filterCollapsed(sortedFiltered);
      expect(result).toEqual([0]); // only header kept, children 1,2,3 removed
    });
  });

  describe('getGroupHeaders', () => {
    it('returns all header rows', () => {
      manager.setGroups([
        { headerRow: 0, childRows: [1] },
        { headerRow: 5, childRows: [6, 7] },
        { headerRow: 10, childRows: [11] },
      ]);
      const headers = manager.getGroupHeaders();
      expect(headers).toContain(0);
      expect(headers).toContain(5);
      expect(headers).toContain(10);
      expect(headers).toHaveLength(3);
    });
  });

  // ─── Multi-level nesting tests ──────────────────────────────

  describe('multi-level nesting', () => {
    // Structure:
    //   Row 0 (L1 header) → children: [1(L2 header), 6]
    //   Row 1 (L2 header) → children: [2(L3 header), 5]
    //   Row 2 (L3 header) → children: [3, 4]
    beforeEach(() => {
      manager.setGroups([
        { headerRow: 0, childRows: [1, 6] },
        { headerRow: 1, childRows: [2, 5] },
        { headerRow: 2, childRows: [3, 4] },
      ]);
    });

    it('reports correct nesting depth', () => {
      expect(manager.getDepth(0)).toBe(0); // top-level
      expect(manager.getDepth(1)).toBe(1); // nested once
      expect(manager.getDepth(2)).toBe(2); // nested twice
    });

    it('depth returns 0 for non-header rows', () => {
      expect(manager.getDepth(3)).toBe(3); // leaf at depth 3
      expect(manager.getDepth(99)).toBe(0); // not in any group
    });

    it('isHiddenByAncestor detects collapsed ancestors', () => {
      manager.collapseGroup(0);
      expect(manager.isHiddenByAncestor(1)).toBe(true); // direct child
      expect(manager.isHiddenByAncestor(3)).toBe(true); // deep descendant
      expect(manager.isHiddenByAncestor(0)).toBe(false); // header itself
    });

    it('isHiddenByAncestor works with intermediate collapse', () => {
      manager.collapseGroup(1); // collapse L2, keep L1 expanded
      expect(manager.isHiddenByAncestor(2)).toBe(true); // child of L2
      expect(manager.isHiddenByAncestor(3)).toBe(true); // grandchild via L2
      expect(manager.isHiddenByAncestor(1)).toBe(false); // L2 header visible
      expect(manager.isHiddenByAncestor(6)).toBe(false); // sibling of L2
    });

    it('getLeafDescendants returns only leaf rows', () => {
      const leaves0 = manager.getLeafDescendants(0);
      expect(leaves0.sort()).toEqual([3, 4, 5, 6]);

      const leaves1 = manager.getLeafDescendants(1);
      expect(leaves1.sort()).toEqual([3, 4, 5]);

      const leaves2 = manager.getLeafDescendants(2);
      expect(leaves2.sort()).toEqual([3, 4]);
    });

    it('filterCollapsed hides all descendants of collapsed parent', () => {
      manager.collapseGroup(0);
      const all = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(all);
      // Only top-level header remains
      expect(visible).toEqual([0]);
    });

    it('filterCollapsed hides nested descendants when intermediate collapsed', () => {
      manager.collapseGroup(1);
      const all = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(all);
      // L1 header + L2 header (visible but collapsed) + L1's other child
      expect(visible).toEqual([0, 1, 6]);
    });

    it('filterCollapsed handles multiple collapse levels', () => {
      manager.collapseGroup(0);
      manager.collapseGroup(2);
      const all = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(all);
      // L1 collapsed hides everything under it
      expect(visible).toEqual([0]);
    });

    it('cascading aggregates use leaf descendants', () => {
      const cellStore = new CellStore();
      manager.setCellStore(cellStore);

      // Set values on leaf rows only
      cellStore.setValue(3, 0, 10);
      cellStore.setValue(4, 0, 20);
      cellStore.setValue(5, 0, 30);
      cellStore.setValue(6, 0, 40);

      manager.setAggregates([{ col: 0, fn: 'sum' }]);

      // L3 aggregate: sum of rows 3,4 = 30
      const agg2 = manager.computeAggregates(2);
      expect(agg2[0].value).toBe(30);

      // L2 aggregate: sum of leaves 3,4,5 = 60
      const agg1 = manager.computeAggregates(1);
      expect(agg1[0].value).toBe(60);

      // L1 aggregate: sum of all leaves 3,4,5,6 = 100
      const agg0 = manager.computeAggregates(0);
      expect(agg0[0].value).toBe(100);
    });

    it('cascading count uses leaf row count', () => {
      const cellStore = new CellStore();
      manager.setCellStore(cellStore);
      manager.setAggregates([{ col: 0, fn: 'count' }]);

      expect(manager.computeAggregates(0)[0].value).toBe(4); // 4 leaf rows
      expect(manager.computeAggregates(1)[0].value).toBe(3); // 3 leaf rows
      expect(manager.computeAggregates(2)[0].value).toBe(2); // 2 leaf rows
    });

    it('nested expand/collapse state is independent', () => {
      manager.collapseGroup(2); // collapse L3
      expect(manager.isExpanded(0)).toBe(true);
      expect(manager.isExpanded(1)).toBe(true);
      expect(manager.isExpanded(2)).toBe(false);

      const all = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(all);
      expect(visible).toEqual([0, 1, 2, 5, 6]); // rows 3,4 hidden
    });

    it('expandAll expands all nesting levels', () => {
      manager.collapseAll();
      manager.expandAll();
      const all = [0, 1, 2, 3, 4, 5, 6];
      expect(manager.filterCollapsed(all)).toEqual(all);
    });

    it('collapseAll collapses all nesting levels', () => {
      manager.collapseAll();
      const all = [0, 1, 2, 3, 4, 5, 6];
      const visible = manager.filterCollapsed(all);
      expect(visible).toEqual([0]); // only top-level header
    });
  });

  describe('multi-level DataView integration', () => {
    it('3-level nesting works with DataView', () => {
      const dataView = new DataView({ totalRowCount: 10 });

      manager.setGroups([
        { headerRow: 0, childRows: [1, 7] },
        { headerRow: 1, childRows: [2, 6] },
        { headerRow: 2, childRows: [3, 4, 5] },
      ]);

      // Collapse L2 (row 1)
      manager.collapseGroup(1);
      const all = [0, 1, 2, 3, 4, 5, 6, 7];
      const visible = manager.filterCollapsed(all);
      dataView.recompute(visible);

      expect(dataView.visibleRowCount).toBe(3); // rows 0, 1, 7
      expect(dataView.getPhysicalRow(0)).toBe(0);
      expect(dataView.getPhysicalRow(1)).toBe(1);
      expect(dataView.getPhysicalRow(2)).toBe(7);
    });

    it('collapse top-level hides entire subtree in DataView', () => {
      const dataView = new DataView({ totalRowCount: 10 });

      manager.setGroups([
        { headerRow: 0, childRows: [1, 7] },
        { headerRow: 1, childRows: [2, 6] },
        { headerRow: 2, childRows: [3, 4, 5] },
      ]);

      manager.collapseGroup(0);
      const all = [0, 1, 2, 3, 4, 5, 6, 7];
      const visible = manager.filterCollapsed(all);
      dataView.recompute(visible);

      expect(dataView.visibleRowCount).toBe(1); // only row 0
      expect(dataView.getPhysicalRow(0)).toBe(0);
    });
  });
});
