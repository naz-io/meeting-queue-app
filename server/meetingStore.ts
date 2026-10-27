import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MeetingState } from '../shared/meeting.ts';
import type { CommandResponse, PersistedRoom } from '../shared/protocol.ts';
import { DEFAULT_ROOM_CODE, parseRoomCode } from '../shared/roomCode.ts';
import { definitionOf } from './commandHandlers.ts';
import { parseCommand } from './commands.ts';
import { activateBufferedSpeaker, createEmptyState, finishSpeaker, now, type RoomRecord } from './room.ts';

const MODERATOR_SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_MODERATOR_SESSIONS = 20;
const MAX_ROOMS = 50;
const IDLE_ROOM_MS = 24 * 60 * 60 * 1000;
// Next to this file, so starting the server from another folder still uses the same data.
const DEFAULT_DATA_DIRECTORY = path.join(import.meta.dirname, 'data');

type OpenRoomResult =
  | { ok: true; roomCode: string; room: RoomRecord }
  | { ok: false; code: 'invalid-room' | 'room-limit'; error: string };

type Broadcast = (roomCode: string, state: MeetingState) => void;

interface MeetingStoreOptions {
  moderatorPin: string;
  dataDirectory?: string;
}

/** Per-device fields that MeetingState once carried; files saved before their removal still have them. */
const LEGACY_DEVICE_FIELDS = ['activeView', 'currentUserId', 'currentUserName', 'currentUserAvatar'];

function withoutLegacyDeviceFields(state: MeetingState): MeetingState {
  const copy: Record<string, unknown> = { ...state };
  for (const field of LEGACY_DEVICE_FIELDS) delete copy[field];
  return copy as unknown as MeetingState;
}

/** Constant-time comparison, so response timing never hints at how close a guess was. */
function sameSecret(candidate: string, secret: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(secret));
}

function randomToken() {
  return randomBytes(24).toString('hex');
}

export class MeetingStore {
  private rooms = new Map<string, RoomRecord>();
  private persistTimer: NodeJS.Timeout | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private broadcast: Broadcast;
  private moderatorPin: string;
  private dataDirectory: string;
  private dataFile: string;
  private tempDataFile: string;

  constructor(broadcast: Broadcast, options: MeetingStoreOptions) {
    this.broadcast = broadcast;
    this.moderatorPin = options.moderatorPin;
    this.dataDirectory = options.dataDirectory ?? DEFAULT_DATA_DIRECTORY;
    this.dataFile = path.join(this.dataDirectory, 'meetings.json');
    this.tempDataFile = path.join(this.dataDirectory, 'meetings.json.tmp');
  }

  async initialize() {
    try {
      const raw = await readFile(this.dataFile, 'utf8');
      const persisted = JSON.parse(raw) as Record<string, PersistedRoom>;
      for (const [code, room] of Object.entries(persisted)) {
        // Rebuilt field by field so the pre-sessions `moderatorToken` is dropped, signing everyone out once.
        this.rooms.set(code, {
          state: withoutLegacyDeviceFields(room.state),
          moderatorSessions: room.moderatorSessions || {},
          participantTokens: room.participantTokens || {},
          autoAdvanceAt: room.autoAdvanceAt,
          // Older files have no activity time; count from this start so nothing is pruned at once.
          lastActivityAt: room.lastActivityAt ?? now(),
          processedCommands: [],
        });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.warn('Could not load persisted meetings:', error);
    }

    this.pruneIdleRooms();
    if (!this.rooms.has(DEFAULT_ROOM_CODE)) this.createRoom(DEFAULT_ROOM_CODE);
    setInterval(() => this.tick(), 250).unref();
  }

  /** The only way rooms are created: validates the code and enforces the room limit. */
  openRoom(rawRoomCode: unknown): OpenRoomResult {
    const roomCode = parseRoomCode(rawRoomCode);
    if (!roomCode) return { ok: false, code: 'invalid-room', error: 'That room code is not valid.' };
    let room = this.rooms.get(roomCode);
    if (!room) {
      this.pruneIdleRooms();
      if (this.rooms.size >= MAX_ROOMS) {
        return { ok: false, code: 'room-limit', error: `This meeting server already has ${MAX_ROOMS} rooms. Try again later.` };
      }
      room = this.createRoom(roomCode);
    }
    room.lastActivityAt = now();
    return { ok: true, roomCode, room };
  }

  getSnapshot(roomCode: string) {
    const room = this.findRoom(roomCode);
    return room ? room.state : null;
  }

  authenticateModerator(roomCode: string, pin: unknown) {
    if (typeof pin !== 'string' || !sameSecret(pin, this.moderatorPin)) return null;
    const room = this.findRoom(roomCode);
    if (!room) return null;
    const token = randomToken();
    const sessions = Object.entries(room.moderatorSessions)
      .filter(([, expiresAt]) => expiresAt > now())
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_MODERATOR_SESSIONS - 1);
    room.moderatorSessions = Object.fromEntries([[this.sessionKey(token), now() + MODERATOR_SESSION_MS], ...sessions]);
    this.schedulePersist();
    return token;
  }

  authorizeParticipant(roomCode: string, participantId: string, participantToken: string) {
    if (!participantId || !participantToken || participantId.length > 120 || participantToken.length > 200) return false;
    const room = this.findRoom(roomCode);
    if (!room) return false;
    const existingToken = room.participantTokens[participantId];
    if (existingToken && existingToken !== participantToken) return false;
    if (!existingToken) {
      room.participantTokens[participantId] = participantToken;
      this.schedulePersist();
    }
    return true;
  }

  isModerator(roomCode: string, token?: unknown) {
    if (typeof token !== 'string' || !token) return false;
    const expiresAt = this.findRoom(roomCode)?.moderatorSessions[this.sessionKey(token)];
    return expiresAt !== undefined && expiresAt > now();
  }

  /** Looks up an existing room; never creates one. */
  private findRoom(rawRoomCode: unknown) {
    const roomCode = parseRoomCode(rawRoomCode);
    return roomCode ? this.rooms.get(roomCode) : undefined;
  }

  private createRoom(roomCode: string) {
    const room: RoomRecord = {
      state: createEmptyState(roomCode),
      moderatorSessions: {},
      participantTokens: {},
      lastActivityAt: now(),
      processedCommands: [],
    };
    this.rooms.set(roomCode, room);
    this.schedulePersist();
    return room;
  }

  /** Removes rooms nobody has used for a day that have nobody queued or speaking. */
  private pruneIdleRooms() {
    const cutoff = now() - IDLE_ROOM_MS;
    let removed = false;
    for (const [roomCode, room] of this.rooms) {
      const busy = room.state.queue.length > 0 || room.state.activeSpeaker || room.state.speakerBuffer;
      if (roomCode !== DEFAULT_ROOM_CODE && !busy && room.lastActivityAt <= cutoff) {
        this.rooms.delete(roomCode);
        removed = true;
      }
    }
    if (removed) this.schedulePersist();
  }

  /** Keyed by the PIN, so changing MODERATOR_PIN invalidates every existing session. */
  private sessionKey(token: string) {
    return createHmac('sha256', this.moderatorPin).update(token).digest('hex');
  }

  /** Takes the raw socket payload; nothing below the parse step sees unvalidated data. */
  handleCommand(raw: unknown): CommandResponse {
    const parsed = parseCommand(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const command = parsed.command;
    const room = this.findRoom(command.roomCode);
    if (!room) return { ok: false, error: 'This room is no longer open. Reload the page to rejoin.' };
    if (!this.authorizeParticipant(command.roomCode, command.participantId, command.participantToken)) {
      return { ok: false, error: 'Participant identity could not be verified.' };
    }
    if (room.processedCommands.includes(command.id)) return { ok: true };
    room.processedCommands = [...room.processedCommands.slice(-499), command.id];

    const definition = definitionOf(command);
    const moderator = this.isModerator(command.roomCode, command.moderatorToken);
    if (definition.access === 'moderator' && !moderator) {
      return { ok: false, error: 'Moderator authorization required.', code: 'moderator-auth-required' };
    }

    room.lastActivityAt = now();
    const refusal = definition.apply(room, command, { moderator });
    if (refusal) return refusal;
    this.publish(room);
    return { ok: true };
  }

  private tick() {
    const timestamp = now();
    for (const room of this.rooms.values()) {
      let changed = false;
      const buffer = room.state.speakerBuffer;
      if (buffer && !buffer.isPaused && buffer.endsAt) {
        const remaining = Math.max(0, Math.ceil((buffer.endsAt - timestamp) / 1000));
        if (remaining !== buffer.remainingBufferSeconds) {
          buffer.remainingBufferSeconds = remaining;
          changed = true;
        }
        if (remaining === 0) {
          activateBufferedSpeaker(room);
          changed = true;
        }
      }

      const active = room.state.activeSpeaker;
      if (active && !active.isPaused && active.endsAt) {
        const remaining = Math.max(0, Math.ceil((active.endsAt - timestamp) / 1000));
        if (remaining !== active.remainingSeconds) {
          active.remainingSeconds = remaining;
          changed = true;
        }
        if (remaining === 0 && room.state.settings.autoAdvance && !room.autoAdvanceAt) {
          room.autoAdvanceAt = timestamp + 1200;
        }
      }

      if (room.autoAdvanceAt && timestamp >= room.autoAdvanceAt) {
        finishSpeaker(room, 'completed', true);
        changed = true;
      }

      if (changed) this.publish(room);
    }
  }

  private publish(room: RoomRecord) {
    this.broadcast(room.state.roomCode, room.state);
    this.schedulePersist();
  }

  /** Writes any pending changes immediately; call before the process exits. */
  async flush() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persist();
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, 500);
  }

  private persist() {
    const data: Record<string, PersistedRoom> = {};
    for (const [code, room] of this.rooms) {
      data[code] = {
        state: room.state,
        moderatorSessions: room.moderatorSessions,
        participantTokens: room.participantTokens,
        autoAdvanceAt: room.autoAdvanceAt,
        lastActivityAt: room.lastActivityAt,
      };
    }
    // Snapshot now, but write one at a time so two saves never share the temp file.
    const json = JSON.stringify(data, null, 2);
    this.writeQueue = this.writeQueue.then(() => this.writeToDisk(json));
    return this.writeQueue;
  }

  private async writeToDisk(json: string) {
    try {
      await mkdir(this.dataDirectory, { recursive: true });
      await writeFile(this.tempDataFile, json, 'utf8');
      await rename(this.tempDataFile, this.dataFile);
    } catch (error) {
      console.error('Could not persist meeting state:', error);
    }
  }
}
