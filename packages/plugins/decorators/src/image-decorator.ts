// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type {
  CellData,
  CellDecorator,
  SpreadsheetTheme,
} from '@witqq/spreadsheet';
import type { ImageManager } from '@witqq/spreadsheet';

export interface ImageDecoratorOptions {
  /** Thumbnail size in pixels. Default: 24 */
  size?: number;
  /** Metadata field containing the image URL. Default: 'imageUrl' */
  urlField?: string;
  /** Border radius for the thumbnail. Default: 2 */
  borderRadius?: number;
}

const DEFAULT_SIZE = 24;
const DEFAULT_FIELD = 'imageUrl';
const DEFAULT_RADIUS = 2;
const PLACEHOLDER_COLOR = '#E0E0E0';

/**
 * Renders a thumbnail image using ImageManager for async loading.
 * Image URL from cell metadata. Shows placeholder while loading.
 */
export class ImageDecorator implements CellDecorator {
  readonly id = 'image-thumbnail';
  readonly position = 'left' as const;

  private readonly size: number;
  private readonly urlField: string;
  private readonly borderRadius: number;
  private imageManager: ImageManager | null = null;

  constructor(options: ImageDecoratorOptions = {}) {
    this.size = options.size ?? DEFAULT_SIZE;
    this.urlField = options.urlField ?? DEFAULT_FIELD;
    this.borderRadius = options.borderRadius ?? DEFAULT_RADIUS;
  }

  /** Set the ImageManager instance. Called by the plugin during install. */
  setImageManager(manager: ImageManager): void {
    this.imageManager = manager;
  }

  getWidth(): number {
    return this.size + 4; // 2px padding on each side
  }

  render(
    ctx: CanvasRenderingContext2D,
    cellData: CellData,
    x: number,
    y: number,
    _width: number,
    height: number,
    _theme: SpreadsheetTheme,
  ): void {
    const url = this.getUrl(cellData);
    if (!url) return;

    const imgY = y + (height - this.size) / 2;
    const imgX = x + 2;

    const img = this.imageManager?.getImage(url) ?? null;

    if (img) {
      ctx.save();
      if (this.borderRadius > 0) {
        this.clipRoundRect(ctx, imgX, imgY, this.size, this.size, this.borderRadius);
      }
      ctx.drawImage(img, imgX, imgY, this.size, this.size);
      ctx.restore();
    } else {
      // Placeholder rectangle
      ctx.fillStyle = PLACEHOLDER_COLOR;
      if (this.borderRadius > 0) {
        this.fillRoundRect(ctx, imgX, imgY, this.size, this.size, this.borderRadius);
      } else {
        ctx.fillRect(imgX, imgY, this.size, this.size);
      }
    }
  }

  private getUrl(cellData: CellData): string | undefined {
    const meta = cellData.metadata;
    if (!meta) return undefined;
    const url = meta[this.urlField];
    return typeof url === 'string' && url.length > 0 ? url : undefined;
  }

  private clipRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.clip();
  }

  private fillRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}
