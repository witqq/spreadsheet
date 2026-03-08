/**
 * Minimal WebSocket relay server for OT collaboration.
 *
 * Receives operations from clients, applies server-side transformation,
 * assigns revision numbers, and broadcasts to all other connected clients.
 * Also relays cursor position updates between clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { transform } from '../../plugins/src/collaboration/ot-engine';
import type { OTOperation, VersionedOperation } from '../../plugins/src/collaboration/ot-types';

export interface ClientInfo {
  id: string;
  ws: WebSocket;
  color: string;
  name: string;
  cursor: { row: number; col: number } | null;
}

export interface ServerMessage {
  type: 'op' | 'ack' | 'cursor' | 'join' | 'leave' | 'init';
  [key: string]: unknown;
}

const CURSOR_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#34495e',
];

export function createCollabServer(port: number): {
  wss: WebSocketServer;
  close: () => void;
} {
  const wss = new WebSocketServer({ port });
  const clients = new Map<string, ClientInfo>();
  const history: VersionedOperation[] = [];
  let nextRevision = 1;
  let colorIndex = 0;

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
    colorIndex++;

    const client: ClientInfo = {
      id: clientId,
      ws,
      color,
      name: `User ${clients.size + 1}`,
      cursor: null,
    };
    clients.set(clientId, client);

    // Send init message with client info and current cursors
    const cursors = Array.from(clients.values())
      .filter((c) => c.id !== clientId && c.cursor)
      .map((c) => ({
        clientId: c.id,
        color: c.color,
        name: c.name,
        cursor: c.cursor,
      }));

    send(ws, {
      type: 'init',
      clientId,
      color,
      revision: nextRevision - 1,
      cursors,
    });

    // Notify others of new client
    broadcast({ type: 'join', clientId, color, name: client.name }, clientId);

    ws.on('message', (data: Buffer) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === 'op') {
        handleOperation(client, msg);
      } else if (msg.type === 'cursor') {
        handleCursor(client, msg);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      broadcast({ type: 'leave', clientId }, clientId);

      // Reset state when last client disconnects (clean room for next session)
      if (clients.size === 0) {
        history.length = 0;
        nextRevision = 1;
      }
    });
  });

  function handleOperation(client: ClientInfo, msg: ServerMessage): void {
    const op = msg.op;
    const clientRevision = msg.revision;
    if (
      !op ||
      typeof op !== 'object' ||
      typeof (op as Record<string, unknown>).type !== 'string' ||
      typeof clientRevision !== 'number'
    ) {
      return;
    }

    // Transform against all ops since client's revision
    let transformedOp: OTOperation | null = op as OTOperation;
    for (let i = clientRevision; i < history.length; i++) {
      if (!transformedOp) break;
      const [newOp] = transform(transformedOp, history[i].op);
      transformedOp = newOp;
    }

    if (!transformedOp) {
      // Op became no-op — still ack
      send(client.ws, { type: 'ack', revision: nextRevision - 1 });
      return;
    }

    const revision = nextRevision++;
    const versionedOp: VersionedOperation = {
      clientId: client.id,
      revision,
      op: transformedOp,
    };
    history.push(versionedOp);

    // Ack sender
    send(client.ws, { type: 'ack', revision });

    // Broadcast to others
    broadcast({ type: 'op', clientId: client.id, revision, op: transformedOp }, client.id);
  }

  function handleCursor(client: ClientInfo, msg: ServerMessage): void {
    const cursor = msg.cursor;
    if (cursor !== null && cursor !== undefined) {
      const c = cursor as Record<string, unknown>;
      if (typeof c !== 'object' || typeof c.row !== 'number' || typeof c.col !== 'number') {
        return;
      }
    }
    client.cursor = (cursor as { row: number; col: number } | null) ?? null;

    broadcast(
      {
        type: 'cursor',
        clientId: client.id,
        color: client.color,
        name: client.name,
        cursor,
      },
      client.id,
    );
  }

  function send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcast(msg: ServerMessage, excludeClientId: string): void {
    const data = JSON.stringify(msg);
    for (const client of clients.values()) {
      if (client.id !== excludeClientId && client.ws.readyState === 1 /* OPEN */) {
        client.ws.send(data);
      }
    }
  }

  return {
    wss,
    close: () => {
      for (const client of clients.values()) {
        client.ws.close();
      }
      clients.clear();
      wss.close();
    },
  };
}
