// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Dependency Graph — tracks cell-to-cell dependencies for formula recalculation.
 *
 * Provides topological sort for recalculation order and circular reference detection.
 * Cells are identified by "row:col" string keys.
 */

import { type ASTNode } from './parser';

/** Create a canonical key for a cell position. */
export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Parse a cell key back to row/col. */
export function parseCellKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(':');
  return { row: parseInt(r, 10), col: parseInt(c, 10) };
}

/**
 * Extract all cell references from an AST node (for dependency tracking).
 * Returns an array of cell keys that the formula depends on.
 */
export function extractDependencies(node: ASTNode): string[] {
  const deps: string[] = [];

  function walk(n: ASTNode): void {
    switch (n.type) {
      case 'CellRef':
        if (n.row >= 0 && n.col >= 0) {
          deps.push(cellKey(n.row, n.col));
        }
        break;

      case 'Range': {
        const startRow = Math.min(n.start.row, n.end.row);
        const endRow = Math.max(n.start.row, n.end.row);
        const startCol = Math.min(n.start.col, n.end.col);
        const endCol = Math.max(n.start.col, n.end.col);
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            deps.push(cellKey(r, c));
          }
        }
        break;
      }

      case 'BinaryOp':
        walk(n.left);
        walk(n.right);
        break;

      case 'UnaryOp':
        walk(n.operand);
        break;

      case 'Percent':
        walk(n.operand);
        break;

      case 'FunctionCall':
        for (const arg of n.args) {
          walk(arg);
        }
        break;

      // Leaf nodes with no dependencies
      case 'Number':
      case 'String':
      case 'Boolean':
      case 'Error':
        break;
    }
  }

  walk(node);
  return deps;
}

export class DependencyGraph {
  /** cell → set of cells it depends on (its formula references) */
  private readonly dependsOn = new Map<string, Set<string>>();

  /** cell → set of cells that depend on it (reverse index) */
  private readonly dependedBy = new Map<string, Set<string>>();

  /**
   * Set the dependencies for a formula cell.
   * Replaces any previous dependencies for this cell.
   * Returns true if no circular reference detected, false if circular.
   */
  setDependencies(cell: string, deps: string[]): boolean {
    // Check for circular reference before committing
    if (this.wouldCreateCycle(cell, deps)) {
      return false;
    }

    // Remove old dependencies
    this.removeDependencies(cell);

    // Set new dependencies
    const depSet = new Set(deps);
    this.dependsOn.set(cell, depSet);

    // Update reverse index
    for (const dep of depSet) {
      let set = this.dependedBy.get(dep);
      if (!set) {
        set = new Set();
        this.dependedBy.set(dep, set);
      }
      set.add(cell);
    }

    return true;
  }

  /** Remove all dependencies for a cell (e.g., when formula is deleted). */
  removeDependencies(cell: string): void {
    const oldDeps = this.dependsOn.get(cell);
    if (oldDeps) {
      for (const dep of oldDeps) {
        const set = this.dependedBy.get(dep);
        if (set) {
          set.delete(cell);
          if (set.size === 0) {
            this.dependedBy.delete(dep);
          }
        }
      }
      this.dependsOn.delete(cell);
    }
  }

  /**
   * Get all cells that need recalculation when the given cells change,
   * in correct topological order (dependencies first).
   */
  getRecalcOrder(changedCells: string[]): string[] {
    // Collect all affected cells (transitive dependents)
    const affected = new Set<string>();
    const queue = [...changedCells];

    while (queue.length > 0) {
      const cell = queue.pop()!;
      const dependents = this.dependedBy.get(cell);
      if (dependents) {
        for (const dep of dependents) {
          if (!affected.has(dep)) {
            affected.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    if (affected.size === 0) return [];

    // Topological sort using Kahn's algorithm
    // Build in-degree count for affected cells only
    const inDegree = new Map<string, number>();
    for (const cell of affected) {
      inDegree.set(cell, 0);
    }

    for (const cell of affected) {
      const deps = this.dependsOn.get(cell);
      if (deps) {
        for (const dep of deps) {
          if (affected.has(dep)) {
            inDegree.set(cell, (inDegree.get(cell) ?? 0) + 1);
          }
        }
      }
    }

    // Start with cells that have no affected dependencies
    const ready: string[] = [];
    for (const [cell, degree] of inDegree) {
      if (degree === 0) ready.push(cell);
    }

    const order: string[] = [];
    while (ready.length > 0) {
      const cell = ready.pop()!;
      order.push(cell);

      const dependents = this.dependedBy.get(cell);
      if (dependents) {
        for (const dep of dependents) {
          if (affected.has(dep)) {
            const newDegree = (inDegree.get(dep) ?? 0) - 1;
            inDegree.set(dep, newDegree);
            if (newDegree === 0) ready.push(dep);
          }
        }
      }
    }

    return order;
  }

  /** Get direct dependents of a cell (cells whose formulas reference this cell). */
  getDirectDependents(cell: string): string[] {
    const set = this.dependedBy.get(cell);
    return set ? [...set] : [];
  }

  /** Get direct dependencies of a cell (cells referenced by this cell's formula). */
  getDirectDependencies(cell: string): string[] {
    const set = this.dependsOn.get(cell);
    return set ? [...set] : [];
  }

  /** Check if a cell has any dependents. */
  hasDependents(cell: string): boolean {
    const set = this.dependedBy.get(cell);
    return set !== undefined && set.size > 0;
  }

  /** Clear all tracking data. */
  clear(): void {
    this.dependsOn.clear();
    this.dependedBy.clear();
  }

  /**
   * Check if setting these dependencies for cell would create a cycle.
   * Uses DFS from each dependency back through the graph.
   */
  private wouldCreateCycle(cell: string, deps: string[]): boolean {
    // If cell depends on itself directly
    if (deps.includes(cell)) return true;

    // DFS: can we reach `cell` from any of its new deps?
    const visited = new Set<string>();

    function dfs(current: string, dependedBy: Map<string, Set<string>>): boolean {
      if (current === cell) return true;
      if (visited.has(current)) return false;
      visited.add(current);

      // Follow the "depends on" chain from current
      // We need to check: if we go FROM deps through THEIR deps, can we reach cell?
      const nextDeps = dependedBy.get(current);
      if (nextDeps) {
        for (const next of nextDeps) {
          if (dfs(next, dependedBy)) return true;
        }
      }
      return false;
    }

    // We want to check: can any of `deps` reach `cell` through the dependedBy graph?
    // Actually, we need to check: if cell depends on deps, and some dep transitively depends on cell
    // That means: from cell's new deps, follow THEIR dependsOn chains to see if we reach cell
    const visited2 = new Set<string>();

    const canReachCell = (current: string): boolean => {
      if (current === cell) return true;
      if (visited2.has(current)) return false;
      visited2.add(current);

      const currentDeps = this.dependsOn.get(current);
      if (currentDeps) {
        for (const dep of currentDeps) {
          if (canReachCell(dep)) return true;
        }
      }
      return false;
    };

    for (const dep of deps) {
      if (canReachCell(dep)) return true;
    }

    return false;
  }
}
