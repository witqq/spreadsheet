// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderScheduler } from '../src/renderer/render-scheduler';

describe('RenderScheduler', () => {
  let mockRaf: (cb: FrameRequestCallback) => number;
  let mockCancelRaf: (id: number) => void;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;
    mockRaf = vi.fn((cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      return id;
    });
    mockCancelRaf = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });
    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', mockCancelRaf);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fireRaf(timestamp = 16.67) {
    const entries = [...rafCallbacks.entries()];
    for (const [id, cb] of entries) {
      rafCallbacks.delete(id);
      cb(timestamp);
    }
  }

  it('coalesces multiple requestRender calls into one rAF', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();

    expect(mockRaf).toHaveBeenCalledTimes(1);
    fireRaf(100);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(100);
  });

  it('passes timestamp to callback from rAF', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.requestRender();
    fireRaf(42.5);
    expect(callback).toHaveBeenCalledWith(42.5);
  });

  it('allows new request after previous fires', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.requestRender();
    fireRaf(16);
    scheduler.requestRender();
    fireRaf(32);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cancel() prevents pending render', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.requestRender();
    scheduler.cancel();
    fireRaf();
    expect(callback).not.toHaveBeenCalled();
    expect(scheduler.isPending()).toBe(false);
  });

  it('isPending() reflects state', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    expect(scheduler.isPending()).toBe(false);
    scheduler.requestRender();
    expect(scheduler.isPending()).toBe(true);
    fireRaf();
    expect(scheduler.isPending()).toBe(false);
  });

  // ─── Animation loop tests ───

  it('setAnimationLoop(true) starts continuous rendering', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    expect(scheduler.isAnimating()).toBe(true);
    expect(scheduler.isPending()).toBe(true);

    fireRaf(16);
    expect(callback).toHaveBeenCalledWith(16);

    // Should schedule next frame automatically
    expect(rafCallbacks.size).toBe(1);
    fireRaf(32);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(32);
  });

  it('setAnimationLoop(false) stops continuous rendering', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    fireRaf(16);
    expect(callback).toHaveBeenCalledOnce();

    scheduler.setAnimationLoop(false);
    expect(scheduler.isAnimating()).toBe(false);
    // Pending rAF should be cancelled
    fireRaf(32);
    expect(callback).toHaveBeenCalledOnce(); // no additional call
  });

  it('requestRender() is a no-op during animation loop', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    scheduler.requestRender(); // should be ignored
    expect(mockRaf).toHaveBeenCalledTimes(1); // only the animation frame

    fireRaf(16);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('setAnimationLoop(true) cancels pending one-shot request', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.requestRender();
    expect(mockRaf).toHaveBeenCalledTimes(1);

    scheduler.setAnimationLoop(true);
    expect(mockCancelRaf).toHaveBeenCalled();
  });

  it('setAnimationLoop called twice with same value is no-op', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    const callsBefore = (mockRaf as ReturnType<typeof vi.fn>).mock.calls.length;
    scheduler.setAnimationLoop(true);
    expect((mockRaf as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
  });

  it('cancel() stops animation loop', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    scheduler.cancel();
    expect(scheduler.isAnimating()).toBe(false);
    fireRaf(16);
    expect(callback).not.toHaveBeenCalled();
  });

  it('animation loop survives many frames', () => {
    const callback = vi.fn();
    const scheduler = new RenderScheduler(callback);

    scheduler.setAnimationLoop(true);
    for (let i = 0; i < 10; i++) {
      fireRaf(i * 16.67);
    }
    expect(callback).toHaveBeenCalledTimes(10);
    scheduler.setAnimationLoop(false);
  });
});
