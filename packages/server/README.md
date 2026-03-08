# @witqq/spreadsheet-server

WebSocket relay server for real-time OT (Operational Transformation) collaboration. Receives operations from clients, applies server-side transformation, assigns revision numbers, and broadcasts to all connected clients. Also relays cursor position updates.

> **Private package** — not published to npm. Used internally alongside `@witqq/spreadsheet-plugins` `CollaborationPlugin`.

## Quick Start

```bash
# Start with default port 3151
npx tsx packages/server/src/index.ts

# Or with custom port
WIT_COLLAB_PORT=8080 npx tsx packages/server/src/index.ts
```

The CLI entry auto-detects when run directly (checks `process.argv[1]`) and starts the server.

## Exports

### Value Exports (1)

| Export | Kind | Description |
|--------|------|-------------|
| `createCollabServer` | function | Create a WebSocket collaboration server |

### Type Exports (2)

| Type | Description |
|------|-------------|
| `ClientInfo` | Connected client metadata |
| `ServerMessage` | Server-to-client message envelope |

## `createCollabServer(port): { wss, close }`

Create and start a WebSocket collaboration server on the given port.

```typescript
import { createCollabServer } from '@witqq/spreadsheet-server';

const { wss, close } = createCollabServer(3151);

// Later: shut down
close(); // Disconnects all clients and closes the server
```

| Param | Type | Description |
|-------|------|-------------|
| `port` | `number` | WebSocket server port |

Returns:

```typescript
{
  wss: WebSocketServer;  // Underlying ws server instance
  close: () => void;     // Disconnect all clients and close server
}
```

## `ClientInfo`

```typescript
interface ClientInfo {
  id: string;                                  // Auto-generated: "client-{timestamp}-{random}"
  ws: WebSocket;                               // WebSocket connection
  color: string;                               // Assigned cursor color (from 8-color palette)
  name: string;                                // Display name: "User {n}"
  cursor: { row: number; col: number } | null; // Current cursor position
}
```

## `ServerMessage`

```typescript
interface ServerMessage {
  type: 'op' | 'ack' | 'cursor' | 'join' | 'leave' | 'init';
  [key: string]: unknown;
}
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `init` | server → client | Sent on connect: `{ clientId, color, revision, cursors }` |
| `join` | server → others | New client connected: `{ clientId, color, name }` |
| `leave` | server → others | Client disconnected: `{ clientId }` |
| `op` | client → server | Submit operation: `{ op: OTOperation, revision: number }` |
| `op` | server → others | Broadcast transformed operation: `{ clientId, revision, op }` |
| `ack` | server → client | Acknowledge operation: `{ revision }` |
| `cursor` | client → server | Update cursor position: `{ cursor: { row, col } \| null }` |
| `cursor` | server → others | Broadcast cursor update: `{ clientId, color, name, cursor }` |

## Server Behavior

- **OT transformation**: Incoming operations are transformed against all operations since the client's revision using `transform()` from the OT engine.
- **Revision tracking**: Each accepted operation gets an incremented revision number.
- **Color assignment**: Clients receive colors from an 8-color palette (cycles on overflow).
- **Auto-reset**: When the last client disconnects, operation history and revision counter reset.
- **No-op handling**: If transformation reduces an operation to null, the server sends an ack without broadcasting.

## Integration with CollaborationPlugin

```typescript
import { SpreadsheetEngine } from '@witqq/spreadsheet';
import { CollaborationPlugin, WebSocketTransport } from '@witqq/spreadsheet-plugins';

const transport = new WebSocketTransport({ url: 'ws://localhost:3151' });
const collab = new CollaborationPlugin({ transport });

const engine = new SpreadsheetEngine({
  columns: [{ key: 'name', title: 'Name', width: 200 }],
  data: [],
  plugins: [collab],
});
```

See `@witqq/spreadsheet-plugins` README for full `CollaborationPlugin` documentation.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WIT_COLLAB_PORT` | `3151` | Server port (CLI mode only) |

## License

[Business Source License 1.1](https://github.com/witqq/spreadsheet/blob/master/LICENSE). Free for non-commercial use. Change Date: 2030-03-01 → Apache License 2.0.
