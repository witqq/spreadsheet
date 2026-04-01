// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * EventBus — typed pub/sub for spreadsheet events.
 *
 * Supports both public events (cellClick, selectionChange, etc.)
 * and internal grid events (gridMouseDown, gridKeyDown, etc.).
 */

import type { SpreadsheetEvents } from './event-types';

type EventHandler = (...args: unknown[]) => void;

export class EventBus {
  private readonly listeners = new Map<string, Set<EventHandler>>();

  /** Register a handler for a typed event. */
  on<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void;
  /** Register a handler for a dynamic event name (framework wrappers). */
  on(event: string, handler: EventHandler): void;
  on(event: string, handler: EventHandler): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  /** Remove a handler for a typed event. */
  off<K extends keyof SpreadsheetEvents>(event: K, handler: SpreadsheetEvents[K]): void;
  /** Remove a handler for a dynamic event name (framework wrappers). */
  off(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /** Dispatch an event to all registered handlers. */
  emit<K extends keyof SpreadsheetEvents>(
    event: K,
    ...args: Parameters<SpreadsheetEvents[K]>
  ): void;
  /** Dispatch a dynamic event (plugin-defined custom events). */
  emit(event: string, ...args: unknown[]): void;
  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(...args);
    }
  }

  /** Remove all handlers and clear the bus. */
  destroy(): void {
    this.listeners.clear();
  }
}
