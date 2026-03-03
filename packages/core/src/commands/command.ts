// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Command interface for the undo/redo system.
 *
 * Every data-modifying operation implements this interface.
 * Commands are executed via CommandManager which tracks history.
 */
export interface Command {
  /** Apply the operation. */
  execute(): void;
  /** Reverse the operation (restore previous state). */
  undo(): void;
  /** Human-readable description of the operation. */
  readonly description: string;
}
