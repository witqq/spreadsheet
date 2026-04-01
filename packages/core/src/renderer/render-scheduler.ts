// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RenderScheduler — coalesces multiple render requests into a single frame.
 *
 * Uses requestAnimationFrame to ensure only one render executes per frame,
 * regardless of how many subsystems request a render.
 *
 * Supports two modes:
 * - **Pull-based** (default): nothing renders until requestRender() is called.
 * - **Continuous** (animation): a persistent rAF loop runs, calling
 *   renderCallback on every frame. Activated/deactivated via
 *   `setAnimationLoop(true/false)`.
 */

export class RenderScheduler {
  private dirty = false;
  private rafId: number | null = null;
  private renderCallback: (timestamp?: number) => void;
  private animating = false;

  constructor(renderCallback: (timestamp?: number) => void) {
    this.renderCallback = renderCallback;
  }

  /**
   * Request a render on the next animation frame.
   * Multiple calls before the frame fires are coalesced into one render.
   * In animation mode, this is a no-op (loop handles rendering).
   */
  requestRender(): void {
    if (this.animating) return;
    if (this.dirty) return;
    this.dirty = true;
    this.rafId = requestAnimationFrame((ts) => {
      this.dirty = false;
      this.rafId = null;
      this.renderCallback(ts);
    });
  }

  /**
   * Enable or disable the continuous animation loop.
   * When enabled, renderCallback fires every frame with a DOMHighResTimeStamp.
   * When disabled, reverts to pull-based mode.
   */
  setAnimationLoop(enabled: boolean): void {
    if (enabled === this.animating) return;
    this.animating = enabled;
    if (enabled) {
      // Cancel any pending one-shot request
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.dirty = false;
      }
      this.animationTick();
    } else {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  /** Whether the continuous animation loop is running. */
  isAnimating(): boolean {
    return this.animating;
  }

  /**
   * Cancel any pending render request.
   */
  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.dirty = false;
    }
    this.animating = false;
  }

  /**
   * Whether a render is currently scheduled.
   */
  isPending(): boolean {
    return this.dirty || this.animating;
  }

  private animationTick(): void {
    if (!this.animating) return;
    this.rafId = requestAnimationFrame((ts) => {
      this.rafId = null;
      if (!this.animating) return;
      this.renderCallback(ts);
      this.animationTick();
    });
  }
}
