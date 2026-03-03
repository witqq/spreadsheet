// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * ScrollManager — provides native scrollbar behavior via a hidden scrollable container.
 *
 * Creates a transparent overlay div with overflow:auto sized to the total content
 * dimensions. The overlay sits above the canvas layers and captures wheel events
 * natively, providing native scrollbar appearance and momentum scrolling on trackpads.
 *
 * Scroll events are forwarded to a callback for viewport computation and re-rendering.
 */

export interface ScrollManagerConfig {
  /** Container element (position: relative parent of canvases). */
  container: HTMLElement;
  /** Total scrollable content width (from LayoutEngine.totalWidth). */
  totalWidth: number;
  /** Total scrollable content height (from LayoutEngine.totalHeight). */
  totalHeight: number;
  /** Callback fired on every scroll position change. */
  onScroll: (scrollX: number, scrollY: number) => void;
}

export class ScrollManager {
  private readonly scrollContainer: HTMLDivElement;
  private readonly spacer: HTMLDivElement;
  private readonly onScrollCallback: (scrollX: number, scrollY: number) => void;
  private _scrollX = 0;
  private _scrollY = 0;

  constructor(config: ScrollManagerConfig) {
    this.onScrollCallback = config.onScroll;

    // Scroll container: transparent overlay that captures wheel events
    this.scrollContainer = document.createElement('div');
    const s = this.scrollContainer.style;
    s.position = 'absolute';
    s.top = '0';
    s.left = '0';
    s.width = '100%';
    s.height = '100%';
    s.overflow = 'auto';
    s.zIndex = '10';
    s.userSelect = 'none';
    s.margin = '0';
    s.padding = '0';
    s.border = 'none';
    // Prevent the scrollable area from showing any content
    s.pointerEvents = 'auto';

    // Spacer div defines total scrollable area
    this.spacer = document.createElement('div');
    this.spacer.style.width = `${config.totalWidth}px`;
    this.spacer.style.height = `${config.totalHeight}px`;
    this.spacer.style.pointerEvents = 'none';

    this.scrollContainer.appendChild(this.spacer);
    config.container.appendChild(this.scrollContainer);

    this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
  }

  private handleScroll = (): void => {
    this._scrollX = this.scrollContainer.scrollLeft;
    this._scrollY = this.scrollContainer.scrollTop;
    this.onScrollCallback(this._scrollX, this._scrollY);
  };

  /** Current horizontal scroll offset in pixels. */
  get scrollX(): number {
    return this._scrollX;
  }

  /** Current vertical scroll offset in pixels. */
  get scrollY(): number {
    return this._scrollY;
  }

  /** Update the spacer dimensions when data size changes. */
  updateContentSize(totalWidth: number, totalHeight: number): void {
    this.spacer.style.width = `${totalWidth}px`;
    this.spacer.style.height = `${totalHeight}px`;
  }

  /** Programmatically scroll to a position. */
  scrollTo(x: number, y: number): void {
    this.scrollContainer.scrollLeft = x;
    this.scrollContainer.scrollTop = y;
  }

  /** Get the scroll container element (for testing or direct access). */
  getElement(): HTMLDivElement {
    return this.scrollContainer;
  }

  destroy(): void {
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    if (this.scrollContainer.parentNode) {
      this.scrollContainer.parentNode.removeChild(this.scrollContainer);
    }
  }
}
