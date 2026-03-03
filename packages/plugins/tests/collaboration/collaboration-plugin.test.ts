import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollaborationPlugin } from '../../src/collaboration/collaboration-plugin';
import { MockTransport } from '../../src/collaboration/ot-transport';
import type { OTTransport } from '../../src/collaboration/ot-transport';
import type { VersionedOperation } from '../../src/collaboration/ot-types';

// Minimal mocks for SpreadsheetEngine subsystems
function createMockEngine() {
  const listeners = new Map<string, Set<Function>>();
  const cells = new Map<string, unknown>();

  const eventBus = {
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      listeners.get(event)?.delete(handler);
    }),
    emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach((h) => h(...args));
    },
  };

  const cellStore = {
    set: vi.fn((row: number, col: number, data: { value: unknown }) => {
      cells.set(`${row}:${col}`, data.value);
    }),
    get: vi.fn((row: number, col: number) => ({
      value: cells.get(`${row}:${col}`),
    })),
  };

  let rowCount = 100;

  return {
    engine: {
      getEventBus: () => eventBus,
      getCellStore: () => cellStore,
      getConfig: () => ({
        columns: Array.from({ length: 10 }, (_, i) => ({
          key: `col${i}`,
          title: `Col ${i}`,
        })),
      }),
      getRowCount: () => rowCount,
      setRowCount: (n: number) => {
        rowCount = n;
      },
      requestRender: vi.fn(),
    },
    eventBus,
    cellStore,
    cells,
    getRowCount: () => rowCount,
  };
}

function createMockPluginAPI(engine: ReturnType<typeof createMockEngine>) {
  const state = new Map<string, unknown>();
  return {
    engine: engine.engine as any,
    getPluginState: <T>(key: string) => state.get(key) as T | undefined,
    setPluginState: <T>(key: string, value: T) => state.set(key, value),
  };
}

describe('CollaborationPlugin', () => {
  let mockEngine: ReturnType<typeof createMockEngine>;
  let mockTransport: { send: ReturnType<typeof vi.fn>; onReceive: ReturnType<typeof vi.fn>; onAck: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let receiveHandler: (op: VersionedOperation) => void;
  let ackHandler: (revision: number) => void;

  beforeEach(() => {
    mockEngine = createMockEngine();
    mockTransport = {
      send: vi.fn(),
      onReceive: vi.fn((handler) => {
        receiveHandler = handler;
      }),
      onAck: vi.fn((handler) => {
        ackHandler = handler;
      }),
      disconnect: vi.fn(),
    };
  });

  it('installs and registers event listeners', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    const api = createMockPluginAPI(mockEngine);
    plugin.install(api);

    expect(mockEngine.eventBus.on).toHaveBeenCalledWith(
      'cellChange',
      expect.any(Function),
    );
    expect(mockTransport.onReceive).toHaveBeenCalled();
    expect(mockTransport.onAck).toHaveBeenCalled();
  });

  it('captures local cellChange and sends operation', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Simulate local edit
    mockEngine.eventBus.emit('cellChange', {
      row: 2,
      col: 3,
      oldValue: 'old',
      newValue: 'new',
      value: 'new',
      column: { key: 'col3' },
      source: 'user',
    });

    expect(mockTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        op: expect.objectContaining({
          type: 'setCellValue',
          row: 2,
          col: 3,
          value: 'new',
        }),
      }),
    );
    expect(plugin.getPendingCount()).toBe(1);
  });

  it('applies remote setCellValue to CellStore', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Receive remote op
    receiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'remote' },
    });

    expect(mockEngine.cellStore.set).toHaveBeenCalledWith(
      0,
      0,
      expect.objectContaining({ value: 'remote' }),
    );
    expect(plugin.getRevision()).toBe(1);
  });

  it('applies remote insertRow by increasing row count', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    receiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'insertRow', row: 5, count: 3 },
    });

    expect(mockEngine.getRowCount()).toBe(103);
  });

  it('applies remote deleteRow by decreasing row count', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    receiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'deleteRow', row: 5, count: 2 },
    });

    expect(mockEngine.getRowCount()).toBe(98);
  });

  it('handles ack by removing pending op', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Generate local edit → adds to pending
    mockEngine.eventBus.emit('cellChange', {
      row: 0,
      col: 0,
      oldValue: '',
      newValue: 'X',
      value: 'X',
      column: { key: 'col0' },
      source: 'user',
    });
    expect(plugin.getPendingCount()).toBe(1);

    // Server acks
    ackHandler(1);
    expect(plugin.getPendingCount()).toBe(0);
    expect(plugin.getRevision()).toBe(1);
  });

  it('does not emit local event when applying remote op (no feedback loop)', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Receive remote op (should not trigger send)
    receiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'remote' },
    });

    // Transport.send should not have been called (no feedback loop)
    expect(mockTransport.send).not.toHaveBeenCalled();
  });

  it('destroy cleans up listeners and disconnects transport', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));
    plugin.destroy();

    expect(mockEngine.eventBus.off).toHaveBeenCalledWith(
      'cellChange',
      expect.any(Function),
    );
    expect(mockTransport.disconnect).toHaveBeenCalled();
    expect(plugin.getPendingCount()).toBe(0);
  });

  it('ignores remote setCellValue for out-of-range column', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Column index 99 is beyond the 10 configured columns
    receiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'setCellValue', row: 0, col: 99, value: 'bad' },
    });

    // CellStore.set should NOT be called for out-of-range column
    expect(mockEngine.cellStore.set).not.toHaveBeenCalled();
  });

  it('ignores remote ops after destroy (api is null)', () => {
    const plugin = new CollaborationPlugin({
      clientId: 'client-1',
      transport: mockTransport,
    });
    plugin.install(createMockPluginAPI(mockEngine));

    // Save the handler before destroy disconnects it
    const savedReceiveHandler = receiveHandler;

    plugin.destroy();

    // Manually invoke the handler (simulating delayed network message)
    savedReceiveHandler({
      clientId: 'client-2',
      revision: 1,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'late' },
    });

    // Should not crash, and cellStore should not be modified
    expect(mockEngine.cellStore.set).not.toHaveBeenCalled();
  });
});

describe('MockTransport', () => {
  it('delivers messages between peers', () => {
    const [a, b] = MockTransport.createPair();
    const received: VersionedOperation[] = [];
    b.onReceive((op) => received.push(op));

    a.send({
      clientId: 'A',
      revision: 0,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'hello' },
    });

    expect(received).toHaveLength(1);
    expect(received[0].op).toEqual(
      expect.objectContaining({ value: 'hello' }),
    );
  });

  it('sends ack back to sender', () => {
    const [a] = MockTransport.createPair();
    const acks: number[] = [];
    a.onAck((rev) => acks.push(rev));

    a.send({
      clientId: 'A',
      revision: 0,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'hello' },
    });

    expect(acks).toEqual([1]);
  });

  it('disconnect prevents delivery', () => {
    const [a, b] = MockTransport.createPair();
    const received: VersionedOperation[] = [];
    b.onReceive((op) => received.push(op));
    a.disconnect();

    a.send({
      clientId: 'A',
      revision: 0,
      op: { type: 'setCellValue', row: 0, col: 0, value: 'hello' },
    });

    expect(received).toHaveLength(0);
  });
});

describe('Convergence — two simulated clients', () => {
  it('concurrent edits to different cells converge', () => {
    const [transportA, transportB] = MockTransport.createPair();
    const engineA = createMockEngine();
    const engineB = createMockEngine();

    const pluginA = new CollaborationPlugin({
      clientId: 'A',
      transport: transportA,
    });
    const pluginB = new CollaborationPlugin({
      clientId: 'B',
      transport: transportB,
    });

    pluginA.install(createMockPluginAPI(engineA));
    pluginB.install(createMockPluginAPI(engineB));

    // Simulate engine writing local edit + firing event
    engineA.cells.set('0:0', 'A-value');
    engineA.eventBus.emit('cellChange', {
      row: 0,
      col: 0,
      oldValue: '',
      newValue: 'A-value',
      value: 'A-value',
      column: { key: 'col0' },
      source: 'user',
    });

    engineB.cells.set('1:1', 'B-value');
    engineB.eventBus.emit('cellChange', {
      row: 1,
      col: 1,
      oldValue: '',
      newValue: 'B-value',
      value: 'B-value',
      column: { key: 'col1' },
      source: 'user',
    });

    // Both engines should have both values (remote ops applied by plugin)
    expect(engineA.cells.get('0:0')).toBe('A-value');
    expect(engineA.cells.get('1:1')).toBe('B-value');
    expect(engineB.cells.get('0:0')).toBe('A-value');
    expect(engineB.cells.get('1:1')).toBe('B-value');

    pluginA.destroy();
    pluginB.destroy();
  });

  it('concurrent edits to same cell: last-writer-wins', () => {
    const [transportA, transportB] = MockTransport.createPair();
    const engineA = createMockEngine();
    const engineB = createMockEngine();

    const pluginA = new CollaborationPlugin({
      clientId: 'A',
      transport: transportA,
    });
    const pluginB = new CollaborationPlugin({
      clientId: 'B',
      transport: transportB,
    });

    pluginA.install(createMockPluginAPI(engineA));
    pluginB.install(createMockPluginAPI(engineB));

    // Client A edits (0,0) — delivered immediately to B via mock transport
    engineA.cells.set('0:0', 'A-wins');
    engineA.eventBus.emit('cellChange', {
      row: 0,
      col: 0,
      oldValue: '',
      newValue: 'A-wins',
      value: 'A-wins',
      column: { key: 'col0' },
      source: 'user',
    });

    // At this point B already received A's op and wrote 'A-wins'
    // Client B now edits same cell — transform makes A's op null (B wins)
    engineB.cells.set('0:0', 'B-wins');
    engineB.eventBus.emit('cellChange', {
      row: 0,
      col: 0,
      oldValue: 'A-wins',
      newValue: 'B-wins',
      value: 'B-wins',
      column: { key: 'col0' },
      source: 'user',
    });

    // Both should converge to B-wins (last writer wins via OT)
    expect(engineA.cells.get('0:0')).toBe('B-wins');
    expect(engineB.cells.get('0:0')).toBe('B-wins');

    pluginA.destroy();
    pluginB.destroy();
  });
});
