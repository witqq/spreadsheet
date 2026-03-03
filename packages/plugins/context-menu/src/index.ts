// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Context Menu Plugin — wraps the built-in ContextMenuManager as a SpreadsheetPlugin.
 *
 * Provides a registration API for other plugins to add custom menu items.
 */

import type { SpreadsheetPlugin, PluginAPI } from '@witqq/spreadsheet';
import type { ContextMenuItem } from '@witqq/spreadsheet';

export const CONTEXT_MENU_PLUGIN_NAME = 'context-menu';

export interface ContextMenuPluginState {
  registeredItems: string[];
}

/**
 * Create a context menu plugin instance.
 *
 * @param items - Optional initial menu items to register on install.
 */
export function createContextMenuPlugin(
  items?: ContextMenuItem[],
): SpreadsheetPlugin {
  let api: PluginAPI | null = null;
  const pendingItems = items ? [...items] : [];

  return {
    name: CONTEXT_MENU_PLUGIN_NAME,
    version: '1.0.0',

    install(pluginApi: PluginAPI): void {
      api = pluginApi;
      const state: ContextMenuPluginState = { registeredItems: [] };

      // Register any items passed at construction time
      for (const item of pendingItems) {
        api.engine.registerContextMenuItem(item);
        state.registeredItems.push(item.id);
      }

      api.setPluginState<ContextMenuPluginState>('state', state);
    },

    destroy(): void {
      if (!api) return;
      const state = api.getPluginState<ContextMenuPluginState>('state');
      if (state) {
        for (const id of state.registeredItems) {
          api.engine.unregisterContextMenuItem(id);
        }
      }
      api = null;
    },
  };
}

/**
 * Register an additional menu item via the plugin API.
 * The plugin must already be installed.
 */
export function registerMenuItem(
  api: PluginAPI,
  item: ContextMenuItem,
): void {
  const state = api.getPluginState<ContextMenuPluginState>('state');
  if (!state) {
    throw new Error('Context menu plugin is not installed');
  }
  api.engine.registerContextMenuItem(item);
  state.registeredItems.push(item.id);
}

/**
 * Unregister a menu item via the plugin API.
 */
export function unregisterMenuItem(
  api: PluginAPI,
  itemId: string,
): void {
  const state = api.getPluginState<ContextMenuPluginState>('state');
  if (!state) {
    throw new Error('Context menu plugin is not installed');
  }
  api.engine.unregisterContextMenuItem(itemId);
  state.registeredItems = state.registeredItems.filter((id) => id !== itemId);
}
