import { randomBytes } from 'node:crypto';
import type { QueueItem } from '../shared/meeting.ts';
import type { CommandResponse, MeetingCommand, MeetingCommandType } from '../shared/protocol.ts';
import {
  activateBufferedSpeaker,
  beginSpeaker,
  finishSpeaker,
  MAX_SPEAKING_SECONDS,
  now,
  type RoomRecord,
} from './room.ts';

// What each command does and who may send it. The store has already parsed the command, checked
// the participant's identity and dropped duplicates before anything here runs.

export const MAX_QUEUE_LENGTH = 200;

type CommandOf<T extends MeetingCommandType> = Extract<MeetingCommand, { type: T }>;

export interface CommandActor {
  moderator: boolean;
}

interface CommandDefinition<T extends MeetingCommandType> {
  /** 'participant' commands may be sent by anyone in the room; the rest need a moderator token. */
  access: 'participant' | 'moderator';
  /** Changes the room. Returns a response only to refuse the command; otherwise it succeeded. */
  apply(room: RoomRecord, command: CommandOf<T>, actor: CommandActor): CommandResponse | void;
}

const clampSeconds = (seconds: number) => Math.max(1, Math.min(MAX_SPEAKING_SECONDS, seconds));

/** One entry per command; the mapped type makes a missing entry a compile error. */
export const COMMANDS: { [T in MeetingCommandType]: CommandDefinition<T> } = {
  'raise-hand': {
    access: 'participant',
    apply(room, command) {
      const { participantId } = command;
      if (room.state.queue.some((item) => item.participant.id === participantId)) return;
      if (room.state.activeSpeaker?.queueItem.participant.id === participantId) return;
      if (room.state.speakerBuffer?.queueItem.participant.id === participantId) return;
      if (room.state.queue.length >= MAX_QUEUE_LENGTH) {
        return { ok: false, error: `The queue is full (${MAX_QUEUE_LENGTH} people). Try again after a few people have spoken.` };
      }
      const { name, avatar, note } = command.payload;
      const item: QueueItem = {
        id: `q_${randomBytes(6).toString('hex')}`,
        participant: { id: participantId, name: name || 'Guest Participant', avatar: avatar || '👤', joinedAt: now() },
        raisedAt: now(),
        note: note || undefined,
        allocatedSeconds: room.state.settings.defaultTimerSeconds,
      };
      room.state.queue.push(item);
    },
  },

  'lower-hand': {
    access: 'participant',
    apply(room, command) {
      room.state.queue = room.state.queue.filter((item) => item.participant.id !== command.participantId);
    },
  },

  'leave-meeting': {
    access: 'participant',
    apply(room, command) {
      const { participantId } = command;
      room.state.queue = room.state.queue.filter((item) => item.participant.id !== participantId);
      if (room.state.speakerBuffer?.queueItem.participant.id === participantId) room.state.speakerBuffer = null;
      if (room.state.activeSpeaker?.queueItem.participant.id === participantId) finishSpeaker(room, 'manual', false);
    },
  },

  'finish-speaker': {
    // Participants may send it, but only to end their own turn (checked below).
    access: 'participant',
    apply(room, command, actor) {
      const activeParticipantId = room.state.activeSpeaker?.queueItem.participant.id;
      if (!actor.moderator && activeParticipantId !== command.participantId) {
        return { ok: false, error: 'Only the active speaker or moderator can finish this turn.' };
      }
      const { reason = 'completed', autoAdvanceNext } = command.payload;
      finishSpeaker(room, reason, actor.moderator && autoAdvanceNext === true);
    },
  },

  'move-queue-item': {
    access: 'moderator',
    apply(room, command) {
      const { queueItemId, direction } = command.payload;
      const queue = room.state.queue;
      const index = queue.findIndex((item) => item.id === queueItemId);
      if (index < 0) return;
      const [item] = queue.splice(index, 1);
      const target = direction === 'top' ? 0
        : direction === 'bottom' ? queue.length
          : direction === 'up' ? Math.max(0, index - 1)
            : Math.min(queue.length, index + 1);
      queue.splice(target, 0, item);
    },
  },

  'reorder-queue': {
    access: 'moderator',
    apply(room, command) {
      const { startIndex, endIndex } = command.payload;
      const queue = room.state.queue;
      if (startIndex < 0 || endIndex < 0 || startIndex >= queue.length || endIndex >= queue.length) return;
      const [item] = queue.splice(startIndex, 1);
      queue.splice(endIndex, 0, item);
    },
  },

  'dismiss-queue-item': {
    access: 'moderator',
    apply(room, command) {
      room.state.queue = room.state.queue.filter((item) => item.id !== command.payload.queueItemId);
    },
  },

  'start-speaker': {
    access: 'moderator',
    apply(room, command) {
      const { queueItemId, secondsOverride, skipBuffer } = command.payload;
      beginSpeaker(room, queueItemId || undefined, secondsOverride || undefined, skipBuffer === true);
    },
  },

  'skip-buffer': {
    access: 'moderator',
    apply(room) {
      activateBufferedSpeaker(room);
    },
  },

  'cancel-buffer': {
    access: 'moderator',
    apply(room) {
      if (!room.state.speakerBuffer) return;
      room.state.queue.unshift(room.state.speakerBuffer.queueItem);
      room.state.speakerBuffer = null;
    },
  },

  'pause-timer': {
    access: 'moderator',
    apply(room) {
      const timestamp = now();
      const secondsLeft = (endsAt?: number) => Math.max(0, Math.ceil(((endsAt || timestamp) - timestamp) / 1000));
      const { speakerBuffer: buffer, activeSpeaker: active } = room.state;
      if (buffer && !buffer.isPaused) {
        buffer.remainingBufferSeconds = secondsLeft(buffer.endsAt);
        buffer.endsAt = undefined;
        buffer.isPaused = true;
      } else if (active && !active.isPaused) {
        active.remainingSeconds = secondsLeft(active.endsAt);
        active.endsAt = undefined;
        active.isPaused = true;
      }
    },
  },

  'resume-timer': {
    access: 'moderator',
    apply(room) {
      const { speakerBuffer: buffer, activeSpeaker: active } = room.state;
      if (buffer?.isPaused) {
        buffer.isPaused = false;
        buffer.endsAt = now() + buffer.remainingBufferSeconds * 1000;
      } else if (active?.isPaused) {
        active.isPaused = false;
        active.endsAt = now() + active.remainingSeconds * 1000;
      }
    },
  },

  'add-time': {
    access: 'moderator',
    apply(room, command) {
      const active = room.state.activeSpeaker;
      if (!active) return;
      const { seconds } = command.payload;
      active.totalDurationSeconds = clampSeconds(active.totalDurationSeconds + seconds);
      active.remainingSeconds = clampSeconds(active.remainingSeconds + seconds);
      if (!active.isPaused) active.endsAt = now() + active.remainingSeconds * 1000;
      room.autoAdvanceAt = undefined;
    },
  },

  'set-speaker-timer': {
    access: 'moderator',
    apply(room, command) {
      const active = room.state.activeSpeaker;
      const { seconds } = command.payload;
      if (!active || seconds <= 0) return;
      const safe = clampSeconds(seconds);
      active.totalDurationSeconds = safe;
      active.remainingSeconds = safe;
      if (!active.isPaused) active.endsAt = now() + safe * 1000;
      room.autoAdvanceAt = undefined;
    },
  },

  'update-settings': {
    access: 'moderator',
    apply(room, command) {
      const { settings: patch, speakingTimeScope: scope } = command.payload;
      const next = { ...room.state.settings };
      if (patch.defaultTimerSeconds !== undefined) {
        next.defaultTimerSeconds = clampSeconds(Math.round(patch.defaultTimerSeconds));
        if (scope === 'existing-queue') {
          room.state.queue = room.state.queue.map((item) => ({ ...item, allocatedSeconds: next.defaultTimerSeconds }));
        }
        // A called speaker (including the transition buffer) keeps their allocated time.
      }
      if (patch.bufferSeconds !== undefined) next.bufferSeconds = Math.max(0, Math.min(120, patch.bufferSeconds));
      if (patch.warningChimeSeconds !== undefined) next.warningChimeSeconds = Math.max(0, Math.min(300, patch.warningChimeSeconds));
      if (patch.autoAdvance !== undefined) {
        next.autoAdvance = patch.autoAdvance;
        // Turning auto-advance off also cancels a hand-off already counting down.
        if (!patch.autoAdvance) room.autoAdvanceAt = undefined;
      }
      if (patch.soundEnabled !== undefined) next.soundEnabled = patch.soundEnabled;
      if (patch.roomName) {
        next.roomName = patch.roomName;
        room.state.roomName = next.roomName;
      }
      room.state.settings = next;
    },
  },

  'reset-session': {
    access: 'moderator',
    apply(room) {
      room.state.queue = [];
      room.state.activeSpeaker = null;
      room.state.speakerBuffer = null;
      room.state.history = [];
      room.autoAdvanceAt = undefined;
    },
  },

  'load-demo-data': {
    access: 'moderator',
    apply(room) {
      room.state.queue = demoQueue(now());
    },
  },
};

/** Looks up a command's definition. The cast is safe because COMMANDS is keyed by the same type. */
export function definitionOf(command: MeetingCommand) {
  return COMMANDS[command.type] as CommandDefinition<MeetingCommandType>;
}

function demoQueue(stamp: number): QueueItem[] {
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

  return demoParticipants.map(([name, avatar, note, seconds], index) => ({
    id: `demo_q_${index + 1}`,
    participant: { id: `demo_p_${index + 1}`, name, avatar, joinedAt: stamp - (demoParticipants.length - index) * 60_000 },
    raisedAt: stamp - (demoParticipants.length - index) * 60_000,
    note,
    allocatedSeconds: seconds,
  }));
}
