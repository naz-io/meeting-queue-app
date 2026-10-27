import { createServer, type Server as HttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../src/types/realtime.ts';
import { MeetingStore } from './meetingStore.ts';
import { PinAttemptLimiter } from './pinAttempts.ts';

const DIST_DIRECTORY = path.resolve(import.meta.dirname, '../dist');

export interface MeetingServerOptions {
  /** 0 picks any free port, which tests use. */
  port: number;
  host?: string;
  moderatorPin: string;
  dataDirectory?: string;
  /** Overrides the LAN address used in participant links (PUBLIC_URL). */
  publicUrl?: string;
}

export interface MeetingServer {
  /** The port actually bound, useful when `port` was 0. */
  port: number;
  httpServer: HttpServer;
  publicBaseUrl: (origin?: string) => string;
  /** Stops accepting connections, saves pending meeting state and releases the port. */
  close: () => Promise<void>;
}

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

/** Wires Express, Socket.IO and the meeting store together; no process-level side effects. */
export async function startServer(options: MeetingServerOptions): Promise<MeetingServer> {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: true, credentials: true },
  });
  const store = new MeetingStore((roomCode, state) => {
    io.to(roomCode).emit('meeting-state', state);
  }, { moderatorPin: options.moderatorPin, dataDirectory: options.dataDirectory });
  const pinAttempts = new PinAttemptLimiter();
  let boundPort = options.port;

  const publicBaseUrl = (origin?: string) => {
    if (options.publicUrl) return options.publicUrl.replace(/\/$/, '');

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
    return lanAddress ? `http://${lanAddress}:${boundPort}` : `http://localhost:${boundPort}`;
  };

  await store.initialize();

  io.on('connection', (socket) => {
    socket.on('join-room', (request, callback) => {
      const opened = store.openRoom(request.roomCode);
      if (!opened.ok) {
        callback({ ok: false, error: opened.error, code: opened.code });
        return;
      }
      const { roomCode } = opened;
      if (!store.authorizeParticipant(roomCode, request.participantId, request.participantToken)) {
        callback({ ok: false, error: 'This participant identity is already in use on another device.' });
        return;
      }
      socket.join(roomCode);
      callback({
        ok: true,
        state: store.getSnapshot(roomCode) ?? undefined,
        publicBaseUrl: publicBaseUrl(socket.handshake.headers.origin),
        moderatorAuthorized: store.isModerator(roomCode, request.moderatorToken),
      });
    });

    socket.on('authenticate-moderator', (request, callback) => {
      const clientAddress = socket.handshake.address;
      const waitSeconds = pinAttempts.retryAfterSeconds(clientAddress);
      if (waitSeconds > 0) {
        callback({ ok: false, error: `Too many incorrect PINs. Try again in ${waitSeconds} s.` });
        return;
      }
      const token = store.authenticateModerator(request.roomCode, request.pin);
      if (!token) {
        pinAttempts.recordFailure(clientAddress);
        callback({ ok: false, error: 'Incorrect moderator PIN.' });
        return;
      }
      pinAttempts.recordSuccess(clientAddress);
      callback({ ok: true, moderatorToken: token });
    });

    socket.on('meeting-command', (command, callback) => {
      const response = store.handleCommand(command);
      // Clients that pass a callback get the error there; the event is for those that don't.
      if (callback) callback(response);
      else if (!response.ok && response.error) socket.emit('server-error', response.error);
    });
  });

  app.use(express.static(DIST_DIRECTORY));
  // `root` keeps send's dotfile check off the parent folders (e.g. a checkout under ~/.config).
  app.use((_request, response) => response.sendFile('index.html', { root: DIST_DIRECTORY }));

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port, options.host ?? '0.0.0.0', () => {
      httpServer.off('error', reject);
      resolve();
    });
  });
  const address = httpServer.address();
  if (address && typeof address === 'object') boundPort = address.port;

  const close = async () => {
    // Stop accepting commands, then save anything still waiting for the debounced write.
    io.close();
    await store.flush();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { port: boundPort, httpServer, publicBaseUrl, close };
}
