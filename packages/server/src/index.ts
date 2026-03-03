import { createCollabServer } from './collab-server';

export { createCollabServer } from './collab-server';
export type { ClientInfo, ServerMessage } from './collab-server';

// CLI entry: start server on port from env or 3151
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const port = parseInt(process.env.WIT_COLLAB_PORT ?? '3151', 10);
  const { close } = createCollabServer(port);
  console.log(`Spreadsheet collaboration server running on ws://localhost:${port}`);

  process.on('SIGINT', () => {
    close();
    process.exit(0);
  });
}
