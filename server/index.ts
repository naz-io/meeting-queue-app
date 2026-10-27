import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../src/types/realtime.ts';
import { MeetingStore } from './meetingStore.ts';

const port = Number(process.env.PORT) || 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: true, credentials: true },
});

const store = new MeetingStore((roomCode, state) => {
  io.to(roomCode).emit('meeting-state', state);
});

function getLanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')) {
        return entry.address;
      }
    }
  }
  return null;
}

function getPublicBaseUrl(origin?: string) {
  const configuredUrl = process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  if (origin) {
    try {
      const url = new URL(origin);
      if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return url.origin;
      const lanAddress = getLanAddress();
      if (lanAddress) {
        url.hostname = lanAddress;
        return url.origin;
      }
    } catch {
      // Fall through to the server's own LAN address.
    }
  }

  const lanAddress = getLanAddress();
  return lanAddress ? `http://${lanAddress}:${port}` : `http://localhost:${port}`;
}

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received. Closing the meeting server…`);

  const forceExitTimer = setTimeout(() => {
    console.error('Server shutdown timed out; forcing exit.');
    httpServer.closeAllConnections();
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  // Stop accepting commands, then save anything still waiting for the debounced write.
  io.close();
  await store.flush();
  console.log('Meeting state saved.');
  httpServer.close(() => {
    console.log('Meeting server stopped. Port released.');
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing server before starting another one.`);
  } else {
    console.error('Meeting server failed:', error);
  }
  process.exit(1);
});

await store.initialize();

io.on('connection', (socket) => {
  socket.on('join-room', (request, callback) => {
    const state = store.getSnapshot(request.roomCode);
    const roomCode = state.roomCode;
    if (!store.authorizeParticipant(roomCode, request.participantId, request.participantToken)) {
      callback({ ok: false, error: 'This participant identity is already in use on another device.' });
      return;
    }
    socket.join(roomCode);
    callback({
      ok: true,
      state,
      publicBaseUrl: getPublicBaseUrl(socket.handshake.headers.origin),
      moderatorAuthorized: store.isModerator(roomCode, request.moderatorToken),
    });
  });

  socket.on('authenticate-moderator', (request, callback) => {
    const token = store.authenticateModerator(request.roomCode, request.pin);
    if (!token) {
      callback({ ok: false, error: 'Incorrect moderator PIN.' });
      return;
    }
    callback({ ok: true, moderatorToken: token });
  });

  socket.on('meeting-command', (command, callback) => {
    const response = store.handleCommand(command);
    callback?.(response);
    if (!response.ok && response.error) socket.emit('server-error', response.error);
  });
});

const directory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(directory, '../dist');
app.use(express.static(distDirectory));
app.use((_request, response) => response.sendFile(path.join(distDirectory, 'index.html')));

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Meeting Queue server listening on http://localhost:${port}`);
  console.log(`Public URL: ${getPublicBaseUrl()}/?room=MEET-7892`);
  if (!process.env.MODERATOR_PIN) {
    console.log('Moderator PIN: 7892 (set MODERATOR_PIN to change it)');
  }
});
