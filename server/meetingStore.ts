import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MeetingState, QueueItem, SpeakerHistoryItem } from '../src/types/index.ts';
import type { MeetingCommand, PersistedRoom, SettingsPatch } from '../src/types/realtime.ts';

const DEFAULT_ROOM_CODE = 'MEET-7892';
const DEFAULT_ROOM_NAME = 'Main Assembly Hall';
const ROOM_CODE_PATTERN = /^[A-Z0-9-]{4,24}$/;
// Next to this file, so starting the server from another folder still uses the same data.
const DEFAULT_DATA_DIRECTORY = path.join(import.meta.dirname, 'data');

interface RoomRecord extends PersistedRoom {
  processedCommands: string[];
}

type Broadcast = (roomCode: string, state: MeetingState) => void;

interface MeetingStoreOptions {
  moderatorPin: string;
  dataDirectory?: string;
}

const now = () => Date.now();

function safeRoomCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(normalized) ? normalized : DEFAULT_ROOM_CODE;
}

function createEmptyState(roomCode: string): MeetingState {
  return {
    roomCode,
    roomName: DEFAULT_ROOM_NAME,
    queue: [],
    activeSpeaker: null,
    speakerBuffer: null,
    history: [],
    settings: {
      defaultTimerSeconds: 120,
      bufferSeconds: 10,
      autoAdvance: false,
      warningChimeSeconds: 10,
      soundEnabled: true,
      roomName: DEFAULT_ROOM_NAME,
      roomCode,
    },
    activeView: 'participant',
    currentUserId: '',
    currentUserName: '',
    currentUserAvatar: '',
  };
}

function publicState(state: MeetingState): MeetingState {
  return {
    ...state,
    activeView: 'participant',
    currentUserId: '',
    currentUserName: '',
    currentUserAvatar: '',
  };
}

/** Constant-time comparison, so response timing never hints at how close a guess was. */
function sameSecret(candidate: string, secret: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(secret));
}

function randomToken() {
  return randomBytes(24).toString('hex');
}

function stringPayload(payload: Record<string, unknown> | undefined, key: string, maxLength = 120) {
  const value = payload?.[key];
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function numberPayload(payload: Record<string, unknown> | undefined, key: string, fallback = 0) {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finishSpeaker(room: RoomRecord, reason: SpeakerHistoryItem['endedReason'], autoAdvance: boolean) {
  const active = room.state.activeSpeaker;
  if (!active) return;

  const historyEntry: SpeakerHistoryItem = {
    id: `h_${randomBytes(6).toString('hex')}`,
    participantId: active.queueItem.participant.id,
    participantName: active.queueItem.participant.name,
    avatar: active.queueItem.participant.avatar,
    spokenAt: active.startedAt,
    actualDurationSeconds: Math.max(0, active.totalDurationSeconds - active.remainingSeconds),
    allocatedSeconds: active.totalDurationSeconds,
    endedReason: reason,
  };

  room.state.activeSpeaker = null;
  room.autoAdvanceAt = undefined;
  room.state.history = [historyEntry, ...room.state.history].slice(0, 1000);

  if (autoAdvance && room.state.queue.length > 0) {
    beginSpeaker(room);
  }
}

function beginSpeaker(room: RoomRecord, queueItemId?: string, secondsOverride?: number, skipBuffer = false) {
  const queue = room.state.queue;
  const index = queueItemId ? queue.findIndex((item) => item.id === queueItemId) : 0;
  if (index < 0 || index >= queue.length) return false;

  const [queueItem] = queue.splice(index, 1);
  const duration = Math.max(1, Math.min(10_800, secondsOverride || queueItem.allocatedSeconds || room.state.settings.defaultTimerSeconds));
  room.state.activeSpeaker = null;

  if (room.state.settings.bufferSeconds > 0 && !skipBuffer) {
    const bufferSeconds = room.state.settings.bufferSeconds;
    room.state.speakerBuffer = {
      queueItem,
      allocatedSpeakerSeconds: duration,
      remainingBufferSeconds: bufferSeconds,
      totalBufferSeconds: bufferSeconds,
      isPaused: false,
      endsAt: now() + bufferSeconds * 1000,
    };
  } else {
    room.state.speakerBuffer = null;
    room.state.activeSpeaker = {
      queueItem,
      startedAt: now(),
      totalDurationSeconds: duration,
      remainingSeconds: duration,
      isPaused: false,
      endsAt: now() + duration * 1000,
    };
  }
  return true;
}

function activateBufferedSpeaker(room: RoomRecord) {
  const buffer = room.state.speakerBuffer;
  if (!buffer) return;
  const duration = buffer.allocatedSpeakerSeconds;
  room.state.speakerBuffer = null;
  room.state.activeSpeaker = {
    queueItem: buffer.queueItem,
    startedAt: now(),
    totalDurationSeconds: duration,
    remainingSeconds: duration,
    isPaused: false,
    endsAt: now() + duration * 1000,
  };
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
        this.rooms.set(code, { ...room, participantTokens: room.participantTokens || {}, processedCommands: [] });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.warn('Could not load persisted meetings:', error);
    }

    this.getRoom(DEFAULT_ROOM_CODE);
    setInterval(() => this.tick(), 250).unref();
  }

  getRoom(rawRoomCode: string) {
    const roomCode = safeRoomCode(rawRoomCode);
    let room = this.rooms.get(roomCode);
    if (!room) {
      room = {
        state: createEmptyState(roomCode),
        moderatorToken: randomToken(),
        participantTokens: {},
        processedCommands: [],
      };
      this.rooms.set(roomCode, room);
      this.schedulePersist();
    }
    return room;
  }

  getSnapshot(roomCode: string) {
    return publicState(this.getRoom(roomCode).state);
  }

  authenticateModerator(roomCode: string, pin: unknown) {
    if (typeof pin !== 'string' || !sameSecret(pin, this.moderatorPin)) return null;
    return this.getRoom(roomCode).moderatorToken;
  }

  authorizeParticipant(roomCode: string, participantId: string, participantToken: string) {
    if (!participantId || !participantToken || participantId.length > 120 || participantToken.length > 200) return false;
    const room = this.getRoom(roomCode);
    const existingToken = room.participantTokens[participantId];
    if (existingToken && existingToken !== participantToken) return false;
    if (!existingToken) {
      room.participantTokens[participantId] = participantToken;
      this.schedulePersist();
    }
    return true;
  }

  isModerator(roomCode: string, token?: string) {
    return Boolean(token && token === this.getRoom(roomCode).moderatorToken);
  }

  handleCommand(command: MeetingCommand) {
    const room = this.getRoom(command.roomCode);
    if (!this.authorizeParticipant(command.roomCode, command.participantId, command.participantToken)) {
      return { ok: false, error: 'Participant identity could not be verified.' };
    }
    if (room.processedCommands.includes(command.id)) return { ok: true };
    room.processedCommands = [...room.processedCommands.slice(-499), command.id];

    const moderatorOnly = !['raise-hand', 'lower-hand', 'leave-meeting', 'finish-speaker'].includes(command.type);
    const moderator = this.isModerator(command.roomCode, command.moderatorToken);
    if (moderatorOnly && !moderator) return { ok: false, error: 'Moderator authorization required.' };

    const payload = command.payload;
    switch (command.type) {
      case 'raise-hand': {
        if (room.state.queue.some((item) => item.participant.id === command.participantId)) break;
        if (room.state.activeSpeaker?.queueItem.participant.id === command.participantId) break;
        if (room.state.speakerBuffer?.queueItem.participant.id === command.participantId) break;
        const name = stringPayload(payload, 'name', 60) || 'Guest Participant';
        const avatar = stringPayload(payload, 'avatar', 12) || '👤';
        const item: QueueItem = {
          id: `q_${randomBytes(6).toString('hex')}`,
          participant: { id: command.participantId, name, avatar, joinedAt: now() },
          raisedAt: now(),
          note: stringPayload(payload, 'note', 160) || undefined,
          allocatedSeconds: room.state.settings.defaultTimerSeconds,
        };
        room.state.queue.push(item);
        break;
      }
      case 'lower-hand':
        room.state.queue = room.state.queue.filter((item) => item.participant.id !== command.participantId);
        break;
      case 'leave-meeting':
        room.state.queue = room.state.queue.filter((item) => item.participant.id !== command.participantId);
        if (room.state.speakerBuffer?.queueItem.participant.id === command.participantId) {
          room.state.speakerBuffer = null;
        }
        if (room.state.activeSpeaker?.queueItem.participant.id === command.participantId) {
          finishSpeaker(room, 'manual', false);
        }
        break;
      case 'move-queue-item': {
        const id = stringPayload(payload, 'queueItemId');
        const direction = stringPayload(payload, 'direction');
        if (!['up', 'down', 'top', 'bottom'].includes(direction)) {
          return { ok: false, error: 'Unknown queue direction.' };
        }
        const index = room.state.queue.findIndex((item) => item.id === id);
        if (index < 0) break;
        const [item] = room.state.queue.splice(index, 1);
        const target = direction === 'top' ? 0
          : direction === 'bottom' ? room.state.queue.length
            : direction === 'up' ? Math.max(0, index - 1)
              : Math.min(room.state.queue.length, index + 1);
        room.state.queue.splice(target, 0, item);
        break;
      }
      case 'reorder-queue': {
        const start = numberPayload(payload, 'startIndex', -1);
        const end = numberPayload(payload, 'endIndex', -1);
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          return { ok: false, error: 'Queue positions must be whole numbers.' };
        }
        if (start < 0 || end < 0 || start >= room.state.queue.length || end >= room.state.queue.length) break;
        const [item] = room.state.queue.splice(start, 1);
        room.state.queue.splice(end, 0, item);
        break;
      }
      case 'dismiss-queue-item': {
        const id = stringPayload(payload, 'queueItemId');
        room.state.queue = room.state.queue.filter((item) => item.id !== id);
        break;
      }
      case 'start-speaker':
        beginSpeaker(
          room,
          stringPayload(payload, 'queueItemId') || undefined,
          numberPayload(payload, 'secondsOverride') || undefined,
          payload?.skipBuffer === true,
        );
        break;
      case 'skip-buffer':
        activateBufferedSpeaker(room);
        break;
      case 'cancel-buffer':
        if (room.state.speakerBuffer) {
          room.state.queue.unshift(room.state.speakerBuffer.queueItem);
          room.state.speakerBuffer = null;
        }
        break;
      case 'pause-timer':
        this.pauseTimer(room);
        break;
      case 'resume-timer':
        this.resumeTimer(room);
        break;
      case 'add-time':
        this.addTime(room, numberPayload(payload, 'seconds'));
        break;
      case 'set-speaker-timer':
        this.setSpeakerTimer(room, numberPayload(payload, 'seconds'));
        break;
      case 'finish-speaker': {
        const activeParticipantId = room.state.activeSpeaker?.queueItem.participant.id;
        if (!moderator && activeParticipantId !== command.participantId) {
          return { ok: false, error: 'Only the active speaker or moderator can finish this turn.' };
        }
        const reason = stringPayload(payload, 'reason') as SpeakerHistoryItem['endedReason'];
        finishSpeaker(room, ['completed', 'dismissed', 'skipped', 'manual'].includes(reason) ? reason : 'completed', moderator && payload?.autoAdvanceNext === true);
        break;
      }
      case 'update-settings': {
        const patch = (payload?.settings || {}) as SettingsPatch;
        const next = { ...room.state.settings };
        if (typeof patch.defaultTimerSeconds === 'number') {
          if (!Number.isFinite(patch.defaultTimerSeconds)) {
            return { ok: false, error: 'Speaking time must be a finite number.' };
          }
          const scope = payload?.speakingTimeScope;
          if (scope !== undefined && scope !== 'existing-queue' && scope !== 'from-now-on') {
            return { ok: false, error: 'Choose how to apply the speaking time.' };
          }
          next.defaultTimerSeconds = Math.max(1, Math.min(10_800, Math.round(patch.defaultTimerSeconds)));
          if (scope === 'existing-queue') {
            room.state.queue = room.state.queue.map((item) => ({
              ...item,
              allocatedSeconds: next.defaultTimerSeconds,
            }));
          }
          // A called speaker (including the transition buffer) keeps their allocated time.
        }
        if (typeof patch.bufferSeconds === 'number') next.bufferSeconds = Math.max(0, Math.min(120, patch.bufferSeconds));
        if (typeof patch.warningChimeSeconds === 'number') next.warningChimeSeconds = Math.max(0, Math.min(300, patch.warningChimeSeconds));
        if (typeof patch.autoAdvance === 'boolean') {
          next.autoAdvance = patch.autoAdvance;
          // Turning auto-advance off also cancels a hand-off already counting down.
          if (!patch.autoAdvance) room.autoAdvanceAt = undefined;
        }
        if (typeof patch.soundEnabled === 'boolean') next.soundEnabled = patch.soundEnabled;
        if (typeof patch.roomName === 'string' && patch.roomName.trim()) {
          next.roomName = patch.roomName.trim().slice(0, 80);
          room.state.roomName = next.roomName;
        }
        room.state.settings = next;
        break;
      }
      case 'reset-session':
        room.state.queue = [];
        room.state.activeSpeaker = null;
        room.state.speakerBuffer = null;
        room.state.history = [];
        room.autoAdvanceAt = undefined;
        break;
      case 'load-demo-data':
        this.loadDemo(room);
        break;
    }

    this.publish(command.roomCode, room);
    return { ok: true };
  }

  private pauseTimer(room: RoomRecord) {
    const timestamp = now();
    if (room.state.speakerBuffer && !room.state.speakerBuffer.isPaused) {
      const buffer = room.state.speakerBuffer;
      buffer.remainingBufferSeconds = Math.max(0, Math.ceil(((buffer.endsAt || timestamp) - timestamp) / 1000));
      buffer.endsAt = undefined;
      buffer.isPaused = true;
    } else if (room.state.activeSpeaker && !room.state.activeSpeaker.isPaused) {
      const active = room.state.activeSpeaker;
      active.remainingSeconds = Math.max(0, Math.ceil(((active.endsAt || timestamp) - timestamp) / 1000));
      active.endsAt = undefined;
      active.isPaused = true;
    }
  }

  private resumeTimer(room: RoomRecord) {
    if (room.state.speakerBuffer?.isPaused) {
      room.state.speakerBuffer.isPaused = false;
      room.state.speakerBuffer.endsAt = now() + room.state.speakerBuffer.remainingBufferSeconds * 1000;
    } else if (room.state.activeSpeaker?.isPaused) {
      room.state.activeSpeaker.isPaused = false;
      room.state.activeSpeaker.endsAt = now() + room.state.activeSpeaker.remainingSeconds * 1000;
    }
  }

  private addTime(room: RoomRecord, seconds: number) {
    const active = room.state.activeSpeaker;
    if (!active || !Number.isFinite(seconds)) return;
    active.totalDurationSeconds = Math.max(1, Math.min(10_800, active.totalDurationSeconds + seconds));
    active.remainingSeconds = Math.max(1, Math.min(10_800, active.remainingSeconds + seconds));
    if (!active.isPaused) active.endsAt = now() + active.remainingSeconds * 1000;
    room.autoAdvanceAt = undefined;
  }

  private setSpeakerTimer(room: RoomRecord, seconds: number) {
    const active = room.state.activeSpeaker;
    if (!active || !Number.isFinite(seconds) || seconds <= 0) return;
    const safe = Math.max(1, Math.min(10_800, seconds));
    active.totalDurationSeconds = safe;
    active.remainingSeconds = safe;
    if (!active.isPaused) active.endsAt = now() + safe * 1000;
    room.autoAdvanceAt = undefined;
  }

  private loadDemo(room: RoomRecord) {
    const stamp = now();
    const demoParticipants = [
      ['Dr. Evelyn Reed', '👩‍🔬', 'Project Q3 Budget Allocation', 120],
      ['Marcus Chen', '👨‍💻', 'AI Pipeline Updates & Architecture', 180],
      ['Sarah Jenkins', '👩‍💼', 'Customer Feedback Summary', 120],
      ['Omar Hassan', '👨‍💼', 'Volunteer Schedule for Saturday', 90],
      ['Priya Patel', '👩‍💻', 'Accessibility Improvements', 120],
      ['Daniel Kim', '👨‍🎨', 'New Event Signage', 60],
      ['Sofia Martinez', '🦸‍♀️', 'Community Outreach Update', 150],
      ['James Wilson', '🦁', 'Facilities Maintenance Request', 90],
      ['Aisha Thompson', '⭐', 'Youth Program Proposal', 120],
      ['Noah Williams', '🦉', 'Website Content Refresh', 60],
      ['Mei Lin', '🚀', 'Digital Check-in Pilot', 180],
      ['Lucas Brown', '🦊', 'Parking and Transit Feedback', 90],
      ['Fatima Zahra', '👩‍🔬', 'Sustainability Working Group', 120],
      ['Ethan Davis', '👨‍💻', 'Audio System Upgrade', 60],
      ['Leila Morgan', '🎨', 'Public Art Collaboration', 150],
      ['Gabriel Silva', '👨‍💼', 'Neighborhood Safety Walk', 90],
      ['Hannah Lee', '👩‍💼', 'New Member Welcome Process', 120],
      ['Mateo Garcia', '🦸‍♂️', 'Food Drive Logistics', 60],
      ['Zoe Robinson', '⭐', 'Monthly Newsletter Ideas', 90],
      ['Ibrahim Ali', '🚀', 'Open Questions and Follow-ups', 120],
    ] as const;

    room.state.queue = demoParticipants.map(([name, avatar, note, seconds], index) => ({
      id: `demo_q_${index + 1}`,
      participant: {
        id: `demo_p_${index + 1}`,
        name,
        avatar,
        joinedAt: stamp - (demoParticipants.length - index) * 60_000,
      },
      raisedAt: stamp - (demoParticipants.length - index) * 60_000,
      note,
      allocatedSeconds: seconds,
    }));
  }

  private tick() {
    const timestamp = now();
    for (const [roomCode, room] of this.rooms) {
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

      if (changed) this.publish(roomCode, room);
    }
  }

  private publish(roomCode: string, room: RoomRecord) {
    this.broadcast(safeRoomCode(roomCode), publicState(room.state));
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
        moderatorToken: room.moderatorToken,
        participantTokens: room.participantTokens,
        autoAdvanceAt: room.autoAdvanceAt,
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
