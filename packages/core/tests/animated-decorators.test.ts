// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

import { describe, it, expect, vi } from 'vitest';
import { CellTypeRegistry } from '../src/types/cell-type-registry';
import type { CellDecorator, CellDecoratorRegistration } from '../src/types/cell-type-registry';
import type { CellData } from '../src/types/interfaces';
import type { SpreadsheetTheme } from '../src/themes/theme-types';

function createDecorator(id: string): CellDecorator {
  return {
    id,
    position: 'overlay',
    render: vi.fn(),
  };
}

function alwaysApplies() {
  return true;
}

describe('CellTypeRegistry - animated decorators', () => {
  it('starts with no animated decorators', () => {
    const registry = new CellTypeRegistry();
    expect(registry.hasAnimatedDecorators()).toBe(false);
  });

  it('tracks animated decorator count on add', () => {
    const registry = new CellTypeRegistry();
    const callback = vi.fn();
    registry.setAnimatedChangeCallback(callback);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });

    expect(registry.hasAnimatedDecorators()).toBe(true);
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('tracks animated decorator count on remove', () => {
    const registry = new CellTypeRegistry();
    const callback = vi.fn();
    registry.setAnimatedChangeCallback(callback);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    callback.mockClear();

    registry.removeDecorator('d1');
    expect(registry.hasAnimatedDecorators()).toBe(false);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('non-animated decorators do not affect animation count', () => {
    const registry = new CellTypeRegistry();
    const callback = vi.fn();
    registry.setAnimatedChangeCallback(callback);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
    });

    expect(registry.hasAnimatedDecorators()).toBe(false);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('replacing animated with non-animated decrements count', () => {
    const registry = new CellTypeRegistry();
    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    expect(registry.hasAnimatedDecorators()).toBe(true);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: false,
    });
    expect(registry.hasAnimatedDecorators()).toBe(false);
  });

  it('replacing non-animated with animated increments count', () => {
    const registry = new CellTypeRegistry();
    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
    });
    expect(registry.hasAnimatedDecorators()).toBe(false);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    expect(registry.hasAnimatedDecorators()).toBe(true);
  });

  it('multiple animated decorators: removing one keeps animation active', () => {
    const registry = new CellTypeRegistry();
    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    registry.addDecorator({
      decorator: createDecorator('d2'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    expect(registry.hasAnimatedDecorators()).toBe(true);

    registry.removeDecorator('d1');
    expect(registry.hasAnimatedDecorators()).toBe(true);

    registry.removeDecorator('d2');
    expect(registry.hasAnimatedDecorators()).toBe(false);
  });

  it('removing non-existent decorator is a no-op', () => {
    const registry = new CellTypeRegistry();
    const callback = vi.fn();
    registry.setAnimatedChangeCallback(callback);

    registry.removeDecorator('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });

  it('setAnimatedChangeCallback(null) clears callback', () => {
    const registry = new CellTypeRegistry();
    const callback = vi.fn();
    registry.setAnimatedChangeCallback(callback);
    registry.setAnimatedChangeCallback(null);

    registry.addDecorator({
      decorator: createDecorator('d1'),
      appliesTo: alwaysApplies,
      animated: true,
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('decorator render() receives timestamp parameter', () => {
    const decorator = createDecorator('d1');
    const renderFn = decorator.render as ReturnType<typeof vi.fn>;

    // Simulate what CellTextLayer does — pass timestamp as last param
    const mockCtx = {} as CanvasRenderingContext2D;
    const mockCellData = { value: 'test' } as CellData;
    const mockTheme = {} as SpreadsheetTheme;
    decorator.render(mockCtx, mockCellData, 0, 0, 100, 30, mockTheme, 0, 0, 42.5);

    expect(renderFn).toHaveBeenCalledWith(mockCtx, mockCellData, 0, 0, 100, 30, mockTheme, 0, 0, 42.5);
  });
});
