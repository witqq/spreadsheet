// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * OT Operation types for spreadsheet collaboration.
 *
 * Three operation types that cover cell editing and row manipulation.
 */

export type OTOperation = SetCellValueOp | InsertRowOp | DeleteRowOp;

export interface SetCellValueOp {
  type: 'setCellValue';
  row: number;
  col: number;
  value: unknown;
  oldValue?: unknown;
}

export interface InsertRowOp {
  type: 'insertRow';
  row: number;
  count: number;
}

export interface DeleteRowOp {
  type: 'deleteRow';
  row: number;
  count: number;
}

/**
 * A versioned operation with client metadata.
 */
export interface VersionedOperation {
  /** Client-unique ID */
  clientId: string;
  /** Server-assigned sequence number (-1 for local pending) */
  revision: number;
  /** The operation */
  op: OTOperation;
}
