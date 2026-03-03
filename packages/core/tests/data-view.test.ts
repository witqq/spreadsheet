import { describe, it, expect } from 'vitest';
import { DataView } from '../src/dataview/data-view';

describe('DataView', () => {
  describe('passthrough (identity mapping)', () => {
    it('should return same row for getPhysicalRow', () => {
      const dv = new DataView({ totalRowCount: 100 });
      expect(dv.getPhysicalRow(0)).toBe(0);
      expect(dv.getPhysicalRow(42)).toBe(42);
      expect(dv.getPhysicalRow(99)).toBe(99);
    });

    it('should return same row for getLogicalRow', () => {
      const dv = new DataView({ totalRowCount: 100 });
      expect(dv.getLogicalRow(0)).toBe(0);
      expect(dv.getLogicalRow(42)).toBe(42);
      expect(dv.getLogicalRow(99)).toBe(99);
    });

    it('should report isPassthrough true', () => {
      const dv = new DataView({ totalRowCount: 100 });
      expect(dv.isPassthrough()).toBe(true);
    });

    it('should report correct visibleRowCount', () => {
      const dv = new DataView({ totalRowCount: 100 });
      expect(dv.visibleRowCount).toBe(100);
    });

    it('should report correct totalRowCount', () => {
      const dv = new DataView({ totalRowCount: 100 });
      expect(dv.totalRowCount).toBe(100);
    });
  });

  describe('recompute (sorted/filtered mapping)', () => {
    it('should map logical to physical after recompute', () => {
      const dv = new DataView({ totalRowCount: 5 });
      // Reverse sort: logical 0 → physical 4, logical 1 → physical 3, etc.
      dv.recompute([4, 3, 2, 1, 0]);
      expect(dv.getPhysicalRow(0)).toBe(4);
      expect(dv.getPhysicalRow(1)).toBe(3);
      expect(dv.getPhysicalRow(2)).toBe(2);
      expect(dv.getPhysicalRow(3)).toBe(1);
      expect(dv.getPhysicalRow(4)).toBe(0);
    });

    it('should map physical to logical after recompute', () => {
      const dv = new DataView({ totalRowCount: 5 });
      dv.recompute([4, 3, 2, 1, 0]);
      expect(dv.getLogicalRow(4)).toBe(0);
      expect(dv.getLogicalRow(3)).toBe(1);
      expect(dv.getLogicalRow(0)).toBe(4);
    });

    it('should report isPassthrough false after recompute', () => {
      const dv = new DataView({ totalRowCount: 5 });
      dv.recompute([4, 3, 2, 1, 0]);
      expect(dv.isPassthrough()).toBe(false);
    });

    it('should handle filtering (fewer visible rows)', () => {
      const dv = new DataView({ totalRowCount: 10 });
      // Only show physical rows 2, 5, 7
      dv.recompute([2, 5, 7]);
      expect(dv.visibleRowCount).toBe(3);
      expect(dv.totalRowCount).toBe(10);
      expect(dv.getPhysicalRow(0)).toBe(2);
      expect(dv.getPhysicalRow(1)).toBe(5);
      expect(dv.getPhysicalRow(2)).toBe(7);
    });

    it('should return undefined for hidden physical rows', () => {
      const dv = new DataView({ totalRowCount: 10 });
      dv.recompute([2, 5, 7]);
      expect(dv.getLogicalRow(0)).toBeUndefined();
      expect(dv.getLogicalRow(1)).toBeUndefined();
      expect(dv.getLogicalRow(3)).toBeUndefined();
      expect(dv.getLogicalRow(2)).toBe(0);
      expect(dv.getLogicalRow(5)).toBe(1);
    });

    it('should return -1 for out-of-range logical row', () => {
      const dv = new DataView({ totalRowCount: 5 });
      dv.recompute([2, 5, 7]);
      expect(dv.getPhysicalRow(10)).toBe(-1);
    });
  });

  describe('reset', () => {
    it('should return to passthrough after reset', () => {
      const dv = new DataView({ totalRowCount: 5 });
      dv.recompute([4, 3, 2, 1, 0]);
      expect(dv.isPassthrough()).toBe(false);

      dv.reset();
      expect(dv.isPassthrough()).toBe(true);
      expect(dv.getPhysicalRow(0)).toBe(0);
      expect(dv.getPhysicalRow(4)).toBe(4);
      expect(dv.visibleRowCount).toBe(5);
    });
  });

  describe('setTotalRowCount', () => {
    it('should update totalRowCount and visibleRowCount in passthrough', () => {
      const dv = new DataView({ totalRowCount: 100 });
      dv.setTotalRowCount(200);
      expect(dv.totalRowCount).toBe(200);
      expect(dv.visibleRowCount).toBe(200);
    });

    it('should not change visibleRowCount when mapping is active', () => {
      const dv = new DataView({ totalRowCount: 10 });
      dv.recompute([2, 5, 7]);
      expect(dv.visibleRowCount).toBe(3);

      dv.setTotalRowCount(20);
      expect(dv.totalRowCount).toBe(20);
      expect(dv.visibleRowCount).toBe(3);
    });
  });
});
