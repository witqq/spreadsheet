// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import type { CellStyle } from '../types/interfaces';

/**
 * Compute a deterministic hash for a CellStyle object.
 * Sorts keys to ensure identical styles produce identical hashes.
 */
function computeStyleHash(style: CellStyle): string {
  const parts: string[] = [];
  const keys = Object.keys(style).sort();
  for (const key of keys) {
    const value = style[key as keyof CellStyle];
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        // Border objects — sort their keys too
        const subKeys = Object.keys(value).sort();
        const subParts = subKeys
          .map((sk) => `${sk}:${(value as unknown as Record<string, unknown>)[sk]}`)
          .join(',');
        parts.push(`${key}={${subParts}}`);
      } else {
        parts.push(`${key}:${value}`);
      }
    }
  }
  return parts.join('|');
}

/**
 * Flyweight style pool that deduplicates CellStyle objects by content.
 * Returns a ref string for each interned style.
 * Multiple identical styles share the same ref.
 */
export class StylePool {
  private readonly pool = new Map<string, CellStyle>();

  get size(): number {
    return this.pool.size;
  }

  /**
   * Intern a style: if an identical style exists, return its ref.
   * Otherwise store the style and return a new ref.
   */
  intern(style: CellStyle): string {
    const hash = computeStyleHash(style);
    if (!this.pool.has(hash)) {
      this.pool.set(hash, Object.freeze({ ...style }));
    }
    return hash;
  }

  /**
   * Resolve a ref to its CellStyle.
   */
  resolve(ref: string): CellStyle | undefined {
    return this.pool.get(ref);
  }

  has(ref: string): boolean {
    return this.pool.has(ref);
  }

  clear(): void {
    this.pool.clear();
  }
}
