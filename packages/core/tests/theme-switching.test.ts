// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { lightTheme, darkTheme } from '../src/themes/built-in-themes';
import { GridGeometry } from '../src/renderer/grid-geometry';
import { RenderPipeline } from '../src/renderer/render-pipeline';
import { TooltipManager } from '../src/tooltip/tooltip-manager';
import { ContextMenuManager } from '../src/context-menu/context-menu-manager';
import { EventBus } from '../src/events/event-bus';
import type { SpreadsheetEngine } from '../src/engine/spreadsheet-engine';

describe('Theme switching', () => {
  describe('GridGeometry', () => {
    it('uses light theme dimensions initially', () => {
      const geo = new GridGeometry({
        columns: [{ key: 'a', title: 'A', width: 100 }],
        theme: lightTheme,
        showRowNumbers: true,
      });
      expect(geo.headerHeight).toBe(lightTheme.dimensions.headerHeight);
      expect(geo.rowHeight).toBe(lightTheme.dimensions.rowHeight);
      expect(geo.rowNumberWidth).toBe(lightTheme.dimensions.rowNumberWidth);
    });

    it('updates dimensions after setTheme', () => {
      const geo = new GridGeometry({
        columns: [{ key: 'a', title: 'A', width: 100 }],
        theme: lightTheme,
        showRowNumbers: true,
      });
      const customTheme = {
        ...darkTheme,
        dimensions: { ...darkTheme.dimensions, headerHeight: 48 },
      };
      geo.setTheme(customTheme);
      expect(geo.headerHeight).toBe(48);
    });

    it('invalidates column rect cache after setTheme', () => {
      const geo = new GridGeometry({
        columns: [{ key: 'a', title: 'A', width: 100 }],
        theme: lightTheme,
        showRowNumbers: true,
      });
      const rects1 = geo.computeColumnRects();
      const customTheme = {
        ...darkTheme,
        dimensions: { ...darkTheme.dimensions, rowNumberWidth: 80 },
      };
      geo.setTheme(customTheme);
      const rects2 = geo.computeColumnRects();
      expect(rects2[0].x).toBe(80);
      expect(rects2[0].x).not.toBe(rects1[0].x);
    });
  });

  describe('RenderPipeline', () => {
    it('propagates theme to RenderContext', () => {
      const geo = new GridGeometry({
        columns: [{ key: 'a', title: 'A', width: 100 }],
        theme: lightTheme,
        showRowNumbers: false,
      });
      const pipeline = new RenderPipeline(geo, lightTheme);

      let capturedTheme: typeof lightTheme | undefined;
      pipeline.addLayer({
        render(rc) {
          capturedTheme = rc.theme;
        },
      });

      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
      } as unknown as CanvasRenderingContext2D;

      pipeline.render(
        ctx,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        800, 600, 0, 0,
      );
      expect(capturedTheme?.name).toBe('light');

      pipeline.setTheme(darkTheme);
      pipeline.render(
        ctx,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        800, 600, 0, 0,
      );
      expect(capturedTheme?.name).toBe('dark');
    });
  });

  describe('ContextMenuManager', () => {
    it('setTheme updates internal theme', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const eventBus = new EventBus();
      const mgr = new ContextMenuManager({
        container,
        engine: {} as SpreadsheetEngine,
        eventBus,
        theme: lightTheme,
      });
      mgr.setTheme(darkTheme);
      mgr.destroy();
      document.body.removeChild(container);
    });
  });

  describe('TooltipManager', () => {
    it('setTheme updates tooltip styling', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const eventBus = new EventBus();
      const mgr = new TooltipManager({
        container,
        eventBus,
        cellStore: { get: () => null } as any,
        dataView: { getPhysicalRow: (r: number) => r } as any,
        layoutEngine: {} as any,
        scrollManager: { getScrollX: () => 0, getScrollY: () => 0 } as any,
        theme: lightTheme,
      });
      mgr.setTheme(darkTheme);
      mgr.destroy();
      document.body.removeChild(container);
    });
  });

  describe('theme objects', () => {
    it('light and dark themes have same structure', () => {
      const lightKeys = Object.keys(lightTheme.colors).sort();
      const darkKeys = Object.keys(darkTheme.colors).sort();
      expect(lightKeys).toEqual(darkKeys);
    });

    it('dark theme has different colors from light', () => {
      expect(darkTheme.colors.background).not.toBe(lightTheme.colors.background);
      expect(darkTheme.colors.cellText).not.toBe(lightTheme.colors.cellText);
    });

    it('themes have name property', () => {
      expect(lightTheme.name).toBe('light');
      expect(darkTheme.name).toBe('dark');
    });
  });
});
