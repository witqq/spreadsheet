// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoRowSizeManager } from '../src/auto-row-size/auto-row-size-manager';
import type { AutoRowSizeConfig } from '../src/auto-row-size/auto-row-size-manager';
import type { RenderContext, RenderLayer } from '../src/renderer/render-layer';
import { RowStore } from '../src/model/row-store';

/** Create a minimal mock RenderContext. */
function mockRenderContext(overrides?: Partial<RenderContext>): RenderContext {
  return {
    ctx: {} as CanvasRenderingContext2D,
    geometry: {} as any,
    theme: { fonts: { cell: 'Arial', cellSize: 13 } } as any,
    canvasWidth: 800,
    canvasHeight: 600,
    viewport: { startRow: 0, endRow: 9, startCol: 0, endCol: 5, visibleRowCount: 10, visibleColCount: 6 },
    scrollX: 0,
    scrollY: 0,
    renderMode: 'full',
    paneRegion: 'full',
    ...overrides,
  };
}

/** Create a mock RenderLayer that returns predefined heights. */
function createMockLayer(heightMap: Map<number, number>): RenderLayer {
  return {
    render: vi.fn(),
    measureHeights: vi.fn(() => new Map(heightMap)),
  };
}

describe('AutoRowSizeManager', () => {
  let applyHeights: ReturnType<typeof vi.fn>;
  let rowStore: RowStore;

  beforeEach(() => {
    applyHeights = vi.fn();
    rowStore = new RowStore();
  });

  function createManager(config?: Partial<AutoRowSizeConfig>): AutoRowSizeManager {
    return new AutoRowSizeManager(
      { minRowHeight: 28, cellPadding: 8, ...config },
      applyHeights,
    );
  }

  describe('constructor', () => {
    it('creates manager with default config', () => {
      const mgr = new AutoRowSizeManager({}, applyHeights);
      expect(mgr.isMeasuring).toBe(false);
      expect(mgr.progress).toBe(1);
    });

    it('creates manager with custom config', () => {
      const mgr = createManager({ batchSize: 50, minRowHeight: 20, cellPadding: 4 });
      expect(mgr.isMeasuring).toBe(false);
    });
  });

  describe('measureViewport', () => {
    it('returns 0 when no layers are set', () => {
      const mgr = createManager();
      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);
      expect(updated).toBe(0);
      expect(applyHeights).not.toHaveBeenCalled();
    });

    it('returns 0 when layers report no heights', () => {
      const mgr = createManager();
      mgr.setLayers([createMockLayer(new Map())]);
      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);
      expect(updated).toBe(0);
    });

    it('measures visible rows and applies heights with padding', () => {
      const mgr = createManager({ cellPadding: 8, minRowHeight: 28 });
      const heights = new Map([[0, 50], [1, 30], [2, 100]]);
      mgr.setLayers([createMockLayer(heights)]);

      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);

      expect(updated).toBe(3);
      expect(applyHeights).toHaveBeenCalledTimes(1);

      const appliedMap = applyHeights.mock.calls[0][0] as Map<number, number>;
      expect(appliedMap.get(0)).toBe(58);  // 50 + 8
      expect(appliedMap.get(1)).toBe(38);  // 30 + 8
      expect(appliedMap.get(2)).toBe(108); // 100 + 8
    });

    it('applies minRowHeight when measured height + padding is below minimum', () => {
      const mgr = createManager({ cellPadding: 8, minRowHeight: 28 });
      // Height 10 + 8 = 18, which is below minRowHeight 28
      const heights = new Map([[0, 10]]);
      mgr.setLayers([createMockLayer(heights)]);

      const rc = mockRenderContext();
      mgr.measureViewport(rc, rowStore);

      const appliedMap = applyHeights.mock.calls[0][0] as Map<number, number>;
      expect(appliedMap.get(0)).toBe(28); // clamped to minRowHeight
    });

    it('skips rows with manual height overrides', () => {
      const mgr = createManager({ cellPadding: 8, minRowHeight: 28 });
      rowStore.setHeight(1, 60); // manual override on row 1

      const heights = new Map([[0, 50], [1, 80], [2, 40]]);
      mgr.setLayers([createMockLayer(heights)]);

      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);

      expect(updated).toBe(2); // row 1 skipped
      const appliedMap = applyHeights.mock.calls[0][0] as Map<number, number>;
      expect(appliedMap.has(1)).toBe(false);
      expect(appliedMap.get(0)).toBe(58);
      expect(appliedMap.get(2)).toBe(48);
    });

    it('takes maximum height across multiple layers', () => {
      const mgr = createManager({ cellPadding: 0, minRowHeight: 0 });
      const layer1 = createMockLayer(new Map([[0, 30], [1, 50]]));
      const layer2 = createMockLayer(new Map([[0, 60], [2, 40]]));
      mgr.setLayers([layer1, layer2]);

      const rc = mockRenderContext();
      mgr.measureViewport(rc, rowStore);

      const appliedMap = applyHeights.mock.calls[0][0] as Map<number, number>;
      expect(appliedMap.get(0)).toBe(60); // max(30, 60)
      expect(appliedMap.get(1)).toBe(50); // only layer1
      expect(appliedMap.get(2)).toBe(40); // only layer2
    });

    it('passes RenderContext to layer measureHeights', () => {
      const mgr = createManager();
      const layer = createMockLayer(new Map([[0, 40]]));
      mgr.setLayers([layer]);

      const rc = mockRenderContext({ scrollX: 100 });
      mgr.measureViewport(rc, rowStore);

      expect(layer.measureHeights).toHaveBeenCalledWith(rc);
    });

    it('returns 0 after manager is destroyed', () => {
      const mgr = createManager();
      mgr.setLayers([createMockLayer(new Map([[0, 50]]))]);
      mgr.destroy();

      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);
      expect(updated).toBe(0);
      expect(applyHeights).not.toHaveBeenCalled();
    });

    it('ignores layers without measureHeights method', () => {
      const mgr = createManager({ cellPadding: 0, minRowHeight: 0 });
      const layerWithout: RenderLayer = { render: vi.fn() };
      const layerWith = createMockLayer(new Map([[0, 50]]));
      mgr.setLayers([layerWithout, layerWith]);

      const rc = mockRenderContext();
      mgr.measureViewport(rc, rowStore);

      const appliedMap = applyHeights.mock.calls[0][0] as Map<number, number>;
      expect(appliedMap.get(0)).toBe(50);
    });

    it('returns 0 when all measured rows have manual overrides', () => {
      const mgr = createManager();
      rowStore.setHeight(0, 60);
      rowStore.setHeight(1, 60);
      mgr.setLayers([createMockLayer(new Map([[0, 50], [1, 50]]))]);

      const rc = mockRenderContext();
      const updated = mgr.measureViewport(rc, rowStore);
      expect(updated).toBe(0);
      expect(applyHeights).not.toHaveBeenCalled();
    });
  });

  describe('async measurement', () => {
    it('reports not measuring when idle', () => {
      const mgr = createManager();
      expect(mgr.isMeasuring).toBe(false);
      expect(mgr.progress).toBe(1);
    });

    it('cancelAsyncMeasurement is safe when not measuring', () => {
      const mgr = createManager();
      expect(() => mgr.cancelAsyncMeasurement()).not.toThrow();
    });

    it('does not start async measurement after destroy', () => {
      const mgr = createManager();
      mgr.destroy();
      const buildRc = vi.fn();
      mgr.startAsyncMeasurement(100, buildRc, rowStore);
      expect(mgr.isMeasuring).toBe(false);
      expect(buildRc).not.toHaveBeenCalled();
    });

    it('does not start for 0 rows', () => {
      const mgr = createManager();
      const buildRc = vi.fn();
      mgr.startAsyncMeasurement(0, buildRc, rowStore);
      expect(mgr.isMeasuring).toBe(false);
    });
  });

  describe('setLayers', () => {
    it('replaces layers', () => {
      const mgr = createManager({ cellPadding: 0, minRowHeight: 0 });
      const layer1 = createMockLayer(new Map([[0, 30]]));
      const layer2 = createMockLayer(new Map([[0, 60]]));

      mgr.setLayers([layer1]);
      const rc = mockRenderContext();
      mgr.measureViewport(rc, rowStore);
      expect((applyHeights.mock.calls[0][0] as Map<number, number>).get(0)).toBe(30);

      mgr.setLayers([layer2]);
      mgr.measureViewport(rc, rowStore);
      expect((applyHeights.mock.calls[1][0] as Map<number, number>).get(0)).toBe(60);
    });
  });

  describe('destroy', () => {
    it('clears layers and prevents future measurements', () => {
      const mgr = createManager();
      mgr.setLayers([createMockLayer(new Map([[0, 50]]))]);
      mgr.destroy();

      const rc = mockRenderContext();
      expect(mgr.measureViewport(rc, rowStore)).toBe(0);
    });

    it('clears dirty rows on destroy', () => {
      const mgr = createManager();
      mgr.markDirtyRows([0, 1, 2]);
      expect(mgr.hasDirtyRows).toBe(true);
      mgr.destroy();
      expect(mgr.hasDirtyRows).toBe(false);
    });
  });

  describe('dirty tracking', () => {
    it('marks specific rows as dirty', () => {
      const mgr = createManager();
      expect(mgr.hasDirtyRows).toBe(false);
      expect(mgr.dirtyRowCount).toBe(0);

      mgr.markDirtyRows([0, 5, 10]);
      expect(mgr.hasDirtyRows).toBe(true);
      expect(mgr.dirtyRowCount).toBe(3);
      expect(mgr.isRowDirty(0)).toBe(true);
      expect(mgr.isRowDirty(5)).toBe(true);
      expect(mgr.isRowDirty(10)).toBe(true);
      expect(mgr.isRowDirty(3)).toBe(false);
    });

    it('marks all rows as dirty', () => {
      const mgr = createManager();
      mgr.markAllDirty();
      expect(mgr.hasDirtyRows).toBe(true);
      expect(mgr.isAllDirty).toBe(true);
      expect(mgr.isRowDirty(999)).toBe(true); // any row is dirty
    });

    it('clears dirty state', () => {
      const mgr = createManager();
      mgr.markDirtyRows([1, 2, 3]);
      mgr.markAllDirty();
      mgr.clearDirty();
      expect(mgr.hasDirtyRows).toBe(false);
      expect(mgr.isAllDirty).toBe(false);
      expect(mgr.dirtyRowCount).toBe(0);
    });

    it('measureViewport clears dirty status for measured rows', () => {
      const mgr = createManager({ cellPadding: 0, minRowHeight: 0 });
      mgr.markDirtyRows([0, 1, 5]);
      mgr.setLayers([createMockLayer(new Map([[0, 30], [1, 40]]))]);

      const rc = mockRenderContext();
      mgr.measureViewport(rc, rowStore);

      // Rows 0 and 1 measured — no longer dirty
      expect(mgr.isRowDirty(0)).toBe(false);
      expect(mgr.isRowDirty(1)).toBe(false);
      // Row 5 was dirty but not measured (not in layer output) — still dirty
      expect(mgr.isRowDirty(5)).toBe(true);
      expect(mgr.dirtyRowCount).toBe(1);
    });

    it('duplicate markDirtyRows calls are idempotent', () => {
      const mgr = createManager();
      mgr.markDirtyRows([1, 2]);
      mgr.markDirtyRows([2, 3]);
      expect(mgr.dirtyRowCount).toBe(3); // 1, 2, 3
    });

    it('startDirtyMeasurement does nothing with no dirty rows', () => {
      const mgr = createManager();
      const buildRc = vi.fn();
      mgr.startDirtyMeasurement(buildRc, rowStore);
      expect(mgr.isMeasuring).toBe(false);
      expect(buildRc).not.toHaveBeenCalled();
    });

    it('startDirtyMeasurement does nothing after destroy', () => {
      const mgr = createManager();
      mgr.markDirtyRows([1, 2]);
      mgr.destroy();
      const buildRc = vi.fn();
      mgr.startDirtyMeasurement(buildRc, rowStore);
      expect(mgr.isMeasuring).toBe(false);
    });
  });
});
