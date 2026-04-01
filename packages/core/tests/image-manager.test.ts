// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageManager } from '../src/renderer/image-manager';

// Mock HTMLImageElement with controllable load/error behavior
function createMockImage() {
  let onload: (() => void) | null = null;
  let onerror: (() => void) | null = null;
  let _src = '';

  const img = {
    get src() {
      return _src;
    },
    set src(value: string) {
      _src = value;
      // Trigger load/error asynchronously to simulate real behavior
      if (value.startsWith('error://')) {
        queueMicrotask(() => onerror?.());
      } else {
        queueMicrotask(() => onload?.());
      }
    },
    set onload(fn: (() => void) | null) {
      onload = fn;
    },
    get onload() {
      return onload;
    },
    set onerror(fn: (() => void) | null) {
      onerror = fn;
    },
    get onerror() {
      return onerror;
    },
  };

  return img as unknown as HTMLImageElement;
}

// Patch global Image to use our mock
const originalImage = globalThis.Image;

describe('ImageManager', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).Image = class {
      constructor() {
        return createMockImage();
      }
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).Image = originalImage;
  });

  it('returns null for uncached images and triggers background load', async () => {
    const mgr = new ImageManager();
    const result = mgr.getImage('https://example.com/img.png');
    expect(result).toBeNull();
    // After microtask, image should be loaded
    await new Promise((r) => queueMicrotask(r));
    const loaded = mgr.getImage('https://example.com/img.png');
    expect(loaded).not.toBeNull();
  });

  it('returns cached image on subsequent calls', async () => {
    const mgr = new ImageManager();
    mgr.getImage('https://example.com/a.png');
    await new Promise((r) => queueMicrotask(r));
    const img = mgr.getImage('https://example.com/a.png');
    expect(img).not.toBeNull();
  });

  it('calls onLoad callback when image loads', async () => {
    const onLoad = vi.fn();
    const mgr = new ImageManager({ onLoad });
    mgr.getImage('https://example.com/b.png');
    expect(onLoad).not.toHaveBeenCalled();
    await new Promise((r) => queueMicrotask(r));
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it('returns null for errored images', async () => {
    const mgr = new ImageManager();
    mgr.getImage('error://bad');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.getImage('error://bad')).toBeNull();
    expect(mgr.has('error://bad')).toBe(false);
  });

  it('has() returns correct status', async () => {
    const mgr = new ImageManager();
    expect(mgr.has('https://example.com/x.png')).toBe(false);
    mgr.getImage('https://example.com/x.png');
    expect(mgr.has('https://example.com/x.png')).toBe(false); // still loading
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.has('https://example.com/x.png')).toBe(true);
  });

  it('tracks cache size', async () => {
    const mgr = new ImageManager();
    expect(mgr.size).toBe(0);
    mgr.getImage('https://example.com/1.png');
    mgr.getImage('https://example.com/2.png');
    expect(mgr.size).toBe(2);
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.size).toBe(2);
  });

  it('evicts LRU entries when cache is full', async () => {
    const mgr = new ImageManager({ maxSize: 3 });
    mgr.getImage('https://example.com/1.png');
    mgr.getImage('https://example.com/2.png');
    mgr.getImage('https://example.com/3.png');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.size).toBe(3);

    // Adding a 4th should evict the oldest (1.png)
    mgr.getImage('https://example.com/4.png');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.size).toBe(3);
    expect(mgr.has('https://example.com/1.png')).toBe(false);
    expect(mgr.has('https://example.com/4.png')).toBe(true);
  });

  it('LRU access refreshes entry position', async () => {
    const mgr = new ImageManager({ maxSize: 3 });
    mgr.getImage('https://example.com/1.png');
    mgr.getImage('https://example.com/2.png');
    mgr.getImage('https://example.com/3.png');
    await new Promise((r) => queueMicrotask(r));

    // Access 1.png to make it most recently used
    mgr.getImage('https://example.com/1.png');

    // Adding 4th should evict 2.png (now oldest), not 1.png
    mgr.getImage('https://example.com/4.png');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.has('https://example.com/1.png')).toBe(true);
    expect(mgr.has('https://example.com/2.png')).toBe(false);
  });

  it('evict() removes specific entry', async () => {
    const mgr = new ImageManager();
    mgr.getImage('https://example.com/a.png');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.has('https://example.com/a.png')).toBe(true);
    mgr.evict('https://example.com/a.png');
    expect(mgr.has('https://example.com/a.png')).toBe(false);
    expect(mgr.size).toBe(0);
  });

  it('clear() removes all entries', async () => {
    const mgr = new ImageManager();
    mgr.getImage('https://example.com/1.png');
    mgr.getImage('https://example.com/2.png');
    await new Promise((r) => queueMicrotask(r));
    expect(mgr.size).toBe(2);
    mgr.clear();
    expect(mgr.size).toBe(0);
  });

  it('preload() loads multiple images', async () => {
    const onLoad = vi.fn();
    const mgr = new ImageManager({ onLoad });
    await mgr.preload(['https://example.com/a.png', 'https://example.com/b.png']);
    expect(mgr.has('https://example.com/a.png')).toBe(true);
    expect(mgr.has('https://example.com/b.png')).toBe(true);
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it('preload() skips already-cached URLs', async () => {
    const onLoad = vi.fn();
    const mgr = new ImageManager({ onLoad });
    mgr.getImage('https://example.com/a.png');
    await new Promise((r) => queueMicrotask(r));
    onLoad.mockClear();

    await mgr.preload(['https://example.com/a.png', 'https://example.com/b.png']);
    // Only b.png triggers onLoad — a.png was already cached
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('preload() resolves even if images error', async () => {
    const mgr = new ImageManager();
    await mgr.preload(['error://bad1', 'error://bad2']);
    expect(mgr.has('error://bad1')).toBe(false);
    expect(mgr.has('error://bad2')).toBe(false);
    expect(mgr.size).toBe(2); // entries exist but are errored
  });
});
