// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/events/event-bus';
import type { CellEvent } from '../src/events/event-types';

describe('EventBus', () => {
  it('dispatches event to registered handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('cellClick', handler);

    const event: CellEvent = {
      row: 0,
      col: 1,
      value: 'test',
      column: { key: 'a', title: 'A', width: 100 },
    };
    bus.emit('cellClick', event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('dispatches to multiple handlers for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('cellClick', h1);
    bus.on('cellClick', h2);

    bus.emit('cellClick', {
      row: 0,
      col: 0,
      value: null,
      column: { key: 'a', title: 'A', width: 100 },
    });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not dispatch to handlers of other events', () => {
    const bus = new EventBus();
    const clickHandler = vi.fn();
    const dblClickHandler = vi.fn();
    bus.on('cellClick', clickHandler);
    bus.on('cellDoubleClick', dblClickHandler);

    bus.emit('cellClick', {
      row: 0,
      col: 0,
      value: null,
      column: { key: 'a', title: 'A', width: 100 },
    });

    expect(clickHandler).toHaveBeenCalledOnce();
    expect(dblClickHandler).not.toHaveBeenCalled();
  });

  it('removes handler with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('cellClick', handler);
    bus.off('cellClick', handler);

    bus.emit('cellClick', {
      row: 0,
      col: 0,
      value: null,
      column: { key: 'a', title: 'A', width: 100 },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles emit with no listeners gracefully', () => {
    const bus = new EventBus();
    expect(() => {
      bus.emit('cellClick', {
        row: 0,
        col: 0,
        value: null,
        column: { key: 'a', title: 'A', width: 100 },
      });
    }).not.toThrow();
  });

  it('handles off() for non-registered event gracefully', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    expect(() => bus.off('cellClick', handler)).not.toThrow();
  });

  it('dispatches events with no arguments (ready, destroy)', () => {
    const bus = new EventBus();
    const readyHandler = vi.fn();
    const destroyHandler = vi.fn();
    bus.on('ready', readyHandler);
    bus.on('destroy', destroyHandler);

    bus.emit('ready');
    bus.emit('destroy');

    expect(readyHandler).toHaveBeenCalledOnce();
    expect(destroyHandler).toHaveBeenCalledOnce();
  });

  it('clears all handlers on destroy()', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('cellClick', h1);
    bus.on('ready', h2);

    bus.destroy();

    bus.emit('cellClick', {
      row: 0,
      col: 0,
      value: null,
      column: { key: 'a', title: 'A', width: 100 },
    });
    bus.emit('ready');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('dispatches gridMouseDown internal event', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('gridMouseDown', handler);

    bus.emit('gridMouseDown', {
      region: 'cell',
      row: 5,
      col: 3,
      originalEvent: new MouseEvent('mousedown'),
      shiftKey: false,
      ctrlKey: false,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].row).toBe(5);
    expect(handler.mock.calls[0][0].col).toBe(3);
  });

  it('dispatches gridKeyDown internal event', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('gridKeyDown', handler);

    bus.emit('gridKeyDown', {
      originalEvent: new KeyboardEvent('keydown', { key: 'ArrowDown' }),
      key: 'ArrowDown',
      shiftKey: false,
      ctrlKey: false,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].key).toBe('ArrowDown');
  });
});
