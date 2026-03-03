// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import type { ColumnDef, ConditionalFormatRule } from '@witqq/spreadsheet';
import {
  ConditionalFormattingPlugin,
  CONDITIONAL_FORMAT_PLUGIN_NAME,
  toNumber,
  evaluateComparison,
  interpolateColor,
} from '../conditional-format/src/index';

function makeColumns(): ColumnDef[] {
  return [
    { key: 'a', title: 'A', width: 100, type: 'number' },
    { key: 'b', title: 'B', width: 100, type: 'number' },
    { key: 'c', title: 'C', width: 100, type: 'number' },
  ];
}

function createMockCtx(): CanvasRenderingContext2D {
  return {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 40 }),
    canvas: {} as HTMLCanvasElement,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('ConditionalFormattingPlugin', () => {
  let container: HTMLDivElement;
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof ResizeObserver;

    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockCtx()) as any;

    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    document.body.removeChild(container);
  });

  function createEngine(data?: Record<string, unknown>[]): SpreadsheetEngine {
    const engine = new SpreadsheetEngine({
      columns: makeColumns(),
      data: data ?? [],
      rowCount: 10,
    });
    engine.mount(container);
    return engine;
  }

  // ─── Plugin Lifecycle ────────────────────────────

  it('has correct name and version', () => {
    const plugin = new ConditionalFormattingPlugin();
    expect(plugin.name).toBe(CONDITIONAL_FORMAT_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('installs and destroys without error', () => {
    const engine = createEngine();
    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);
    expect(plugin.getLayer()).not.toBeNull();
    engine.removePlugin(CONDITIONAL_FORMAT_PLUGIN_NAME);
  });

  it('rules added before install are preserved', () => {
    const plugin = new ConditionalFormattingPlugin();
    plugin.addRule(ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 9, startCol: 0, endCol: 0 },
      'greaterThan', 50, '#ff0000',
    ));
    const engine = createEngine();
    engine.installPlugin(plugin);
    expect(plugin.getRules()).toHaveLength(1);
    expect(plugin.getLayer()!.getRules()).toHaveLength(1);
    engine.removePlugin(CONDITIONAL_FORMAT_PLUGIN_NAME);
  });

  // ─── Rule Management ────────────────────────────

  it('addRule and removeRule', () => {
    const engine = createEngine();
    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);

    const rule = ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 9, startCol: 0, endCol: 0 },
      'greaterThan', 50, '#ff0000',
    );
    plugin.addRule(rule);
    expect(plugin.getRules()).toHaveLength(1);

    plugin.removeRule(rule.id);
    expect(plugin.getRules()).toHaveLength(0);
    engine.removePlugin(CONDITIONAL_FORMAT_PLUGIN_NAME);
  });

  it('clearRules removes all rules', () => {
    const engine = createEngine();
    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);

    plugin.addRule(ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 9, startCol: 0, endCol: 0 }, 'greaterThan', 50, '#ff0000',
    ));
    plugin.addRule(ConditionalFormattingPlugin.createDataBar(
      { startRow: 0, endRow: 9, startCol: 1, endCol: 1 }, '#0000ff',
    ));
    expect(plugin.getRules()).toHaveLength(2);

    plugin.clearRules();
    expect(plugin.getRules()).toHaveLength(0);
    engine.removePlugin(CONDITIONAL_FORMAT_PLUGIN_NAME);
  });

  it('rules are sorted by priority', () => {
    const engine = createEngine();
    const plugin = new ConditionalFormattingPlugin();
    engine.installPlugin(plugin);

    plugin.addRule(ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 9, startCol: 0, endCol: 0 }, 'greaterThan', 50, '#ff0000',
      { priority: 10 },
    ));
    plugin.addRule(ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 9, startCol: 0, endCol: 0 }, 'lessThan', 20, '#00ff00',
      { priority: 1 },
    ));

    const layerRules = plugin.getLayer()!.getRules();
    expect(layerRules[0].priority).toBe(1);
    expect(layerRules[1].priority).toBe(10);
    engine.removePlugin(CONDITIONAL_FORMAT_PLUGIN_NAME);
  });

  // ─── Factory Methods ────────────────────────────

  it('createValueRule produces correct structure', () => {
    const rule = ConditionalFormattingPlugin.createValueRule(
      { startRow: 0, endRow: 5, startCol: 0, endCol: 0 },
      'between', 10, '#aabbcc',
      { value2: 20, priority: 5, textColor: '#112233', stopIfTrue: true },
    );
    expect(rule.condition.type).toBe('value');
    expect(rule.priority).toBe(5);
    expect(rule.style?.bgColor).toBe('#aabbcc');
    expect(rule.style?.textColor).toBe('#112233');
    expect(rule.stopIfTrue).toBe(true);
    if (rule.condition.type === 'value') {
      expect(rule.condition.operator).toBe('between');
      expect(rule.condition.value).toBe(10);
      expect(rule.condition.value2).toBe(20);
    }
  });

  it('createGradientScale produces correct structure', () => {
    const rule = ConditionalFormattingPlugin.createGradientScale(
      { startRow: 0, endRow: 5, startCol: 0, endCol: 0 },
      [{ value: 0, color: '#ff0000' }, { value: 100, color: '#00ff00' }],
    );
    expect(rule.condition.type).toBe('gradientScale');
    if (rule.condition.type === 'gradientScale') {
      expect(rule.condition.stops).toHaveLength(2);
    }
  });

  it('createDataBar produces correct structure', () => {
    const rule = ConditionalFormattingPlugin.createDataBar(
      { startRow: 0, endRow: 5, startCol: 0, endCol: 0 },
      '#5b9bd5',
      { minValue: 0, maxValue: 100, showValue: true },
    );
    expect(rule.condition.type).toBe('dataBar');
    if (rule.condition.type === 'dataBar') {
      expect(rule.condition.color).toBe('#5b9bd5');
      expect(rule.condition.minValue).toBe(0);
      expect(rule.condition.maxValue).toBe(100);
    }
  });

  it('createIconSet produces correct structure', () => {
    const rule = ConditionalFormattingPlugin.createIconSet(
      { startRow: 0, endRow: 5, startCol: 0, endCol: 0 },
      'arrows',
    );
    expect(rule.condition.type).toBe('iconSet');
    if (rule.condition.type === 'iconSet') {
      expect(rule.condition.iconSet).toBe('arrows');
      expect(rule.condition.thresholds.length).toBeGreaterThan(0);
    }
  });

  it('createIconSet with custom thresholds', () => {
    const rule = ConditionalFormattingPlugin.createIconSet(
      { startRow: 0, endRow: 5, startCol: 0, endCol: 0 },
      'stars',
      { thresholds: [{ value: 5, icon: '★★★★★' }, { value: 0, icon: '☆' }] },
    );
    if (rule.condition.type === 'iconSet') {
      expect(rule.condition.thresholds).toHaveLength(2);
      expect(rule.condition.thresholds[0].icon).toBe('★★★★★');
    }
  });
});

// ─── Utility Functions ────────────────────────────

describe('toNumber', () => {
  it('converts number', () => expect(toNumber(42)).toBe(42));
  it('converts numeric string', () => expect(toNumber('3.14')).toBe(3.14));
  it('returns null for non-numeric string', () => expect(toNumber('abc')).toBeNull());
  it('converts boolean true', () => expect(toNumber(true)).toBe(1));
  it('converts boolean false', () => expect(toNumber(false)).toBe(0));
  it('returns null for null', () => expect(toNumber(null)).toBeNull());
  it('returns null for Date', () => expect(toNumber(new Date())).toBeNull());
});

describe('evaluateComparison', () => {
  it('greaterThan', () => {
    expect(evaluateComparison(10, 'greaterThan', 5)).toBe(true);
    expect(evaluateComparison(5, 'greaterThan', 10)).toBe(false);
    expect(evaluateComparison(5, 'greaterThan', 5)).toBe(false);
  });
  it('lessThan', () => {
    expect(evaluateComparison(3, 'lessThan', 5)).toBe(true);
    expect(evaluateComparison(5, 'lessThan', 3)).toBe(false);
  });
  it('greaterThanOrEqual', () => {
    expect(evaluateComparison(5, 'greaterThanOrEqual', 5)).toBe(true);
    expect(evaluateComparison(4, 'greaterThanOrEqual', 5)).toBe(false);
  });
  it('lessThanOrEqual', () => {
    expect(evaluateComparison(5, 'lessThanOrEqual', 5)).toBe(true);
    expect(evaluateComparison(6, 'lessThanOrEqual', 5)).toBe(false);
  });
  it('equal', () => {
    expect(evaluateComparison(5, 'equal', 5)).toBe(true);
    expect(evaluateComparison(4, 'equal', 5)).toBe(false);
  });
  it('notEqual', () => {
    expect(evaluateComparison(4, 'notEqual', 5)).toBe(true);
    expect(evaluateComparison(5, 'notEqual', 5)).toBe(false);
  });
  it('between', () => {
    expect(evaluateComparison(5, 'between', 1, 10)).toBe(true);
    expect(evaluateComparison(0, 'between', 1, 10)).toBe(false);
    expect(evaluateComparison(1, 'between', 1, 10)).toBe(true);
    expect(evaluateComparison(10, 'between', 1, 10)).toBe(true);
  });
  it('notBetween', () => {
    expect(evaluateComparison(0, 'notBetween', 1, 10)).toBe(true);
    expect(evaluateComparison(5, 'notBetween', 1, 10)).toBe(false);
  });
  it('returns false for non-numeric value', () => {
    expect(evaluateComparison('abc', 'greaterThan', 5)).toBe(false);
    expect(evaluateComparison(null, 'equal', 0)).toBe(false);
  });
});

describe('interpolateColor', () => {
  it('returns exact color at stop', () => {
    const stops = [{ value: 0, color: '#ff0000' }, { value: 100, color: '#00ff00' }];
    expect(interpolateColor(0, stops)).toBe('#ff0000');
    expect(interpolateColor(100, stops)).toBe('#00ff00');
  });

  it('interpolates midpoint', () => {
    const stops = [{ value: 0, color: '#000000' }, { value: 100, color: '#646464' }];
    const result = interpolateColor(50, stops);
    // Midpoint of #000000 and #646464 is rgb(50,50,50)
    expect(result).toBe('rgb(50,50,50)');
  });

  it('clamps below min stop', () => {
    const stops = [{ value: 10, color: '#ff0000' }, { value: 90, color: '#00ff00' }];
    expect(interpolateColor(5, stops)).toBe('#ff0000');
  });

  it('clamps above max stop', () => {
    const stops = [{ value: 10, color: '#ff0000' }, { value: 90, color: '#00ff00' }];
    expect(interpolateColor(95, stops)).toBe('#00ff00');
  });

  it('handles 3 stops', () => {
    const stops = [
      { value: 0, color: '#ff0000' },
      { value: 50, color: '#ffff00' },
      { value: 100, color: '#00ff00' },
    ];
    // At value 50, should return second stop color in rgb format (interpolated at boundary)
    expect(interpolateColor(50, stops)).toBe('rgb(255,255,0)');
  });

  it('returns transparent for empty stops', () => {
    expect(interpolateColor(50, [])).toBe('transparent');
  });

  it('returns single stop color', () => {
    expect(interpolateColor(50, [{ value: 0, color: '#aabbcc' }])).toBe('#aabbcc');
  });
});
