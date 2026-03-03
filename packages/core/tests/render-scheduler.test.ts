import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderScheduler } from '../src/renderer/render-scheduler';

describe('RenderScheduler', () => {
  let origRAF: typeof globalThis.requestAnimationFrame;
  let origCAF: typeof globalThis.cancelAnimationFrame;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  beforeEach(() => {
    origRAF = globalThis.requestAnimationFrame;
    origCAF = globalThis.cancelAnimationFrame;
    rafCallbacks = new Map();
    nextRafId = 1;

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
  });

  function flushRAF() {
    for (const [id, cb] of rafCallbacks) {
      rafCallbacks.delete(id);
      cb(performance.now());
    }
  }

  it('calls render callback on animation frame', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    scheduler.requestRender();
    expect(renderFn).not.toHaveBeenCalled();

    flushRAF();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('coalesces multiple requestRender calls into single render', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

    flushRAF();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('allows new render requests after frame fires', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    scheduler.requestRender();
    flushRAF();
    expect(renderFn).toHaveBeenCalledTimes(1);

    scheduler.requestRender();
    flushRAF();
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it('cancel prevents pending render', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    scheduler.requestRender();
    expect(scheduler.isPending()).toBe(true);

    scheduler.cancel();
    expect(scheduler.isPending()).toBe(false);
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();

    flushRAF();
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('isPending reflects current state', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    expect(scheduler.isPending()).toBe(false);

    scheduler.requestRender();
    expect(scheduler.isPending()).toBe(true);

    flushRAF();
    expect(scheduler.isPending()).toBe(false);
  });

  it('cancel is safe when no render is pending', () => {
    const renderFn = vi.fn();
    const scheduler = new RenderScheduler(renderFn);

    // Should not throw
    scheduler.cancel();
    expect(scheduler.isPending()).toBe(false);
  });
});
