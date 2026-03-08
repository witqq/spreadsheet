/**
 * @witqq/spreadsheet-widget — Embeddable spreadsheet widget
 *
 * Single-file IIFE/UMD bundle for embedding in any web page.
 * No framework dependencies, no build step required.
 *
 * Usage:
 *   <script src="witqq-spreadsheet-widget.js"></script>
 *   <script>
 *     Spreadsheet.create(document.getElementById('grid'), {
 *       columns: [{ key: 'name', title: 'Name', width: 200 }],
 *       data: [{ name: 'Alice' }],
 *     });
 *   </script>
 */

import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { SpreadsheetEngineConfig } from '@witqq/spreadsheet';
import { lightTheme, darkTheme } from '@witqq/spreadsheet';

export interface WidgetConfig extends SpreadsheetEngineConfig {
  /** Auto-mount immediately (default: true) */
  autoMount?: boolean;
}

/**
 * Create a Spreadsheet spreadsheet inside the given container.
 *
 * @param container - DOM element or CSS selector string
 * @param config - Engine configuration (columns required)
 * @returns The SpreadsheetEngine instance for programmatic access
 */
export function create(container: HTMLElement | string, config: WidgetConfig): SpreadsheetEngine {
  const el =
    typeof container === 'string' ? document.querySelector<HTMLElement>(container) : container;

  if (!el) {
    throw new Error(
      `Spreadsheet.create: container not found${typeof container === 'string' ? ` ("${container}")` : ''}`,
    );
  }

  const { autoMount = true, ...engineConfig } = config;

  const engine = new SpreadsheetEngine(engineConfig);

  if (autoMount) {
    engine.mount(el);
  }

  return engine;
}

/**
 * Convenience: create and return a handle with destroy().
 */
export function embed(
  container: HTMLElement | string,
  config: WidgetConfig,
): { engine: SpreadsheetEngine; destroy: () => void } {
  const engine = create(container, config);
  return {
    engine,
    destroy: () => engine.destroy(),
  };
}

// Re-export core types needed by widget consumers
export { SpreadsheetEngine, lightTheme, darkTheme };
export type { SpreadsheetEngineConfig };
export type { ColumnDef, CellData, CellValue, Selection, CellAddress } from '@witqq/spreadsheet';
