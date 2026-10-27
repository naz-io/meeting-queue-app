import type { MeetingState, SessionSettings, SpeakerHistoryItem } from './meeting.ts';

export type QueueDirection = 'up' | 'down' | 'top' | 'bottom';
export type SpeakerEndReason = SpeakerHistoryItem['endedReason'];

/**
 * The payload each command carries; `undefined` means none.
 * Adding a command here forces a matching validator in server/commands.ts.
 */
export interface CommandPayloads {
  'raise-hand': { name?: string; avatar?: string; note?: string };
  'lower-hand': undefined;
  'leave-meeting': undefined;
  'move-queue-item': { queueItemId: string; direction: QueueDirection };
  'reorder-queue': { startIndex: number; endIndex: number };
  'dismiss-queue-item': { queueItemId: string };
  'start-speaker': { queueItemId?: string; secondsOverride?: number; skipBuffer?: boolean };
  'skip-buffer': undefined;
  'cancel-buffer': undefined;
  'pause-timer': undefined;
  'resume-timer': undefined;
  'add-time': { seconds: number };
  'set-speaker-timer': { seconds: number };
  'finish-speaker': { reason?: SpeakerEndReason; autoAdvanceNext?: boolean };
  'update-settings': { settings: SettingsPatch; speakingTimeScope?: SpeakingTimeScope };
  'reset-session': undefined;
  'load-demo-data': undefined;
}

export type MeetingCommandType = keyof CommandPayloads;

interface CommandEnvelope {
  id: string;
  roomCode: string;
  participantId: string;
  participantToken: string;
  moderatorToken?: string;
}

/** One variant per command type, so `switch (command.type)` narrows `payload` (like a sealed class). */
export type MeetingCommand = {
  [T in MeetingCommandType]: CommandEnvelope & { type: T; payload: CommandPayloads[T] };
}[MeetingCommandType];

export interface JoinRoomRequest {
  roomCode: string;
  participantId: string;
  participantToken: string;
  moderatorToken?: string;
}

export interface JoinRoomResponse {
  ok: boolean;
  state?: MeetingState;
  publicBaseUrl?: string;
  moderatorAuthorized?: boolean;
  error?: string;
  code?: 'invalid-room' | 'room-limit';
}

export interface ModeratorAuthResponse {
  ok: boolean;
  moderatorToken?: string;
  error?: string;
}

export interface CommandResponse {
  ok: boolean;
  error?: string;
  /** Set when the moderator token is missing, expired or revoked. */
  code?: 'moderator-auth-required';
}

export interface ServerToClientEvents {
  'meeting-state': (state: MeetingState) => void;
  'server-error': (message: string) => void;
}

export interface ClientToServerEvents {
  'join-room': (request: JoinRoomRequest, callback: (response: JoinRoomResponse) => void) => void;
  'authenticate-moderator': (
    request: { roomCode: string; pin: string },
    callback: (response: ModeratorAuthResponse) => void,
  ) => void;
  'meeting-command': (command: MeetingCommand, callback?: (response: CommandResponse) => void) => void;
}

export interface PersistedRoom {
  state: MeetingState;
  /** HMAC(PIN, token) → expiry time; the tokens themselves are never stored. */
  moderatorSessions: Record<string, number>;
  participantTokens: Record<string, string>;
  autoAdvanceAt?: number;
  /** Last join or command; rooms idle for a day with nothing queued are removed. */
  lastActivityAt?: number;
}

export type SpeakingTimeScope = 'existing-queue' | 'from-now-on';

export type SettingsPatch = Partial<Pick<SessionSettings,
  'defaultTimerSeconds' | 'bufferSeconds' | 'autoAdvance' | 'warningChimeSeconds' | 'soundEnabled' | 'roomName'
>>;

