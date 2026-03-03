// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * Transport interface for OT communication.
 * Abstract — can be implemented over WebSocket, HTTP, mock, etc.
 */

import type { VersionedOperation } from './ot-types';

export interface OTTransport {
  /** Send a local operation to the server */
  send(op: VersionedOperation): void;

  /** Register handler for receiving remote operations */
  onReceive(handler: (op: VersionedOperation) => void): void;

  /** Register handler for server acknowledgment of local op */
  onAck(handler: (revision: number) => void): void;

  /** Disconnect and clean up */
  disconnect(): void;
}

/**
 * Mock transport for testing — connects two clients directly.
 */
export class MockTransport implements OTTransport {
  private receiveHandlers: Array<(op: VersionedOperation) => void> = [];
  private ackHandlers: Array<(revision: number) => void> = [];
  private peer: MockTransport | null = null;
  private revision = 0;

  /** Connect two mock transports to each other */
  static createPair(): [MockTransport, MockTransport] {
    const a = new MockTransport();
    const b = new MockTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(op: VersionedOperation): void {
    const serverRevision = ++this.revision;

    // Ack the sender
    for (const handler of this.ackHandlers) {
      handler(serverRevision);
    }

    // Deliver to peer
    if (this.peer) {
      const remoteOp: VersionedOperation = {
        ...op,
        revision: serverRevision,
      };
      for (const handler of this.peer.receiveHandlers) {
        handler(remoteOp);
      }
    }
  }

  onReceive(handler: (op: VersionedOperation) => void): void {
    this.receiveHandlers.push(handler);
  }

  onAck(handler: (revision: number) => void): void {
    this.ackHandlers.push(handler);
  }

  disconnect(): void {
    this.receiveHandlers = [];
    this.ackHandlers = [];
    this.peer = null;
  }
}
