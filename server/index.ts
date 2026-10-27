import { randomInt } from 'node:crypto';
import { startServer, type MeetingServer } from './app.ts';

// Process entry point: reads the environment, prints startup details and handles Control+C.
// Everything that can be tested without a real process lives in app.ts.

const DEV_MODERATOR_PIN = '7892';
const isDevMode = process.argv.includes('--dev');

// MEETING_SERVER_PORT is ours. The generic PORT is honoured only outside dev mode, where hosting
// tools set it on purpose; in dev it usually belongs to Vite and must not move this server.
const port = Number(process.env.MEETING_SERVER_PORT || (isDevMode ? undefined : process.env.PORT)) || 3000;
const configuredPin = process.env.MODERATOR_PIN?.trim();
// Never fall back to the published dev PIN outside `npm run dev`.
const moderatorPin = configuredPin
  || (isDevMode ? DEV_MODERATOR_PIN : randomInt(0, 1_000_000).toString().padStart(6, '0'));

let server: MeetingServer;
try {
  server = await startServer({
    port,
    moderatorPin,
    publicUrl: process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL,
  });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing server before starting another one.`);
  } else {
    console.error('Meeting server failed:', error);
  }
  process.exit(1);
}

server.httpServer.on('error', (error) => {
  console.error('Meeting server failed:', error);
  process.exit(1);
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received. Closing the meeting server…`);

  const forceExitTimer = setTimeout(() => {
    console.error('Server shutdown timed out; forcing exit.');
    server.httpServer.closeAllConnections();
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  await server.close();
  console.log('Meeting state saved.');
  console.log('Meeting server stopped. Port released.');
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log(`Meeting Queue server listening on http://localhost:${server.port}`);
console.log(`Public URL: ${server.publicBaseUrl()}/?room=MEET-7892`);
if (!configuredPin) {
  if (isDevMode) {
    console.log(`Moderator PIN: ${DEV_MODERATOR_PIN} (development default; set MODERATOR_PIN to change it)`);
  } else {
    console.log('');
    console.log(`  Moderator PIN for this run: ${moderatorPin}`);
    console.log('  It changes on every restart. Set MODERATOR_PIN to keep the same PIN.');
    console.log('');
  }
}
