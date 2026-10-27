import { randomBytes } from 'node:crypto';
import type { MeetingState, SpeakerHistoryItem } from '../shared/meeting.ts';
import type { PersistedRoom } from '../shared/protocol.ts';

// A room's in-memory record and the speaker transitions shared by commands and the timer loop.

export const DEFAULT_ROOM_NAME = 'Main Assembly Hall';
export const MAX_SPEAKING_SECONDS = 10_800;

export interface RoomRecord extends PersistedRoom {
  lastActivityAt: number;
  processedCommands: string[];
}

export const now = () => Date.now();

export function createEmptyState(roomCode: string): MeetingState {
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
  };
}

export function finishSpeaker(room: RoomRecord, reason: SpeakerHistoryItem['endedReason'], autoAdvance: boolean) {
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

export function beginSpeaker(room: RoomRecord, queueItemId?: string, secondsOverride?: number, skipBuffer = false) {
  const queue = room.state.queue;
  const index = queueItemId ? queue.findIndex((item) => item.id === queueItemId) : 0;
  if (index < 0 || index >= queue.length) return false;

  const [queueItem] = queue.splice(index, 1);
  const duration = Math.max(1, Math.min(MAX_SPEAKING_SECONDS, secondsOverride || queueItem.allocatedSeconds || room.state.settings.defaultTimerSeconds));
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

export function activateBufferedSpeaker(room: RoomRecord) {
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
