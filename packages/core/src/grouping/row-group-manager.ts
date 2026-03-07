// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RowGroupManager — manages row grouping with expand/collapse and aggregates.
 *
 * Supports multi-level nesting: a group's child can itself be a group header.
 * When collapsed, all descendants (not just direct children) are hidden.
 * Aggregate values cascade: inner group aggregates feed into outer group aggregates.
 *
 * Operates on physical row indices. DataView integration filters out
 * collapsed descendants from visible indices.
 */

import type { CellStore } from '../model/cell-store';
import type { ResolvedLocale } from '../locale/resolve-locale';

/** Aggregate function types for group headers. */
export type AggregateFunction = 'sum' | 'count' | 'average' | 'min' | 'max' | 'none';

/** Column aggregate configuration. */
export interface ColumnAggregate {
  col: number;
  fn: AggregateFunction;
}

/** Definition of a single row group. */
export interface RowGroupDef {
  /** Physical row index of the group header. */
  headerRow: number;
  /** Physical row indices of child rows (direct children only). */
  childRows: number[];
  /** Whether the group is expanded (children visible). Default: true. */
  expanded?: boolean;
}

/** Internal group state. */
interface RowGroupState {
  headerRow: number;
  childRows: number[];
  expanded: boolean;
}

/** Aggregate result for a group header cell. */
export interface AggregateResult {
  row: number;
  col: number;
  value: number | string;
  label: string;
}

export class RowGroupManager {
  private groups: Map<number, RowGroupState> = new Map();
  private childToParent: Map<number, number> = new Map();
  private aggregates: ColumnAggregate[] = [];
  private cellStore: CellStore | null = null;
  private locale: ResolvedLocale | null = null;

  /** Set the CellStore reference for aggregate computation. */
  setCellStore(cellStore: CellStore): void {
    this.cellStore = cellStore;
  }

  /** Set locale for aggregate labels. */
  setLocale(locale: ResolvedLocale): void {
    this.locale = locale;
  }

  /** Configure aggregate functions for columns. */
  setAggregates(aggregates: ColumnAggregate[]): void {
    this.aggregates = aggregates;
  }

  /** Get current aggregate configuration. */
  getAggregates(): readonly ColumnAggregate[] {
    return this.aggregates;
  }

  /** Define row groups. Replaces all existing groups. */
  setGroups(groups: RowGroupDef[]): void {
    this.groups.clear();
    this.childToParent.clear();

    for (const def of groups) {
      for (const child of def.childRows) {
        if (this.childToParent.has(child)) {
          throw new Error(
            `Row ${child} is already a child of group ${this.childToParent.get(child)}, ` +
              `cannot also be a child of group ${def.headerRow}`,
          );
        }
      }
      const state: RowGroupState = {
        headerRow: def.headerRow,
        childRows: [...def.childRows],
        expanded: def.expanded ?? true,
      };
      this.groups.set(def.headerRow, state);
      for (const child of def.childRows) {
        this.childToParent.set(child, def.headerRow);
      }
    }
  }

  /** Check if any groups are defined. */
  hasGroups(): boolean {
    return this.groups.size > 0;
  }

  /** Get group state for a header row. */
  getGroup(headerRow: number): RowGroupState | undefined {
    return this.groups.get(headerRow);
  }

  /** Check if a physical row is a group header. */
  isGroupHeader(physicalRow: number): boolean {
    return this.groups.has(physicalRow);
  }

  /** Check if a physical row is a child of any group. */
  isGroupChild(physicalRow: number): boolean {
    return this.childToParent.has(physicalRow);
  }

  /** Get parent header row for a child row. */
  getParentHeader(physicalRow: number): number | undefined {
    return this.childToParent.get(physicalRow);
  }

  /**
   * Get nesting depth of a group header. Top-level = 0, nested once = 1, etc.
   * Non-header rows return 0.
   */
  getDepth(headerRow: number): number {
    let depth = 0;
    let current = headerRow;
    while (this.childToParent.has(current)) {
      depth++;
      current = this.childToParent.get(current)!;
    }
    return depth;
  }

  /** Check if a group is expanded. */
  isExpanded(headerRow: number): boolean {
    return this.groups.get(headerRow)?.expanded ?? true;
  }

  /**
   * Check if a row is effectively hidden due to any ancestor being collapsed.
   * A row is hidden if any of its ancestor groups is collapsed.
   */
  isHiddenByAncestor(physicalRow: number): boolean {
    let current = this.childToParent.get(physicalRow);
    while (current !== undefined) {
      if (!this.isExpanded(current)) return true;
      current = this.childToParent.get(current);
    }
    return false;
  }

  /** Toggle expand/collapse for a group. Returns new expanded state. */
  toggleGroup(headerRow: number): boolean {
    const group = this.groups.get(headerRow);
    if (!group) return true;
    group.expanded = !group.expanded;
    return group.expanded;
  }

  /** Expand a specific group. */
  expandGroup(headerRow: number): void {
    const group = this.groups.get(headerRow);
    if (group) group.expanded = true;
  }

  /** Collapse a specific group. */
  collapseGroup(headerRow: number): void {
    const group = this.groups.get(headerRow);
    if (group) group.expanded = false;
  }

  /** Expand all groups. */
  expandAll(): void {
    for (const group of this.groups.values()) {
      group.expanded = true;
    }
  }

  /** Collapse all groups. */
  collapseAll(): void {
    for (const group of this.groups.values()) {
      group.expanded = false;
    }
  }

  /** Get all group header rows. */
  getGroupHeaders(): number[] {
    return Array.from(this.groups.keys());
  }

  /** Get all groups. */
  getAllGroups(): ReadonlyMap<number, RowGroupState> {
    return this.groups;
  }

  /**
   * Get all leaf (non-header) descendants of a group header, recursively.
   * For cascading aggregates: inner group headers are skipped,
   * only actual data rows are returned.
   */
  getLeafDescendants(headerRow: number): number[] {
    const group = this.groups.get(headerRow);
    if (!group) return [];
    const leaves: number[] = [];
    for (const child of group.childRows) {
      if (this.groups.has(child)) {
        // Child is itself a group header — recurse into it
        leaves.push(...this.getLeafDescendants(child));
      } else {
        leaves.push(child);
      }
    }
    return leaves;
  }

  /**
   * Filter physical indices to exclude collapsed descendants.
   * Recursively hides children of collapsed groups, including nested groups.
   */
  filterCollapsed(physicalIndices: number[]): number[] {
    if (this.groups.size === 0) return physicalIndices;

    // Build set of all rows hidden by collapsed ancestors
    const hidden = new Set<number>();
    for (const group of this.groups.values()) {
      if (!group.expanded) {
        this.collectAllDescendants(group.headerRow, hidden);
      }
    }

    if (hidden.size === 0) return physicalIndices;

    return physicalIndices.filter((physRow) => !hidden.has(physRow));
  }

  /** Recursively collect all descendants of a group header into the set. */
  private collectAllDescendants(headerRow: number, result: Set<number>): void {
    const group = this.groups.get(headerRow);
    if (!group) return;
    for (const child of group.childRows) {
      result.add(child);
      // If child is itself a group header, collect its descendants too
      if (this.groups.has(child)) {
        this.collectAllDescendants(child, result);
      }
    }
  }

  /**
   * Compute aggregate values for a group header row.
   * Uses cascading aggregates: leaf descendants (not sub-group headers) provide values.
   */
  computeAggregates(headerRow: number): AggregateResult[] {
    const group = this.groups.get(headerRow);
    if (!group || !this.cellStore || this.aggregates.length === 0) return [];

    // Get all leaf descendants for cascading aggregates
    const leafRows = this.getLeafDescendants(headerRow);
    const results: AggregateResult[] = [];

    for (const agg of this.aggregates) {
      if (agg.fn === 'none') continue;

      const values: number[] = [];
      for (const childRow of leafRows) {
        const cell = this.cellStore.get(childRow, agg.col);
        const v = cell?.value;
        if (v !== null && v !== undefined && v !== '') {
          const num = Number(v);
          if (!isNaN(num)) values.push(num);
        }
      }

      let value: number | string;
      let label: string;

      switch (agg.fn) {
        case 'sum':
          value = values.reduce((s, v) => s + v, 0);
          label = `${this.locale?.grouping?.sum ?? 'Sum'}: ${value}`;
          break;
        case 'count':
          value = leafRows.length;
          label = `${this.locale?.grouping?.count ?? 'Count'}: ${value}`;
          break;
        case 'average':
          value = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          label = `${this.locale?.grouping?.avg ?? 'Avg'}: ${Math.round(value * 100) / 100}`;
          break;
        case 'min':
          value = values.length > 0 ? Math.min(...values) : 0;
          label = `${this.locale?.grouping?.min ?? 'Min'}: ${value}`;
          break;
        case 'max':
          value = values.length > 0 ? Math.max(...values) : 0;
          label = `${this.locale?.grouping?.max ?? 'Max'}: ${value}`;
          break;
      }

      results.push({ row: headerRow, col: agg.col, value, label });
    }

    return results;
  }

  /** Clear all groups. */
  clear(): void {
    this.groups.clear();
    this.childToParent.clear();
  }
}
