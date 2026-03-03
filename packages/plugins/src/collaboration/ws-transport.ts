// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * WebSocket transport — OTTransport implementation for browser clients.
 *
 * Connects to the collaboration server, sends/receives OT operations,
 * and handles cursor position updates.
 */

import type { OTTransport } from './ot-transport';
import type { OTOperation, VersionedOperation } from './ot-types';

export interface CursorInfo {
  clientId: string;
  color: string;
  name: string;
  cursor: { row: number; col: number } | null;
}

export interface WebSocketTransportConfig {
  url: string;
  onInit?: (data: {
    clientId: string;
    color: string;
    revision: number;
    cursors: CursorInfo[];
  }) => void;
  onCursor?: (info: CursorInfo) => void;
  onJoin?: (info: { clientId: string; color: string; name: string }) => void;
  onLeave?: (info: { clientId: string }) => void;
}

export class WebSocketTransport implements OTTransport {
  private ws: WebSocket | null = null;
  private receiveHandlers: Array<(op: VersionedOperation) => void> = [];
  private ackHandlers: Array<(revision: number) => void> = [];
  private config: WebSocketTransportConfig;
  private clientId = '';

  constructor(config: WebSocketTransportConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));

      this.ws.onmessage = (event: MessageEvent) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data);
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'init':
            this.clientId = msg.clientId as string;
            this.config.onInit?.({
              clientId: msg.clientId as string,
              color: msg.color as string,
              revision: msg.revision as number,
              cursors: msg.cursors as CursorInfo[],
            });
            break;

          case 'op': {
            const vOp: VersionedOperation = {
              clientId: msg.clientId as string,
              revision: msg.revision as number,
              op: msg.op as OTOperation,
            };
            for (const handler of this.receiveHandlers) {
              handler(vOp);
            }
            break;
          }

          case 'ack':
            for (const handler of this.ackHandlers) {
              handler(msg.revision as number);
            }
            break;

          case 'cursor':
            if (msg.clientId && msg.color) {
              this.config.onCursor?.({
                clientId: msg.clientId as string,
                color: msg.color as string,
                name: (msg.name as string) || '',
                cursor: msg.cursor as { row: number; col: number } | null,
              });
            }
            break;

          case 'join':
            if (msg.clientId) {
              this.config.onJoin?.({
                clientId: msg.clientId as string,
                color: (msg.color as string) || '',
                name: (msg.name as string) || '',
              });
            }
            break;

          case 'leave':
            if (msg.clientId) {
              this.config.onLeave?.({ clientId: msg.clientId as string });
            }
            break;
        }
      };
    });
  }

  send(op: VersionedOperation): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'op',
          op: op.op,
          revision: op.revision,
        }),
      );
    }
  }

  sendCursor(cursor: { row: number; col: number } | null): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cursor', cursor }));
    }
  }

  onReceive(handler: (op: VersionedOperation) => void): void {
    this.receiveHandlers.push(handler);
  }

  onAck(handler: (revision: number) => void): void {
    this.ackHandlers.push(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.receiveHandlers = [];
    this.ackHandlers = [];
  }

  getClientId(): string {
    return this.clientId;
  }
}
