import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createCollabServer } from '../src/collab-server';

interface WsMessage {
  type: string;
  clientId?: string;
  color?: string;
  revision?: number;
  op?: unknown;
  cursor?: { row: number; col: number } | null;
  cursors?: unknown[];
  name?: string;
}

interface BufferedWebSocket {
  ws: WebSocket;
  nextMessage(type?: string): Promise<WsMessage>;
  close(): void;
}

function connectClient(port: number): Promise<BufferedWebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const buffer: WsMessage[] = [];
    const waiters: Array<{ type?: string; resolve: (msg: WsMessage) => void }> = [];

    ws.on('message', (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString()) as WsMessage;
      // Check if any waiter matches
      const idx = waiters.findIndex((w) => !w.type || w.type === msg.type);
      if (idx >= 0) {
        const waiter = waiters.splice(idx, 1)[0];
        waiter.resolve(msg);
      } else {
        buffer.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        nextMessage(type?: string): Promise<WsMessage> {
          // Check buffer first
          const idx = buffer.findIndex((m) => !type || m.type === type);
          if (idx >= 0) {
            return Promise.resolve(buffer.splice(idx, 1)[0]);
          }
          return new Promise((res) => {
            waiters.push({ type, resolve: res });
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.on('error', reject);
  });
}

function sendMessage(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

async function startServer(): Promise<{ server: ReturnType<typeof createCollabServer>; port: number }> {
  const server = createCollabServer(0);
  await new Promise<void>((resolve, reject) => {
    server.wss.once('listening', () => resolve());
    server.wss.once('error', reject);
  });
  const addr = server.wss.address();
  if (!addr || typeof addr === 'string') throw new Error('No address');
  return { server, port: addr.port };
}

describe('CollabServer', () => {
  const servers: Array<ReturnType<typeof createCollabServer>> = [];

  afterEach(() => {
    for (const s of servers) s.close();
    servers.length = 0;
  });

  it('sends init message on connection', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c = await connectClient(port);
    const initMsg = await c.nextMessage('init');

    expect(initMsg.type).toBe('init');
    expect(initMsg.clientId).toBeDefined();
    expect(initMsg.color).toBeDefined();
    expect(initMsg.revision).toBe(0);
    expect(initMsg.cursors).toEqual([]);

    c.close();
  });

  it('broadcasts join to other clients', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    await c1.nextMessage('init');

    const joinPromise = c1.nextMessage('join');
    const c2 = await connectClient(port);
    await c2.nextMessage('init');

    const joinMsg = await joinPromise;
    expect(joinMsg.type).toBe('join');
    expect(joinMsg.clientId).toBeDefined();
    expect(joinMsg.name).toBeDefined();

    c1.close();
    c2.close();
  });

  it('broadcasts leave when client disconnects', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    await c1.nextMessage('init');

    const c2 = await connectClient(port);
    const init2 = await c2.nextMessage('init');
    await c1.nextMessage('join');

    const leavePromise = c1.nextMessage('leave');
    c2.close();

    const leaveMsg = await leavePromise;
    expect(leaveMsg.type).toBe('leave');
    expect(leaveMsg.clientId).toBe(init2.clientId);

    c1.close();
  });

  it('relays and transforms operations', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    const init1 = await c1.nextMessage('init');

    const c2 = await connectClient(port);
    await c2.nextMessage('init');
    await c1.nextMessage('join');

    const opPromise = c2.nextMessage('op');
    sendMessage(c1.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 0, col: 0, value: 'hello', oldValue: null },
      revision: init1.revision,
    });

    const ackMsg = await c1.nextMessage('ack');
    expect(ackMsg.type).toBe('ack');
    expect(ackMsg.revision).toBe(1);

    const opMsg = await opPromise;
    expect(opMsg.type).toBe('op');
    expect(opMsg.op).toEqual(
      expect.objectContaining({ type: 'setCellValue', row: 0, col: 0, value: 'hello' }),
    );
    expect(opMsg.revision).toBe(1);

    c1.close();
    c2.close();
  });

  it('transforms conflicting operations on same cell', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    const init1 = await c1.nextMessage('init');

    const c2 = await connectClient(port);
    const init2 = await c2.nextMessage('init');
    await c1.nextMessage('join');

    // c1 sends op on cell (0,0)
    sendMessage(c1.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 0, col: 0, value: 'from-c1', oldValue: null },
      revision: init1.revision,
    });

    await c1.nextMessage('ack');
    await c2.nextMessage('op');

    // c2 sends op on same cell at old revision — server transforms to no-op
    sendMessage(c2.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 0, col: 0, value: 'from-c2', oldValue: null },
      revision: init2.revision,
    });

    // c2 still gets ack (with previous revision since op became no-op)
    const ack2 = await c2.nextMessage('ack');
    expect(ack2.type).toBe('ack');

    c1.close();
    c2.close();
  });

  it('transforms non-conflicting concurrent operations', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    const init1 = await c1.nextMessage('init');

    const c2 = await connectClient(port);
    const init2 = await c2.nextMessage('init');
    await c1.nextMessage('join');

    // c1 edits cell (0,0), c2 edits cell (1,1) — no conflict
    sendMessage(c1.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 0, col: 0, value: 'from-c1', oldValue: null },
      revision: init1.revision,
    });

    await c1.nextMessage('ack');
    await c2.nextMessage('op');

    const opPromise = c1.nextMessage('op');
    sendMessage(c2.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 1, col: 1, value: 'from-c2', oldValue: null },
      revision: init2.revision,
    });

    await c2.nextMessage('ack');
    const opMsg = await opPromise;

    expect(opMsg.type).toBe('op');
    expect(opMsg.revision).toBe(2);

    c1.close();
    c2.close();
  });

  it('relays cursor positions', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    await c1.nextMessage('init');

    const c2 = await connectClient(port);
    await c2.nextMessage('init');
    await c1.nextMessage('join');

    const cursorPromise = c1.nextMessage('cursor');
    sendMessage(c2.ws, { type: 'cursor', cursor: { row: 5, col: 3 } });

    const cursorMsg = await cursorPromise;
    expect(cursorMsg.type).toBe('cursor');
    expect(cursorMsg.cursor).toEqual({ row: 5, col: 3 });
    expect(cursorMsg.clientId).toBeDefined();

    c1.close();
    c2.close();
  });

  it('includes existing cursors in init for new clients', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    await c1.nextMessage('init');

    sendMessage(c1.ws, { type: 'cursor', cursor: { row: 2, col: 4 } });
    await new Promise((r) => setTimeout(r, 50));

    const c2 = await connectClient(port);
    const init2 = await c2.nextMessage('init');

    expect(init2.cursors).toHaveLength(1);
    expect((init2.cursors![0] as WsMessage).cursor).toEqual({ row: 2, col: 4 });

    c1.close();
    c2.close();
  });

  it('assigns unique colors to clients', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    const c1 = await connectClient(port);
    const init1 = await c1.nextMessage('init');

    const c2 = await connectClient(port);
    const init2 = await c2.nextMessage('init');

    expect(init1.color).toBeDefined();
    expect(init2.color).toBeDefined();
    expect(init1.color).not.toBe(init2.color);

    c1.close();
    c2.close();
  });

  it('resets state when last client disconnects', async () => {
    const { server, port } = await startServer();
    servers.push(server);

    // Session 1: two clients, one op
    const c1 = await connectClient(port);
    const init1 = await c1.nextMessage('init');
    expect(init1.revision).toBe(0);

    const c2 = await connectClient(port);
    await c2.nextMessage('init');
    await c1.nextMessage('join');

    sendMessage(c1.ws, {
      type: 'op',
      op: { type: 'setCellValue', row: 0, col: 0, value: 'v1', oldValue: null },
      revision: init1.revision,
    });
    await c1.nextMessage('ack');
    await c2.nextMessage('op');

    // Disconnect both — triggers session reset
    c2.close();
    c1.close();
    await new Promise((r) => setTimeout(r, 100));

    // Session 2: new client should get revision 0 (reset)
    const c3 = await connectClient(port);
    const init3 = await c3.nextMessage('init');
    expect(init3.revision).toBe(0);

    c3.close();
  });
});
