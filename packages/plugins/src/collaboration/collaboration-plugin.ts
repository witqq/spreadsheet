// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

/**
 * CollaborationPlugin — integrates OT engine with SpreadsheetEngine via plugin system.
 *
 * Captures local cell edits via EventBus → converts to OT operations →
 * sends via transport. Receives remote operations → transforms against
 * local pending → applies to CellStore.
 */

import type { SpreadsheetPlugin, PluginAPI, CellValue } from '@witqq/spreadsheet';
import type { OTOperation, VersionedOperation } from './ot-types';
import type { OTTransport } from './ot-transport';
import type { RemoteCursorLayer } from './cursor-layer';
import { transform } from './ot-engine';

export interface CollaborationPluginConfig {
  /** Unique client identifier */
  clientId: string;
  /** Transport implementation */
  transport: OTTransport;
  /** Optional cursor layer for rendering remote cursors */
  cursorLayer?: RemoteCursorLayer;
  /** Optional callback to send cursor position (for transports that support it) */
  sendCursor?: (cursor: { row: number; col: number } | null) => void;
}

export class CollaborationPlugin implements SpreadsheetPlugin {
  readonly name = 'collaboration';
  readonly version = '0.1.0';

  private api: PluginAPI | null = null;
  private config: CollaborationPluginConfig;
  private pendingOps: OTOperation[] = [];
  private revision = 0;
  private suppressLocal = false;

  constructor(config: CollaborationPluginConfig) {
    this.config = config;
  }

  install(api: PluginAPI): void {
    this.api = api;
    const engine = api.engine;

    // Capture local cell edits
    engine.getEventBus().on('cellChange', this.handleLocalCellChange);

    // Track selection changes for cursor awareness
    if (this.config.sendCursor) {
      engine.getEventBus().on('selectionChange', this.handleSelectionChange);
    }

    // Add cursor render layer if provided
    if (this.config.cursorLayer) {
      engine.addRenderLayer(this.config.cursorLayer);
    }

    // Handle incoming remote operations
    this.config.transport.onReceive(this.handleRemoteOp);

    // Handle server acknowledgment
    this.config.transport.onAck(this.handleAck);
  }

  destroy(): void {
    if (this.api) {
      this.api.engine
        .getEventBus()
        .off('cellChange', this.handleLocalCellChange);
      if (this.config.sendCursor) {
        this.api.engine
          .getEventBus()
          .off('selectionChange', this.handleSelectionChange);
      }
      if (this.config.cursorLayer) {
        this.api.engine.removeRenderLayer(this.config.cursorLayer);
      }
    }
    this.config.transport.disconnect();
    this.pendingOps = [];
    this.api = null;
  }

  /** Get current pending operations count */
  getPendingCount(): number {
    return this.pendingOps.length;
  }

  /** Get current revision */
  getRevision(): number {
    return this.revision;
  }

  // ─── Event handlers ─────────────────────────────────────

  private handleSelectionChange = (event: {
    selection: { activeCell: { row: number; col: number } };
  }): void => {
    const { row, col } = event.selection.activeCell;
    this.config.sendCursor?.({ row, col });
  };

  private handleLocalCellChange = (event: {
    row: number;
    col: number;
    oldValue: unknown;
    newValue: unknown;
  }): void => {
    if (this.suppressLocal) return;

    const op: OTOperation = {
      type: 'setCellValue',
      row: event.row,
      col: event.col,
      value: event.newValue,
      oldValue: event.oldValue,
    };

    this.pendingOps.push(op);

    const versionedOp: VersionedOperation = {
      clientId: this.config.clientId,
      revision: this.revision,
      op,
    };

    this.config.transport.send(versionedOp);
  };

  private handleRemoteOp = (versionedOp: VersionedOperation): void => {
    if (!this.api) return;

    let remoteOp: OTOperation | null = versionedOp.op;

    // Transform remote op against all local pending ops
    const newPending: OTOperation[] = [];
    for (const pendingOp of this.pendingOps) {
      if (!remoteOp) break;
      const [remoteTransformed, pendingTransformed] = transform(
        remoteOp,
        pendingOp,
      );
      remoteOp = remoteTransformed;
      if (pendingTransformed) {
        newPending.push(pendingTransformed);
      }
    }
    this.pendingOps = newPending;

    // Apply transformed remote op to local state
    if (remoteOp) {
      this.applyOp(remoteOp);
    }

    this.revision = versionedOp.revision;
  };

  private handleAck = (revision: number): void => {
    // Remove oldest pending op (server confirmed it)
    if (this.pendingOps.length > 0) {
      this.pendingOps.shift();
    }
    this.revision = revision;
  };

  // ─── Operation application ──────────────────────────────

  private applyOp(op: OTOperation): void {
    if (!this.api) return;
    const engine = this.api.engine;

    // Suppress local event to avoid feedback loop
    this.suppressLocal = true;

    try {
      switch (op.type) {
        case 'setCellValue': {
          const colKey = engine.getConfig().columns[op.col]?.key;
          if (colKey) {
            engine.getCellStore().set(op.row, op.col, {
              value: op.value as CellValue,
            });
            engine.requestRender();
          }
          break;
        }
        case 'insertRow': {
          const currentCount = engine.getRowCount();
          engine.setRowCount(currentCount + op.count);
          engine.requestRender();
          break;
        }
        case 'deleteRow': {
          const currentCount = engine.getRowCount();
          engine.setRowCount(Math.max(0, currentCount - op.count));
          engine.requestRender();
          break;
        }
      }
    } finally {
      this.suppressLocal = false;
    }
  }
}
