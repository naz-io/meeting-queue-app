import type { MeetingState, SessionSettings, UserRole } from './index';

export type MeetingCommandType =
  | 'raise-hand'
  | 'lower-hand'
  | 'leave-meeting'
  | 'move-queue-item'
  | 'reorder-queue'
  | 'dismiss-queue-item'
  | 'start-speaker'
  | 'skip-buffer'
  | 'cancel-buffer'
  | 'pause-timer'
  | 'resume-timer'
  | 'add-time'
  | 'set-speaker-timer'
  | 'finish-speaker'
  | 'update-settings'
  | 'reset-session'
  | 'load-demo-data';

export interface MeetingCommand {
  id: string;
  roomCode: string;
  participantId: string;
  participantToken: string;
  moderatorToken?: string;
  type: MeetingCommandType;
  payload?: Record<string, unknown>;
}

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
}

export interface ModeratorAuthResponse {
  ok: boolean;
  moderatorToken?: string;
  error?: string;
}

export interface CommandResponse {
  ok: boolean;
  error?: string;
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

export interface MeetingConnectionState {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
}

export interface PersistedRoom {
  state: MeetingState;
  moderatorToken: string;
  participantTokens: Record<string, string>;
  autoAdvanceAt?: number;
}

export type SettingsPatch = Partial<Pick<SessionSettings,
  'defaultTimerSeconds' | 'bufferSeconds' | 'autoAdvance' | 'warningChimeSeconds' | 'soundEnabled' | 'roomName'
>>;

export const VALID_VIEWS: UserRole[] = ['participant', 'moderator', 'stage'];
