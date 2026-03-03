// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * DOM-based progress overlay for ProgressiveLoaderPlugin.
 *
 * Creates an absolute-positioned div over the table container showing:
 * - Large percentage text with counting animation
 * - Animated progress bar (determinate during loading, indeterminate during processing)
 * - Row count detail text
 *
 * Fades out with CSS transition when loading completes, revealing the table.
 */
export class ProgressOverlay {
  private el: HTMLDivElement | null = null;
  private barFill: HTMLDivElement | null = null;
  private pctText: HTMLDivElement | null = null;
  private detailText: HTMLDivElement | null = null;
  private shimmer: HTMLDivElement | null = null;
  private phase: 'loading' | 'processing' | 'done' = 'loading';
  private styleEl: HTMLStyleElement | null = null;

  /** Mount the overlay into a container element (position:relative expected). */
  mount(container: HTMLElement): void {
    this.injectStyles();

    const el = document.createElement('div');
    el.className = 'wit-progress-overlay';
    el.innerHTML = `
      <div class="wit-progress-content">
        <div class="wit-progress-pct">0%</div>
        <div class="wit-progress-bar">
          <div class="wit-progress-bar-fill"></div>
          <div class="wit-progress-bar-shimmer"></div>
        </div>
        <div class="wit-progress-detail">Preparing…</div>
      </div>
    `;

    this.el = el;
    this.barFill = el.querySelector('.wit-progress-bar-fill');
    this.pctText = el.querySelector('.wit-progress-pct');
    this.detailText = el.querySelector('.wit-progress-detail');
    this.shimmer = el.querySelector('.wit-progress-bar-shimmer');

    container.style.position = 'relative';
    container.appendChild(el);
  }

  setProgress(loaded: number, total: number): void {
    if (!this.el) return;
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
    const fraction = total > 0 ? loaded / total : 0;

    if (this.pctText) this.pctText.textContent = `${pct}%`;
    if (this.barFill) this.barFill.style.width = `${fraction * 100}%`;
    if (this.detailText) {
      this.detailText.textContent = `${loaded.toLocaleString()} / ${total.toLocaleString()} rows`;
    }

    if (fraction >= 1 && this.phase === 'loading') {
      this.setPhase('processing');
    }
  }

  setPhase(phase: 'loading' | 'processing' | 'done'): void {
    this.phase = phase;
    if (!this.el) return;

    if (phase === 'processing') {
      this.el.classList.add('wit-progress-processing');
      if (this.pctText) this.pctText.textContent = 'Processing…';
      if (this.shimmer) this.shimmer.style.display = 'none';
    } else if (phase === 'done') {
      this.el.classList.add('wit-progress-done');
      // Remove from DOM after fade-out transition
      setTimeout(() => this.destroy(), 600);
    }
  }

  destroy(): void {
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
    if (this.styleEl?.parentElement) {
      this.styleEl.parentElement.removeChild(this.styleEl);
    }
    this.el = null;
    this.barFill = null;
    this.pctText = null;
    this.detailText = null;
    this.shimmer = null;
    this.styleEl = null;
  }

  private injectStyles(): void {
    if (document.querySelector('#wit-progress-styles')) return;
    const style = document.createElement('style');
    style.id = 'wit-progress-styles';
    // Dark is default. Light mode ONLY activates via explicit data-theme="light" on <html>.
    // No prefers-color-scheme — host app controls theming via data-theme attribute.
    style.textContent = `
      .wit-progress-overlay {
        position: absolute;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.82);
        backdrop-filter: blur(4px);
        opacity: 1;
        transition: opacity 0.5s ease;
      }
      :root[data-theme="light"] .wit-progress-overlay {
        background: rgba(241, 245, 249, 0.88);
      }
      .wit-progress-done {
        opacity: 0;
        pointer-events: none;
      }
      .wit-progress-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 70%;
        max-width: 420px;
      }
      .wit-progress-pct {
        font-size: 2.5rem;
        font-weight: 700;
        color: #e2e8f0;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
        transition: font-size 0.3s ease;
      }
      :root[data-theme="light"] .wit-progress-pct { color: #1e293b; }
      .wit-progress-processing .wit-progress-pct {
        font-size: 1.4rem;
      }
      .wit-progress-bar {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: rgba(255,255,255,0.1);
        overflow: hidden;
        position: relative;
      }
      :root[data-theme="light"] .wit-progress-bar { background: rgba(0,0,0,0.08); }
      .wit-progress-bar-fill {
        height: 100%;
        width: 0%;
        border-radius: 3px;
        background: #3b82f6;
        transition: width 0.15s linear;
      }
      .wit-progress-processing .wit-progress-bar-fill {
        width: 100% !important;
        animation: wit-indeterminate 1.2s ease-in-out infinite;
        transform-origin: left;
      }
      @keyframes wit-indeterminate {
        0% { transform: scaleX(0.3) translateX(-20%); }
        50% { transform: scaleX(0.5) translateX(100%); }
        100% { transform: scaleX(0.3) translateX(340%); }
      }
      .wit-progress-bar-shimmer {
        position: absolute;
        top: 0;
        left: 0;
        width: 60px;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        animation: wit-shimmer 1.5s ease-in-out infinite;
      }
      @keyframes wit-shimmer {
        0% { transform: translateX(-60px); }
        100% { transform: translateX(420px); }
      }
      .wit-progress-detail {
        font-size: 0.85rem;
        font-weight: 500;
        color: rgba(255,255,255,0.5);
      }
      :root[data-theme="light"] .wit-progress-detail { color: rgba(0,0,0,0.45); }
    `;
    document.head.appendChild(style);
    this.styleEl = style;
  }
}
