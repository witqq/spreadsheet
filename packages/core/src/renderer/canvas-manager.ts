// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * CanvasManager — manages a single DPI-aware Canvas element.
 *
 * Responsibilities:
 * - Create and configure the <canvas> element with comprehensive CSS reset
 * - Handle DPI scaling (devicePixelRatio) for crisp rendering on Retina displays
 * - Watch for DPR changes (browser zoom) via matchMedia
 * - Provide access to the 2D rendering context
 * - Handle resize when container size changes
 */

export interface CanvasManagerConfig {
  /** Container element to attach canvas to */
  container: HTMLElement;
  /** Device pixel ratio override (defaults to window.devicePixelRatio) */
  dpr?: number;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly container: HTMLElement;
  private dpr: number;
  private cssWidth = 0;
  private cssHeight = 0;
  private dprMediaQuery: MediaQueryList | null = null;
  private dprChangeHandler: (() => void) | null = null;
  private onDprChange: (() => void) | null = null;

  constructor(config: CanvasManagerConfig) {
    this.container = config.container;
    this.dpr = config.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);

    // Ensure container has position for absolute child
    const containerStyle = this.container.style;
    if (!containerStyle.position || containerStyle.position === 'static') {
      containerStyle.position = 'relative';
    }

    this.canvas = document.createElement('canvas');

    // Comprehensive CSS reset — prevents external CSS (Starlight, Bootstrap, etc.)
    // from affecting canvas positioning or dimensions
    const s = this.canvas.style;
    s.display = 'block';
    s.position = 'absolute';
    s.top = '0';
    s.left = '0';
    s.margin = '0';
    s.padding = '0';
    s.border = 'none';
    s.outline = 'none';
    s.boxSizing = 'border-box';
    s.minWidth = '0';
    s.minHeight = '0';
    s.maxWidth = 'none';
    s.maxHeight = 'none';
    s.float = 'none';
    s.transform = 'none';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get Canvas 2D context');
    }
    this.ctx = ctx;

    this.container.appendChild(this.canvas);
    this.syncSize();

    // Watch for devicePixelRatio changes (browser zoom)
    if (!config.dpr && typeof window !== 'undefined' && typeof matchMedia !== 'undefined') {
      this.watchDpr();
    }
  }

  /**
   * Watch for devicePixelRatio changes using matchMedia.
   */
  private watchDpr(): void {
    this.cleanupDprWatch();

    const mq = matchMedia(`(resolution: ${this.dpr}dppx)`);
    this.dprMediaQuery = mq;

    this.dprChangeHandler = () => {
      const newDpr = window.devicePixelRatio;
      if (newDpr !== this.dpr) {
        this.dpr = newDpr;
        this.syncSize();
        this.onDprChange?.();
        this.watchDpr();
      }
    };

    mq.addEventListener('change', this.dprChangeHandler);
  }

  private cleanupDprWatch(): void {
    if (this.dprMediaQuery && this.dprChangeHandler) {
      this.dprMediaQuery.removeEventListener('change', this.dprChangeHandler);
      this.dprMediaQuery = null;
      this.dprChangeHandler = null;
    }
  }

  /** Set callback for when devicePixelRatio changes (browser zoom). */
  setDprChangeCallback(callback: () => void): void {
    this.onDprChange = callback;
  }

  /**
   * Synchronize canvas size with container dimensions.
   * CSS size = container size, pixel size = CSS size * devicePixelRatio.
   */
  syncSize(): void {
    const rect = this.container.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;

    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);

    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getDpr(): number {
    return this.dpr;
  }

  getCssWidth(): number {
    return this.cssWidth;
  }

  getCssHeight(): number {
    return this.cssHeight;
  }

  getPixelWidth(): number {
    return this.canvas.width;
  }

  getPixelHeight(): number {
    return this.canvas.height;
  }

  destroy(): void {
    this.cleanupDprWatch();
    this.onDprChange = null;
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
