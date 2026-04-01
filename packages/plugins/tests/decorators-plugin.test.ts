// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreeExpanderDecorator, TREE_TOGGLE_HIT_ZONE } from '../decorators/src/tree-expander-decorator';
import { SortIconDecorator, SORT_HIT_ZONE } from '../decorators/src/sort-icon-decorator';
import { ProgressBarDecorator } from '../decorators/src/progress-bar-decorator';
import { LinkDecorator, LINK_HIT_ZONE } from '../decorators/src/link-decorator';
import { ImageDecorator } from '../decorators/src/image-decorator';
import { SpinnerDecorator } from '../decorators/src/spinner-decorator';
import { DecoratorsPlugin, DECORATORS_PLUGIN_NAME } from '../decorators/src/decorators-plugin';
import type { CellData, SpreadsheetTheme, ImageManager } from '@witqq/spreadsheet';

// --- Helpers ---

function makeTheme(overrides: Partial<SpreadsheetTheme['colors']> = {}): SpreadsheetTheme {
  return {
    name: 'test',
    colors: {
      gridLine: '#ccc',
      background: '#fff',
      headerBackground: '#f5f5f5',
      headerText: '#333',
      headerBorder: '#ddd',
      selectionFill: 'rgba(0,0,255,0.1)',
      selectionBorder: '#0000ff',
      activeCellBorder: '#000',
      fillHandle: '#000',
      cellText: '#333333',
      cellBorder: '#e0e0e0',
      cellEditBackground: '#fff',
      alternateRowBackground: '#fafafa',
      hoverRowBackground: '#f0f0f0',
      frozenSeparator: '#999',
      scrollbarTrack: '#f0f0f0',
      scrollbarThumb: '#ccc',
      scrollbarThumbHover: '#aaa',
      errorBackground: '#fdd',
      warningBackground: '#ffd',
      changedIndicator: '#2196F3',
      savedIndicator: '#4CAF50',
      cellPlaceholder: '#999',
      ...overrides,
    },
    fonts: { cell: 'Arial', header: 'Arial', cellSize: 13, headerSize: 13 },
    dimensions: {
      rowHeight: 28, headerHeight: 32, minColumnWidth: 50,
      scrollbarWidth: 14, cellPadding: 6, borderWidth: 1, rowNumberWidth: 50,
    },
    borders: { gridLineWidth: 1, selectionWidth: 2, activeCellWidth: 2, frozenPaneWidth: 2 },
  };
}

function makeCellData(metadata?: Record<string, unknown>): CellData {
  return { value: 'test', metadata: metadata as CellData['metadata'] };
}

function makeCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const theme = makeTheme();

// ===================================================================
// TreeExpanderDecorator
// ===================================================================
describe('TreeExpanderDecorator', () => {
  let dec: TreeExpanderDecorator;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    dec = new TreeExpanderDecorator();
    ctx = makeCtx();
  });

  it('has correct id and position', () => {
    expect(dec.id).toBe('tree-expander');
    expect(dec.position).toBe('left');
  });

  it('getWidth increases with tree level', () => {
    const w0 = dec.getWidth!(makeCellData({ treeLevel: 0 }), 28);
    const w2 = dec.getWidth!(makeCellData({ treeLevel: 2 }), 28);
    expect(w2).toBeGreaterThan(w0);
  });

  it('getWidth returns base size for no metadata', () => {
    const w = dec.getWidth!(makeCellData(), 28);
    expect(w).toBeGreaterThan(0);
  });

  it('renders collapsed triangle (right-pointing)', () => {
    dec.render(ctx, makeCellData({ treeLevel: 1, treeExpanded: false }), 0, 0, 100, 28, theme);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders expanded triangle (down-pointing)', () => {
    dec.render(ctx, makeCellData({ treeLevel: 1, treeExpanded: true }), 0, 0, 100, 28, theme);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('provides hit zone with correct id', () => {
    const zones = dec.getHitZones!(100, 28, makeCellData({ treeLevel: 1 }));
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe(TREE_TOGGLE_HIT_ZONE);
    expect(zones[0].cursor).toBe('pointer');
    expect(zones[0].padding).toBeGreaterThan(0);
  });

  it('hit zone x offset increases with level', () => {
    const z0 = dec.getHitZones!(100, 28, makeCellData({ treeLevel: 0 }));
    const z2 = dec.getHitZones!(100, 28, makeCellData({ treeLevel: 2 }));
    expect(z2[0].x).toBeGreaterThan(z0[0].x);
  });
});

// ===================================================================
// SortIconDecorator
// ===================================================================
describe('SortIconDecorator', () => {
  let dec: SortIconDecorator;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    dec = new SortIconDecorator();
    ctx = makeCtx();
  });

  it('has correct id and position', () => {
    expect(dec.id).toBe('sort-icon');
    expect(dec.position).toBe('right');
  });

  it('getWidth returns fixed size', () => {
    expect(dec.getWidth!()).toBe(14);
  });

  it('renders ascending arrow', () => {
    dec.render(ctx, makeCellData({ sortDirection: 'asc' }), 0, 0, 14, 28, theme);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders descending arrow', () => {
    dec.render(ctx, makeCellData({ sortDirection: 'desc' }), 0, 0, 14, 28, theme);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('does not render when direction is none', () => {
    dec.render(ctx, makeCellData({ sortDirection: 'none' }), 0, 0, 14, 28, theme);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('provides hit zone', () => {
    const zones = dec.getHitZones!(14, 28);
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe(SORT_HIT_ZONE);
    expect(zones[0].cursor).toBe('pointer');
  });
});

// ===================================================================
// ProgressBarDecorator
// ===================================================================
describe('ProgressBarDecorator', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = makeCtx();
  });

  it('has correct id and position', () => {
    const dec = new ProgressBarDecorator();
    expect(dec.id).toBe('progress-bar');
    expect(dec.position).toBe('underlay');
  });

  it('renders bar for fractional progress (0-1)', () => {
    const dec = new ProgressBarDecorator();
    dec.render(ctx, makeCellData({ progress: 0.5 }), 0, 0, 100, 28, theme);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders bar for percentage progress (0-100)', () => {
    const dec = new ProgressBarDecorator();
    dec.render(ctx, makeCellData({ progress: 75 }), 0, 0, 100, 28, theme);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('does not render when progress is 0', () => {
    const dec = new ProgressBarDecorator();
    dec.render(ctx, makeCellData({ progress: 0 }), 0, 0, 100, 28, theme);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('does not render when progress is missing', () => {
    const dec = new ProgressBarDecorator();
    dec.render(ctx, makeCellData(), 0, 0, 100, 28, theme);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('respects custom color option', () => {
    const dec = new ProgressBarDecorator({ color: '#FF0000' });
    dec.render(ctx, makeCellData({ progress: 0.5 }), 0, 0, 100, 28, theme);
    expect(ctx.fillStyle).toBe('#FF0000');
  });

  it('caps progress at 100%', () => {
    const dec = new ProgressBarDecorator({ borderRadius: 0 });
    dec.render(ctx, makeCellData({ progress: 200 }), 0, 0, 100, 28, theme);
    // fillRect should use capped bar width (not exceed cell width)
    expect(ctx.fillRect).toHaveBeenCalled();
    const callArgs = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[2]).toBeLessThanOrEqual(100); // bar width <= cell width
  });
});

// ===================================================================
// LinkDecorator
// ===================================================================
describe('LinkDecorator', () => {
  let dec: LinkDecorator;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    dec = new LinkDecorator();
    ctx = makeCtx();
  });

  it('has correct id and position', () => {
    expect(dec.id).toBe('link');
    expect(dec.position).toBe('overlay');
  });

  it('renders link icon when metadata.link exists', () => {
    dec.render(ctx, makeCellData({ link: { url: 'https://example.com' } }), 0, 0, 100, 28, theme);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does not render when no link', () => {
    dec.render(ctx, makeCellData(), 0, 0, 100, 28, theme);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('provides hit zone when link exists', () => {
    const zones = dec.getHitZones!(100, 28, makeCellData({ link: { url: 'https://example.com' } }));
    expect(zones).toHaveLength(1);
    expect(zones[0].id).toBe(LINK_HIT_ZONE);
    expect(zones[0].cursor).toBe('pointer');
  });

  it('returns empty hit zones when no link', () => {
    const zones = dec.getHitZones!(100, 28, makeCellData());
    expect(zones).toHaveLength(0);
  });
});

// ===================================================================
// ImageDecorator
// ===================================================================
describe('ImageDecorator', () => {
  let dec: ImageDecorator;
  let ctx: CanvasRenderingContext2D;
  let mockImageManager: ImageManager;

  beforeEach(() => {
    dec = new ImageDecorator();
    ctx = makeCtx();
    mockImageManager = {
      getImage: vi.fn().mockReturnValue(null),
      preload: vi.fn(),
      has: vi.fn(),
      evict: vi.fn(),
      clear: vi.fn(),
      get size() { return 0; },
    } as unknown as ImageManager;
    dec.setImageManager(mockImageManager);
  });

  it('has correct id and position', () => {
    expect(dec.id).toBe('image-thumbnail');
    expect(dec.position).toBe('left');
  });

  it('getWidth returns size + padding', () => {
    expect(dec.getWidth!()).toBe(28); // 24 default + 4 padding
  });

  it('renders placeholder when image not loaded', () => {
    dec.render(ctx, makeCellData({ imageUrl: 'http://img.png' }), 0, 0, 28, 28, theme);
    expect(mockImageManager.getImage).toHaveBeenCalledWith('http://img.png');
    // Placeholder renders fillRect or roundRect → fill
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders image when loaded', () => {
    const fakeImg = {} as HTMLImageElement;
    (mockImageManager.getImage as ReturnType<typeof vi.fn>).mockReturnValue(fakeImg);

    dec.render(ctx, makeCellData({ imageUrl: 'http://img.png' }), 0, 0, 28, 28, theme);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeImg, expect.any(Number), expect.any(Number), 24, 24);
  });

  it('does not render when no imageUrl', () => {
    dec.render(ctx, makeCellData(), 0, 0, 28, 28, theme);
    expect(mockImageManager.getImage).not.toHaveBeenCalled();
  });

  it('respects custom urlField option', () => {
    const customDec = new ImageDecorator({ urlField: 'thumb' });
    customDec.setImageManager(mockImageManager);
    customDec.render(ctx, makeCellData({ thumb: 'http://thumb.png' }), 0, 0, 28, 28, theme);
    expect(mockImageManager.getImage).toHaveBeenCalledWith('http://thumb.png');
  });

  it('respects custom size option', () => {
    const customDec = new ImageDecorator({ size: 32 });
    expect(customDec.getWidth!()).toBe(36); // 32 + 4
  });
});

// ===================================================================
// SpinnerDecorator
// ===================================================================
describe('SpinnerDecorator', () => {
  let dec: SpinnerDecorator;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    dec = new SpinnerDecorator();
    ctx = makeCtx();
  });

  it('has correct id and position', () => {
    expect(dec.id).toBe('spinner');
    expect(dec.position).toBe('overlay');
  });

  it('renders arc at given timestamp', () => {
    dec.render(ctx, makeCellData({ loading: true }), 0, 0, 100, 28, theme, 0, 0, 1000);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('renders at different rotation for different timestamps', () => {
    dec.render(ctx, makeCellData({ loading: true }), 0, 0, 100, 28, theme, 0, 0, 0);
    const call1 = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];

    (ctx.arc as ReturnType<typeof vi.fn>).mockClear();
    dec.render(ctx, makeCellData({ loading: true }), 0, 0, 100, 28, theme, 0, 0, 5000);
    const call2 = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];

    // Start angle should differ for different timestamps
    expect(call1[3]).not.toBe(call2[3]);
  });

  it('uses theme text color for stroke', () => {
    const customTheme = makeTheme({ cellText: '#FF0000' });
    dec.render(ctx, makeCellData({ loading: true }), 0, 0, 100, 28, customTheme, 0, 0, 0);
    expect(ctx.strokeStyle).toBe('#FF0000');
  });
});

// ===================================================================
// DecoratorsPlugin — lifecycle
// ===================================================================
describe('DecoratorsPlugin', () => {
  function makeMockEngine() {
    const decorators = new Map<string, unknown>();
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    const addDecorator = vi.fn((reg: { decorator: { id: string } }) => {
      decorators.set(reg.decorator.id, reg);
    });
    const removeDecorator = vi.fn((id: string) => {
      decorators.delete(id);
    });
    const registry = { addDecorator, removeDecorator };

    const imageManager = {
      getImage: vi.fn().mockReturnValue(null),
      preload: vi.fn(),
      has: vi.fn(),
      evict: vi.fn(),
      clear: vi.fn(),
      get size() { return 0; },
    };

    const eventBusEmit = vi.fn();
    const eventBus = { emit: eventBusEmit };

    return {
      getCellTypeRegistry: vi.fn(() => registry),
      getImageManager: vi.fn(() => imageManager),
      getEventBus: vi.fn(() => eventBus),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        let set = listeners.get(event);
        if (!set) { set = new Set(); listeners.set(event, set); }
        set.add(handler);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(handler);
      }),
      requestRender: vi.fn(),
      decorators,
      listeners,
      registry,
      eventBus,
    };
  }

  function makeMockApi(engine: ReturnType<typeof makeMockEngine>) {
    return {
      engine: engine as unknown as import('@witqq/spreadsheet').SpreadsheetEngine,
      getPluginState: vi.fn(),
      setPluginState: vi.fn(),
    };
  }

  it('has correct name and version', () => {
    const plugin = new DecoratorsPlugin();
    expect(plugin.name).toBe(DECORATORS_PLUGIN_NAME);
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers all 6 decorators by default', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    expect(engine.registry.addDecorator).toHaveBeenCalledTimes(6);
    expect(engine.decorators.size).toBe(6);
  });

  it('registers click handler on cellClick', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    expect(engine.on).toHaveBeenCalledWith('cellClick', expect.any(Function));
    expect(engine.listeners.get('cellClick')?.size).toBe(1);
  });

  it('destroy removes all decorators and click handler', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    plugin.destroy!();

    expect(engine.registry.removeDecorator).toHaveBeenCalledTimes(6);
    expect(engine.off).toHaveBeenCalledWith('cellClick', expect.any(Function));
    expect(engine.requestRender).toHaveBeenCalledTimes(2); // install + destroy
  });

  it('can disable specific decorators via config', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin({
      treeExpander: false,
      sortIcon: false,
      progressBar: false,
    });
    plugin.install(api);

    // Only link + image + spinner = 3
    expect(engine.registry.addDecorator).toHaveBeenCalledTimes(3);
  });

  it('click handler emits treeToggle event for tree hit zone', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    const clickHandlers = engine.listeners.get('cellClick')!;
    const handler = [...clickHandlers][0];

    handler({ row: 0, col: 0, hitZone: TREE_TOGGLE_HIT_ZONE });
    expect(engine.eventBus.emit).toHaveBeenCalledWith('treeToggle', expect.objectContaining({ hitZone: TREE_TOGGLE_HIT_ZONE }));
  });

  it('click handler emits sortRequest for sort hit zone', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    const clickHandlers = engine.listeners.get('cellClick')!;
    const handler = [...clickHandlers][0];

    handler({ row: 0, col: 1, hitZone: SORT_HIT_ZONE });
    expect(engine.eventBus.emit).toHaveBeenCalledWith('sortRequest', expect.objectContaining({ hitZone: SORT_HIT_ZONE }));
  });

  it('click handler emits linkClick for link hit zone', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    const clickHandlers = engine.listeners.get('cellClick')!;
    const handler = [...clickHandlers][0];

    handler({ row: 0, col: 2, hitZone: LINK_HIT_ZONE });
    expect(engine.eventBus.emit).toHaveBeenCalledWith('linkClick', expect.objectContaining({ hitZone: LINK_HIT_ZONE }));
  });

  it('click handler ignores non-decorator hit zones', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    const clickHandlers = engine.listeners.get('cellClick')!;
    const handler = [...clickHandlers][0];

    handler({ row: 0, col: 0, hitZone: 'unknown-zone' });
    expect(engine.eventBus.emit).not.toHaveBeenCalled();
  });

  it('spinner is registered as animated', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    const spinnerCall = (engine.registry.addDecorator as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: [{ decorator: { id: string }; animated?: boolean }]) => c[0].decorator.id === 'spinner'
    );
    expect(spinnerCall).toBeDefined();
    expect(spinnerCall![0].animated).toBe(true);
  });

  it('image decorator wires ImageManager', () => {
    const engine = makeMockEngine();
    const api = makeMockApi(engine);
    const plugin = new DecoratorsPlugin();
    plugin.install(api);

    expect(engine.getImageManager).toHaveBeenCalled();
  });
});
