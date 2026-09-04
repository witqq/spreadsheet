import { vi } from 'vitest';

export function createMockResizeObserver(): typeof ResizeObserver {
  return vi.fn(class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }) as unknown as typeof ResizeObserver;
}
