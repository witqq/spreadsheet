// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollManager } from '../src/renderer/scroll-manager';
import { LayoutEngine } from '../src/renderer/layout-engine';
import { ViewportManager } from '../src/renderer/viewport-manager';
import type { ColumnDef } from '../src/types/interfaces';

function makeColumns(count: number, width = 100): ColumnDef[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `col${i}`,
    title: `Column ${i}`,
    width,
  }));
}

describe('ScrollManager', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('DOM structure', () => {
    it('creates a scroll container div in the parent', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      const scrollDiv = container.querySelector('div');
      expect(scrollDiv).not.toBeNull();
      expect(scrollDiv!.style.overflow).toBe('auto');
      expect(scrollDiv!.style.position).toBe('absolute');
      expect(scrollDiv!.style.zIndex).toBe('10');

      sm.destroy();
    });

    it('creates a spacer div sized to total content dimensions', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      const scrollDiv = container.querySelector('div');
      const spacer = scrollDiv!.querySelector('div');
      expect(spacer).not.toBeNull();
      expect(spacer!.style.width).toBe('2000px');
      expect(spacer!.style.height).toBe('5000px');

      sm.destroy();
    });

    it('removes the scroll container on destroy', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      expect(container.querySelector('div')).not.toBeNull();

      sm.destroy();

      expect(container.querySelector('div')).toBeNull();
    });
  });

  describe('total content size', () => {
    it('computes spacer size from LayoutEngine totalWidth/totalHeight', () => {
      const columns = makeColumns(20, 120);
      const layout = new LayoutEngine({
        columns,
        rowCount: 1000,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });

      const sm = new ScrollManager({
        container,
        totalWidth: layout.totalWidth,
        totalHeight: layout.totalHeight,
        onScroll: vi.fn(),
      });

      const scrollDiv = container.querySelector('div');
      const spacer = scrollDiv!.querySelector('div');

      // totalWidth = rowNumberWidth(50) + 20*120 = 2450
      expect(spacer!.style.width).toBe('2450px');
      // totalHeight = headerHeight(32) + 1000*28 = 28032
      expect(spacer!.style.height).toBe('28032px');

      sm.destroy();
    });

    it('updates spacer size via updateContentSize', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      sm.updateContentSize(3000, 8000);

      const scrollDiv = container.querySelector('div');
      const spacer = scrollDiv!.querySelector('div');
      expect(spacer!.style.width).toBe('3000px');
      expect(spacer!.style.height).toBe('8000px');

      sm.destroy();
    });
  });

  describe('scroll position', () => {
    it('starts at scroll position (0, 0)', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      expect(sm.scrollX).toBe(0);
      expect(sm.scrollY).toBe(0);

      sm.destroy();
    });

    it('scrollTo updates scroll position', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      sm.scrollTo(100, 200);

      // In jsdom, scrollLeft/scrollTop are settable but may not reflect
      // actual scroll due to lack of layout engine. We verify the element properties.
      const el = sm.getElement();
      expect(el.scrollLeft).toBe(100);
      expect(el.scrollTop).toBe(200);

      sm.destroy();
    });
  });

  describe('scroll position to viewport mapping', () => {
    it('maps scroll position (0, 0) to first visible rows and columns', () => {
      const columns = makeColumns(20, 100);
      const layout = new LayoutEngine({
        columns,
        rowCount: 1000,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });
      const viewport = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // Viewport at scroll (0, 0), canvas 800x600
      const range = viewport.computeVisibleRange(0, 0, 800, 600);

      expect(range.startRow).toBe(0);
      expect(range.startCol).toBe(0);
      // Visible rows: 600px / 28px ≈ 21.4 → endRow = 21
      expect(range.endRow).toBe(21);
    });

    it('maps non-zero scroll to offset viewport', () => {
      const columns = makeColumns(20, 100);
      const layout = new LayoutEngine({
        columns,
        rowCount: 1000,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });
      const viewport = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // Scroll down by 280px = 10 rows
      const range = viewport.computeVisibleRange(0, 280, 800, 600);

      expect(range.startRow).toBe(10);
      // Visible rows from 280: (280+600-1)/28 ≈ 31.4 → endRow = 31
      expect(range.endRow).toBe(31);
    });

    it('maps horizontal scroll to offset columns', () => {
      const columns = makeColumns(20, 100);
      const layout = new LayoutEngine({
        columns,
        rowCount: 1000,
        rowHeight: 28,
        headerHeight: 32,
        rowNumberWidth: 50,
      });
      const viewport = new ViewportManager(layout, { rowBuffer: 0, colBuffer: 0 });

      // Scroll right by 500px = past 5 columns (each 100px)
      const range = viewport.computeVisibleRange(500, 0, 800, 600);

      expect(range.startCol).toBe(5);
    });
  });

  describe('getElement', () => {
    it('returns the scroll container element', () => {
      const sm = new ScrollManager({
        container,
        totalWidth: 2000,
        totalHeight: 5000,
        onScroll: vi.fn(),
      });

      const el = sm.getElement();
      expect(el).toBeInstanceOf(HTMLDivElement);
      expect(el.style.overflow).toBe('auto');

      sm.destroy();
    });
  });
});
