// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { SpreadsheetEngine } from '../engine/spreadsheet-engine';

/**
 * Plugin contract for extending witqq spreadsheet functionality.
 *
 * Plugins are installed via `engine.installPlugin(plugin)` and receive
 * a {@link PluginAPI} handle for interacting with the engine.
 */
export interface SpreadsheetPlugin {
  /** Unique plugin name (used for dependency resolution and lookup). */
  readonly name: string;
  /** Semantic version string. */
  readonly version: string;
  /** Names of plugins that must be installed before this one. */
  readonly dependencies?: string[];
  /** Called when the plugin is installed. Use `api` to register event handlers, layers, etc. */
  install(api: PluginAPI): void;
  /** Called when the plugin is removed. Clean up event handlers and DOM elements. */
  destroy?(): void;
}

/**
 * API surface available to plugins during {@link SpreadsheetPlugin.install}.
 *
 * Provides engine access and isolated key-value state storage per plugin.
 */
export interface PluginAPI {
  /** Reference to the host engine instance. */
  readonly engine: SpreadsheetEngine;
  /** Retrieve plugin-scoped state by key. */
  getPluginState<T>(key: string): T | undefined;
  /** Store plugin-scoped state by key. */
  setPluginState<T>(key: string, value: T): void;
}
