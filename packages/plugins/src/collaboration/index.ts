// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2025 witqq contributors

export { CollaborationPlugin } from './collaboration-plugin';
export type { CollaborationPluginConfig } from './collaboration-plugin';
export { transform, transformAgainstAll } from './ot-engine';
export type { TransformResult } from './ot-engine';
export type {
  OTOperation,
  SetCellValueOp,
  InsertRowOp,
  DeleteRowOp,
  VersionedOperation,
} from './ot-types';
export { MockTransport } from './ot-transport';
export type { OTTransport } from './ot-transport';
export { WebSocketTransport } from './ws-transport';
export type { WebSocketTransportConfig, CursorInfo } from './ws-transport';
export { RemoteCursorLayer } from './cursor-layer';
export type { RemoteCursor } from './cursor-layer';
