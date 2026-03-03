// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ConditionalFormattingPlugin — SpreadsheetPlugin for conditional formatting.
 *
 * Manages rules and renders conditional backgrounds/data bars/icons
 * via a custom render layer using destination-over compositing.
 */

import type { SpreadsheetPlugin, PluginAPI, ConditionalFormatRule, ConditionalFormatCondition, CellRange } from '@witqq/spreadsheet';
import { ConditionalFormatLayer } from './conditional-format-layer';

export const CONDITIONAL_FORMAT_PLUGIN_NAME = 'conditional-format';

// Built-in icon set definitions
const ICON_SETS = {
  arrows: [
    { value: 67, icon: '▲' },
    { value: 33, icon: '▶' },
    { value: 0, icon: '▼' },
  ],
  circles: [
    { value: 67, icon: '🟢' },
    { value: 33, icon: '🟡' },
    { value: 0, icon: '🔴' },
  ],
  flags: [
    { value: 67, icon: '🟩' },
    { value: 33, icon: '🟨' },
    { value: 0, icon: '🟥' },
  ],
  stars: [
    { value: 80, icon: '★★★' },
    { value: 60, icon: '★★☆' },
    { value: 40, icon: '★☆☆' },
    { value: 0, icon: '☆☆☆' },
  ],
} as const;

export { ICON_SETS };

let ruleIdCounter = 0;

export class ConditionalFormattingPlugin implements SpreadsheetPlugin {
  readonly name = CONDITIONAL_FORMAT_PLUGIN_NAME;
  readonly version = '1.0.0';

  private api: PluginAPI | null = null;
  private layer: ConditionalFormatLayer | null = null;
  private rules: ConditionalFormatRule[] = [];
  private requestRender: (() => void) | null = null;

  install(api: PluginAPI): void {
    this.api = api;
    const engine = api.engine;

    const cellStore = engine.getCellStore();
    const dataView = engine.getDataView();

    this.layer = new ConditionalFormatLayer(cellStore, dataView);

    // Append layer — it uses destination-over compositing to always paint behind text
    engine.addRenderLayer(this.layer, 'content');

    // Store requestRender for triggering re-renders on rule changes
    this.requestRender = () => engine.requestRender();

    // Apply any rules that were added before install
    if (this.rules.length > 0) {
      this.layer.setRules(this.rules);
    }
  }

  destroy(): void {
    if (this.layer && this.api) {
      this.api.engine.removeRenderLayer(this.layer);
    }
    this.api = null;
    this.layer = null;
    this.requestRender = null;
  }

  addRule(rule: ConditionalFormatRule): void {
    this.rules.push(rule);
    this.syncRules();
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    this.syncRules();
  }

  clearRules(): void {
    this.rules = [];
    this.syncRules();
  }

  getRules(): readonly ConditionalFormatRule[] {
    return this.rules;
  }

  getLayer(): ConditionalFormatLayer | null {
    return this.layer;
  }

  private syncRules(): void {
    this.layer?.setRules(this.rules);
    this.requestRender?.();
  }

  // ─── Convenience factory methods ────────────────────────────

  static createValueRule(
    range: CellRange,
    operator: import('@witqq/spreadsheet').ComparisonOperator,
    value: number,
    bgColor: string,
    options?: { value2?: number; priority?: number; textColor?: string; stopIfTrue?: boolean },
  ): ConditionalFormatRule {
    return {
      id: `cf-value-${++ruleIdCounter}`,
      priority: options?.priority ?? 0,
      range,
      condition: {
        type: 'value',
        operator,
        value,
        value2: options?.value2,
      },
      style: { bgColor, textColor: options?.textColor },
      stopIfTrue: options?.stopIfTrue,
    };
  }

  static createGradientScale(
    range: CellRange,
    stops: readonly { value: number; color: string }[],
    options?: { priority?: number },
  ): ConditionalFormatRule {
    return {
      id: `cf-gradient-${++ruleIdCounter}`,
      priority: options?.priority ?? 0,
      range,
      condition: {
        type: 'gradientScale',
        stops,
      },
    };
  }

  static createDataBar(
    range: CellRange,
    color: string,
    options?: { minValue?: number; maxValue?: number; showValue?: boolean; priority?: number },
  ): ConditionalFormatRule {
    return {
      id: `cf-databar-${++ruleIdCounter}`,
      priority: options?.priority ?? 0,
      range,
      condition: {
        type: 'dataBar',
        color,
        minValue: options?.minValue,
        maxValue: options?.maxValue,
        showValue: options?.showValue,
      },
    };
  }

  static createIconSet(
    range: CellRange,
    iconSet: import('@witqq/spreadsheet').IconSetName,
    options?: { thresholds?: readonly { value: number; icon: string }[]; showValue?: boolean; priority?: number },
  ): ConditionalFormatRule {
    const thresholds = options?.thresholds ?? ICON_SETS[iconSet] ?? [];
    return {
      id: `cf-iconset-${++ruleIdCounter}`,
      priority: options?.priority ?? 0,
      range,
      condition: {
        type: 'iconSet',
        iconSet,
        thresholds,
        showValue: options?.showValue,
      },
    };
  }
}
