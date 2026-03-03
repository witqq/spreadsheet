// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { RenderLayer, RenderContext } from '../render-layer';

export class BackgroundLayer implements RenderLayer {
  render(rc: RenderContext): void {
    // No scroll offset — background always fills the entire visible canvas
    rc.ctx.fillStyle = rc.theme.colors.background;
    rc.ctx.fillRect(0, 0, rc.canvasWidth, rc.canvasHeight);
  }
}
