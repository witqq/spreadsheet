// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * RenderScheduler — coalesces multiple render requests into a single frame.
 *
 * Uses requestAnimationFrame to ensure only one render executes per frame,
 * regardless of how many subsystems request a render.
 *
 * Pull-based rendering: nothing renders until requestRender() is called.
 */

export class RenderScheduler {
  private dirty = false;
  private rafId: number | null = null;
  private renderCallback: () => void;

  constructor(renderCallback: () => void) {
    this.renderCallback = renderCallback;
  }

  /**
   * Request a render on the next animation frame.
   * Multiple calls before the frame fires are coalesced into one render.
   */
  requestRender(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.rafId = requestAnimationFrame(() => {
      this.dirty = false;
      this.rafId = null;
      this.renderCallback();
    });
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
  }

  /**
   * Whether a render is currently scheduled.
   */
  isPending(): boolean {
    return this.dirty;
  }
}
