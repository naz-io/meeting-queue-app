export type UserRole = 'moderator' | 'participant' | 'stage';

export interface Participant {
  id: string;
  name: string;
  avatar: string; // Emoji or initials
  joinedAt: number;
}

export interface QueueItem {
  id: string; // Unique queue entry ID
  participant: Participant;
  raisedAt: number;
  note?: string; // Optional topic or context user added
  allocatedSeconds: number; // Configured timer for this person
}

export interface ActiveSpeaker {
  queueItem: QueueItem;
  startedAt: number;
  totalDurationSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
  endsAt?: number;
}

export interface SpeakerBuffer {
  queueItem: QueueItem;
  allocatedSpeakerSeconds: number;
  remainingBufferSeconds: number;
  totalBufferSeconds: number;
  isPaused: boolean;
  endsAt?: number;
}

export interface SpeakerHistoryItem {
  id: string;
  participantId?: string;
  participantName: string;
  avatar: string;
  spokenAt: number;
  actualDurationSeconds: number;
  allocatedSeconds: number;
  endedReason: 'completed' | 'dismissed' | 'skipped' | 'manual';
}

export interface SessionSettings {
  defaultTimerSeconds: number;
  bufferSeconds: number; // 10s default buffer before speaker timer starts
  autoAdvance: boolean;
  warningChimeSeconds: number;
  soundEnabled: boolean;
  roomName: string;
  roomCode: string;
}

export interface MeetingState {
  roomCode: string;
  roomName: string;
  queue: QueueItem[];
  activeSpeaker: ActiveSpeaker | null;
  speakerBuffer: SpeakerBuffer | null;
  history: SpeakerHistoryItem[];
  settings: SessionSettings;
}
