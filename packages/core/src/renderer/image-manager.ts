// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ImageManager — async HTMLImageElement loading with LRU cache.
 *
 * Provides synchronous `getImage()` that returns cached images immediately
 * or triggers a background load. When an image finishes loading, the
 * `onLoad` callback (typically `requestRender()`) is called to refresh
 * the display.
 *
 * Uses an LRU (Least Recently Used) eviction strategy to bound memory.
 */

export interface ImageManagerOptions {
  /** Maximum number of cached images. Default: 100. */
  readonly maxSize?: number;
  /** Called when an image finishes loading (to trigger re-render). */
  readonly onLoad?: () => void;
}

interface CacheEntry {
  image: HTMLImageElement;
  loaded: boolean;
  error: boolean;
}

export class ImageManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly onLoad: (() => void) | undefined;

  constructor(options: ImageManagerOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.onLoad = options.onLoad;
  }

  /**
   * Get a cached image synchronously.
   * Returns the HTMLImageElement if loaded and cached, or `null` if not yet
   * available. Triggers a background load if the URL is not in the cache.
   */
  getImage(url: string): HTMLImageElement | null {
    const entry = this.cache.get(url);
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(url);
      this.cache.set(url, entry);
      return entry.loaded && !entry.error ? entry.image : null;
    }
    // Not in cache — trigger background load
    this.loadImage(url);
    return null;
  }

  /**
   * Preload a batch of image URLs into the cache.
   * Returns a promise that resolves when all images have loaded or failed.
   */
  preload(urls: readonly string[]): Promise<void> {
    const promises = urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          if (this.cache.has(url)) {
            resolve();
            return;
          }
          const img = new Image();
          const entry: CacheEntry = { image: img, loaded: false, error: false };
          this.evictIfNeeded();
          this.cache.set(url, entry);

          img.onload = () => {
            entry.loaded = true;
            this.onLoad?.();
            resolve();
          };
          img.onerror = () => {
            entry.error = true;
            resolve();
          };
          img.src = url;
        }),
    );
    return Promise.all(promises).then(() => undefined);
  }

  /** Check whether a URL is in the cache and loaded. */
  has(url: string): boolean {
    const entry = this.cache.get(url);
    return entry !== undefined && entry.loaded && !entry.error;
  }

  /** Number of entries currently in the cache (loaded + loading). */
  get size(): number {
    return this.cache.size;
  }

  /** Remove a specific URL from the cache. */
  evict(url: string): void {
    this.cache.delete(url);
  }

  /** Clear all cached images. */
  clear(): void {
    this.cache.clear();
  }

  private loadImage(url: string): void {
    const img = new Image();
    const entry: CacheEntry = { image: img, loaded: false, error: false };
    this.evictIfNeeded();
    this.cache.set(url, entry);

    img.onload = () => {
      entry.loaded = true;
      this.onLoad?.();
    };
    img.onerror = () => {
      entry.error = true;
    };
    img.src = url;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxSize) {
      // Evict the least recently used (first key in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }
}
