// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { Command } from './command';

export type CommandCallback = (command: Command) => void;

export interface CommandManagerConfig {
  /** Maximum number of undo steps. Default: 100. */
  historyLimit?: number;
  /** Called after a command is executed. */
  onAfterExecute?: CommandCallback;
  /** Called after a command is undone. */
  onAfterUndo?: CommandCallback;
  /** Called after a command is redone. */
  onAfterRedo?: CommandCallback;
}

/**
 * Manages command execution with undo/redo stacks.
 *
 * - execute() pushes to undo stack, clears redo stack
 * - undo() pops from undo, pushes to redo
 * - redo() pops from redo, pushes to undo
 * - History is bounded by historyLimit (oldest commands are discarded)
 */
export class CommandManager {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private readonly historyLimit: number;
  private readonly onAfterExecute?: CommandCallback;
  private readonly onAfterUndo?: CommandCallback;
  private readonly onAfterRedo?: CommandCallback;

  constructor(config?: CommandManagerConfig) {
    this.historyLimit = config?.historyLimit ?? 100;
    this.onAfterExecute = config?.onAfterExecute;
    this.onAfterUndo = config?.onAfterUndo;
    this.onAfterRedo = config?.onAfterRedo;
  }

  /** Execute a command and push it to the undo stack. Clears redo stack. */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;

    // Enforce history limit
    if (this.undoStack.length > this.historyLimit) {
      this.undoStack.shift();
    }

    this.onAfterExecute?.(command);
  }

  /** Undo the last command. Returns the undone command, or undefined if stack is empty. */
  undo(): Command | undefined {
    const command = this.undoStack.pop();
    if (!command) return undefined;
    command.undo();
    this.redoStack.push(command);
    this.onAfterUndo?.(command);
    return command;
  }

  /** Redo the last undone command. Returns the redone command, or undefined if stack is empty. */
  redo(): Command | undefined {
    const command = this.redoStack.pop();
    if (!command) return undefined;
    command.execute();
    this.undoStack.push(command);
    this.onAfterRedo?.(command);
    return command;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Clear both undo and redo stacks. */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
