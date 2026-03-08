// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * OT Transformation Engine
 *
 * Implements transformation functions for all 9 pairs of operation types:
 * (setCellValue, insertRow, deleteRow) × (setCellValue, insertRow, deleteRow)
 *
 * Convention: transform(opA, opB) returns [opA', opB'] where:
 * - opA' is opA transformed against opB (apply opA' after opB)
 * - opB' is opB transformed against opA (apply opB' after opA)
 *
 * Invariant: apply(apply(state, opA), opB') === apply(apply(state, opB), opA')
 */

import type { OTOperation, SetCellValueOp, InsertRowOp, DeleteRowOp } from './ot-types';

export type TransformResult = [OTOperation | null, OTOperation | null];

/**
 * Transform opA against opB, returning [opA', opB'].
 * null means the operation becomes a no-op.
 */
export function transform(opA: OTOperation, opB: OTOperation): TransformResult {
  const key = `${opA.type}:${opB.type}` as const;

  switch (key) {
    case 'setCellValue:setCellValue':
      return transformSetSet(opA as SetCellValueOp, opB as SetCellValueOp);
    case 'setCellValue:insertRow':
      return transformSetInsert(opA as SetCellValueOp, opB as InsertRowOp);
    case 'setCellValue:deleteRow':
      return transformSetDelete(opA as SetCellValueOp, opB as DeleteRowOp);
    case 'insertRow:setCellValue':
      return swap(transformSetInsert(opB as SetCellValueOp, opA as InsertRowOp));
    case 'insertRow:insertRow':
      return transformInsertInsert(opA as InsertRowOp, opB as InsertRowOp);
    case 'insertRow:deleteRow':
      return transformInsertDelete(opA as InsertRowOp, opB as DeleteRowOp);
    case 'deleteRow:setCellValue':
      return swap(transformSetDelete(opB as SetCellValueOp, opA as DeleteRowOp));
    case 'deleteRow:insertRow':
      return swap(transformInsertDelete(opB as InsertRowOp, opA as DeleteRowOp));
    case 'deleteRow:deleteRow':
      return transformDeleteDelete(opA as DeleteRowOp, opB as DeleteRowOp);
    default:
      return [opA, opB];
  }
}

function swap(result: TransformResult): TransformResult {
  return [result[1], result[0]];
}

// ─── setCellValue × setCellValue ────────────────────────

function transformSetSet(a: SetCellValueOp, b: SetCellValueOp): TransformResult {
  if (a.row === b.row && a.col === b.col) {
    // Both edit the same cell — last-writer-wins (opB wins as "server" op)
    // opA becomes no-op, opB stays
    return [null, { ...b, oldValue: a.value }];
  }
  // Different cells — no conflict
  return [a, b];
}

// ─── setCellValue × insertRow ───────────────────────────

function transformSetInsert(set: SetCellValueOp, ins: InsertRowOp): TransformResult {
  if (set.row >= ins.row) {
    // Cell shifted down by insert
    return [{ ...set, row: set.row + ins.count }, ins];
  }
  return [set, ins];
}

// ─── setCellValue × deleteRow ───────────────────────────

function transformSetDelete(set: SetCellValueOp, del: DeleteRowOp): TransformResult {
  if (set.row >= del.row && set.row < del.row + del.count) {
    // Cell is in deleted range — set becomes no-op
    return [null, del];
  }
  if (set.row >= del.row + del.count) {
    // Cell shifted up by delete
    return [{ ...set, row: set.row - del.count }, del];
  }
  return [set, del];
}

// ─── insertRow × insertRow ──────────────────────────────

function transformInsertInsert(a: InsertRowOp, b: InsertRowOp): TransformResult {
  if (a.row <= b.row) {
    // A inserts before or at B's position — B shifts down
    return [a, { ...b, row: b.row + a.count }];
  }
  // B inserts before A — A shifts down
  return [{ ...a, row: a.row + b.count }, b];
}

// ─── insertRow × deleteRow ──────────────────────────────

function transformInsertDelete(ins: InsertRowOp, del: DeleteRowOp): TransformResult {
  if (ins.row <= del.row) {
    // Insert before delete range — delete shifts down
    return [ins, { ...del, row: del.row + ins.count }];
  }
  if (ins.row >= del.row + del.count) {
    // Insert after delete range — insert shifts up
    return [{ ...ins, row: ins.row - del.count }, del];
  }
  // Insert inside delete range — insert at delete start
  return [{ ...ins, row: del.row }, del];
}

// ─── deleteRow × deleteRow ──────────────────────────────

function transformDeleteDelete(a: DeleteRowOp, b: DeleteRowOp): TransformResult {
  const aEnd = a.row + a.count;
  const bEnd = b.row + b.count;

  // No overlap
  if (aEnd <= b.row) {
    return [a, { ...b, row: b.row - a.count }];
  }
  if (bEnd <= a.row) {
    return [{ ...a, row: a.row - b.count }, b];
  }

  // Overlap — compute remaining deletions
  const overlapStart = Math.max(a.row, b.row);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlapCount = overlapEnd - overlapStart;

  const aRemaining = a.count - overlapCount;
  const bRemaining = b.count - overlapCount;

  const aPrime: DeleteRowOp | null =
    aRemaining > 0
      ? { type: 'deleteRow', row: a.row < b.row ? a.row : b.row, count: aRemaining }
      : null;

  const bPrime: DeleteRowOp | null =
    bRemaining > 0
      ? { type: 'deleteRow', row: b.row < a.row ? b.row : a.row, count: bRemaining }
      : null;

  // Adjust positions for the overlap
  if (aPrime && bRemaining > 0 && a.row > b.row) {
    aPrime.row = b.row;
  }
  if (bPrime && aRemaining > 0 && b.row > a.row) {
    bPrime.row = a.row;
  }

  return [aPrime, bPrime];
}

/**
 * Transform a local operation against a list of server operations.
 * Returns the transformed local operation (or null if it became a no-op).
 */
export function transformAgainstAll(
  localOp: OTOperation,
  serverOps: OTOperation[],
): OTOperation | null {
  let current: OTOperation | null = localOp;

  for (const serverOp of serverOps) {
    if (!current) return null;
    const [transformed] = transform(current, serverOp);
    current = transformed;
  }

  return current;
}
