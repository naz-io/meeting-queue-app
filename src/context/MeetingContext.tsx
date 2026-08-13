/* oxlint-disable react/only-export-components -- Provider, hook, and avatar options form one public context module. */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { io, type Socket } from 'socket.io-client';
import type {
  ActiveSpeaker,
  QueueItem,
  SessionSettings,
  SpeakerBuffer,
  SpeakerHistoryItem,
  UserRole,
} from '../types';
import type {
  ClientToServerEvents,
  MeetingCommandType,
  ServerToClientEvents,
} from '../types/realtime';
import { soundManager } from '../utils/sound';

interface MeetingContextType {
  roomCode: string;
  roomName: string;
  queue: QueueItem[];
  activeSpeaker: ActiveSpeaker | null;
  speakerBuffer: SpeakerBuffer | null;
  history: SpeakerHistoryItem[];
  settings: SessionSettings;
  activeView: UserRole;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  connected: boolean;
  reconnecting: boolean;
  connectionError: string | null;
  isModerator: boolean;
  hasJoinedRoom: boolean;

  getParticipantTotalSpokenSeconds: (participantId?: string, name?: string) => number;
  getParticipantTurnCount: (participantId?: string, name?: string) => number;

  setActiveView: (view: UserRole) => void;
  authorizeModerator: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  joinRoom: (name: string, avatar: string) => void;
  leaveRoom: () => void;
  setCurrentUserInfo: (name: string, avatar: string) => void;
  raiseHand: (note?: string) => void;
  lowerHand: () => void;
  isUserInQueue: boolean;
  userQueuePosition: number;

  reorderQueue: (startIndex: number, endIndex: number) => void;
  moveQueueItem: (queueItemId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  dismissQueueItem: (queueItemId: string) => void;
  startSpeaker: (queueItemId?: string, secondsOverride?: number, skipBuffer?: boolean) => void;
  skipBuffer: () => void;
  cancelBuffer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  addTime: (seconds: number) => void;
  setSpeakerTimer: (seconds: number) => void;
  finishCurrentSpeaker: (reason?: 'completed' | 'dismissed' | 'skipped' | 'manual', autoAdvanceNext?: boolean) => void;
  updateSettings: (newSettings: Partial<SessionSettings>) => void;
  resetSession: () => void;
  loadDemoData: () => void;
}

const DEFAULT_ROOM_CODE = 'MEET-7892';
const DEFAULT_ROOM_NAME = 'Main Assembly Hall';
const USER_KEY = 'in_person_meeting_user_v2';
const MODERATOR_TOKEN_KEY = 'in_person_meeting_moderator_token_v2';

const DEFAULT_SETTINGS: SessionSettings = {
  defaultTimerSeconds: 120,
  bufferSeconds: 10,
  autoAdvance: false,
  warningChimeSeconds: 10,
  soundEnabled: true,
  roomName: DEFAULT_ROOM_NAME,
  roomCode: DEFAULT_ROOM_CODE,
};

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export const AVATAR_OPTIONS = ['👨‍💼', '👩‍💼', '🦸‍♂️', '👩‍🔬', '👨‍🎨', '👩‍💻', '🚀', '⭐', '🦁', '🦉', '🦊', '🎨'];

function getRoomCode() {
  const value = new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase();
  return value && /^[A-Z0-9-]{4,24}$/.test(value) ? value : DEFAULT_ROOM_CODE;
}

function getInitialView(): UserRole {
  const value = new URLSearchParams(window.location.search).get('view');
  return value === 'stage' ? 'stage' : 'participant';
}

function getServerUrl() {
  const configuredUrl = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configuredUrl) return configuredUrl;
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:3000`;
  return window.location.origin;
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

function getRandomAvatar() {
  return AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)];
}

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomCode] = useState(getRoomCode);
  const [roomName, setRoomName] = useState(DEFAULT_ROOM_NAME);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker | null>(null);
  const [speakerBuffer, setSpeakerBuffer] = useState<SpeakerBuffer | null>(null);
  const [history, setHistory] = useState<SpeakerHistoryItem[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeViewState, setActiveViewState] = useState<UserRole>(getInitialView);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(() => {
    if (getInitialView() === 'stage') return true;
    return localStorage.getItem(`${USER_KEY}_joined_${getRoomCode()}`) === 'true';
  });

  const [currentUserId] = useState(() => {
    const saved = localStorage.getItem(`${USER_KEY}_id`);
    if (saved) return saved;
    const id = randomId('user');
    localStorage.setItem(`${USER_KEY}_id`, id);
    return id;
  });
  const [participantToken] = useState(() => {
    const saved = localStorage.getItem(`${USER_KEY}_token`);
    if (saved) return saved;
    const token = randomId('identity');
    localStorage.setItem(`${USER_KEY}_token`, token);
    return token;
  });
  const [currentUserName, setCurrentUserNameState] = useState(() => (
    localStorage.getItem(`${USER_KEY}_${roomCode}_name`) || localStorage.getItem(`${USER_KEY}_name`) || 'Guest Participant'
  ));
  const [currentUserAvatar, setCurrentUserAvatarState] = useState(() => (
    localStorage.getItem(`${USER_KEY}_${roomCode}_avatar`) || localStorage.getItem(`${USER_KEY}_avatar`) || getRandomAvatar()
  ));

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const previousSpeakerRef = useRef<ActiveSpeaker | null>(null);
  const previousBufferRef = useRef<SpeakerBuffer | null>(null);
  const activeViewRef = useRef(activeViewState);

  useEffect(() => {
    activeViewRef.current = activeViewState;
  }, [activeViewState]);

  useEffect(() => {
    if (!hasJoinedRoom) {
      setConnected(false);
      setReconnecting(false);
      return;
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(getServerUrl(), {
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    const applyState = (state: Parameters<ServerToClientEvents['meeting-state']>[0]) => {
      const previousSpeaker = previousSpeakerRef.current;
      const previousBuffer = previousBufferRef.current;
      const currentSpeaker = state.activeSpeaker;
      const presentationDevice = activeViewRef.current === 'moderator' || activeViewRef.current === 'stage';

      soundManager.setSoundEnabled(state.settings.soundEnabled);
      if (presentationDevice && previousBuffer && !state.speakerBuffer && state.activeSpeaker) {
        soundManager.playPop();
      }
      if (
        presentationDevice &&
        previousSpeaker &&
        currentSpeaker &&
        previousSpeaker.queueItem.id === currentSpeaker.queueItem.id &&
        previousSpeaker.remainingSeconds > state.settings.warningChimeSeconds &&
        currentSpeaker.remainingSeconds <= state.settings.warningChimeSeconds &&
        currentSpeaker.remainingSeconds > 0
      ) {
        soundManager.playWarningChime();
      }
      if (
        presentationDevice &&
        previousSpeaker &&
        currentSpeaker &&
        previousSpeaker.queueItem.id === currentSpeaker.queueItem.id &&
        previousSpeaker.remainingSeconds > 0 &&
        currentSpeaker.remainingSeconds === 0
      ) {
        soundManager.playTimerEndAlert();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }

      previousSpeakerRef.current = state.activeSpeaker;
      previousBufferRef.current = state.speakerBuffer;
      setRoomName(state.roomName);
      setQueue(state.queue);
      setActiveSpeaker(state.activeSpeaker);
      setSpeakerBuffer(state.speakerBuffer);
      setHistory(state.history);
      setSettings(state.settings);
    };

    const joinRoom = () => {
      const moderatorToken = sessionStorage.getItem(`${MODERATOR_TOKEN_KEY}_${roomCode}`) || undefined;
      socket.emit('join-room', { roomCode, participantId: currentUserId, participantToken, moderatorToken }, (response) => {
        if (!response.ok || !response.state) {
          setConnectionError(response.error || 'Could not join the meeting room.');
          return;
        }
        applyState(response.state);
        setIsModerator(Boolean(response.moderatorAuthorized));
        setConnected(true);
        setReconnecting(false);
        setConnectionError(null);
      });
    };

    socket.on('connect', joinRoom);
    socket.on('disconnect', () => {
      setConnected(false);
      setReconnecting(true);
    });
    socket.on('connect_error', () => {
      setConnected(false);
      setReconnecting(true);
      setConnectionError('Cannot reach the meeting server. Check Wi-Fi and the host computer.');
    });
    socket.on('meeting-state', applyState);
    socket.on('server-error', setConnectionError);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, hasJoinedRoom, participantToken, roomCode]);

  const emitCommand = (type: MeetingCommandType, payload?: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setConnectionError('You are offline. Wait for the meeting server to reconnect.');
      return;
    }
    setConnectionError(null);
    soundManager.playPop();
    socket.emit('meeting-command', {
      id: randomId('cmd'),
      roomCode,
      participantId: currentUserId,
      participantToken,
      moderatorToken: sessionStorage.getItem(`${MODERATOR_TOKEN_KEY}_${roomCode}`) || undefined,
      type,
      payload,
    }, (response) => {
      if (!response.ok) setConnectionError(response.error || 'The server rejected that action.');
    });
  };

  const setActiveView = (view: UserRole) => {
    if (view === 'moderator' && !isModerator) return;
    setActiveViewState(view);
  };

  const authorizeModerator = (pin: string) => new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      resolve({ ok: false, error: 'The meeting server is offline.' });
      return;
    }
    socket.emit('authenticate-moderator', { roomCode, pin }, (response) => {
      if (!response.ok || !response.moderatorToken) {
        resolve({ ok: false, error: response.error || 'Moderator authentication failed.' });
        return;
      }
      sessionStorage.setItem(`${MODERATOR_TOKEN_KEY}_${roomCode}`, response.moderatorToken);
      setIsModerator(true);
      setActiveViewState('moderator');
      resolve({ ok: true });
    });
  });

  const saveCurrentUserInfo = (name: string, avatar: string) => {
    const safeName = name.trim().slice(0, 60);
    if (!safeName) return false;
    setCurrentUserNameState(safeName);
    setCurrentUserAvatarState(avatar);
    localStorage.setItem(`${USER_KEY}_name`, safeName);
    localStorage.setItem(`${USER_KEY}_avatar`, avatar);
    localStorage.setItem(`${USER_KEY}_${roomCode}_name`, safeName);
    localStorage.setItem(`${USER_KEY}_${roomCode}_avatar`, avatar);
    return true;
  };

  const joinRoom = (name: string, avatar: string) => {
    if (!saveCurrentUserInfo(name, avatar)) return;
    localStorage.setItem(`${USER_KEY}_joined_${roomCode}`, 'true');
    setHasJoinedRoom(true);
  };

  const leaveRoom = () => {
    emitCommand('leave-meeting');
    localStorage.removeItem(`${USER_KEY}_joined_${roomCode}`);
    sessionStorage.removeItem(`${MODERATOR_TOKEN_KEY}_${roomCode}`);
    setIsModerator(false);
    setActiveViewState('participant');
    setHasJoinedRoom(false);
  };

  const setCurrentUserInfo = (name: string, avatar: string) => {
    saveCurrentUserInfo(name, avatar);
  };

  const getParticipantTotalSpokenSeconds = (participantId?: string, name?: string) => history.reduce((total, item) => {
    const matchesId = participantId && item.participantId === participantId;
    const matchesName = name && item.participantName.toLowerCase() === name.toLowerCase();
    return matchesId || matchesName ? total + item.actualDurationSeconds : total;
  }, 0);

  const getParticipantTurnCount = (participantId?: string, name?: string) => history.filter((item) => {
    const matchesId = participantId && item.participantId === participantId;
    const matchesName = name && item.participantName.toLowerCase() === name.toLowerCase();
    return matchesId || matchesName;
  }).length;

  const isUserInQueue = queue.some((item) => item.participant.id === currentUserId);
  const userQueuePosition = queue.findIndex((item) => item.participant.id === currentUserId) + 1;

  const value = useMemo<MeetingContextType>(() => ({
    roomCode,
    roomName,
    queue,
    activeSpeaker,
    speakerBuffer,
    history,
    settings,
    activeView: activeViewState,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    connected,
    reconnecting,
    connectionError,
    isModerator,
    hasJoinedRoom,
    getParticipantTotalSpokenSeconds,
    getParticipantTurnCount,
    setActiveView,
    authorizeModerator,
    joinRoom,
    leaveRoom,
    setCurrentUserInfo,
    raiseHand: (note) => emitCommand('raise-hand', { name: currentUserName, avatar: currentUserAvatar, note }),
    lowerHand: () => emitCommand('lower-hand'),
    isUserInQueue,
    userQueuePosition,
    reorderQueue: (startIndex, endIndex) => emitCommand('reorder-queue', { startIndex, endIndex }),
    moveQueueItem: (queueItemId, direction) => emitCommand('move-queue-item', { queueItemId, direction }),
    dismissQueueItem: (queueItemId) => emitCommand('dismiss-queue-item', { queueItemId }),
    startSpeaker: (queueItemId, secondsOverride, skipBuffer = false) => emitCommand('start-speaker', { queueItemId, secondsOverride, skipBuffer }),
    skipBuffer: () => emitCommand('skip-buffer'),
    cancelBuffer: () => emitCommand('cancel-buffer'),
    pauseTimer: () => emitCommand('pause-timer'),
    resumeTimer: () => emitCommand('resume-timer'),
    addTime: (seconds) => emitCommand('add-time', { seconds }),
    setSpeakerTimer: (seconds) => emitCommand('set-speaker-timer', { seconds }),
    finishCurrentSpeaker: (reason = 'completed', autoAdvanceNext = false) => emitCommand('finish-speaker', { reason, autoAdvanceNext }),
    updateSettings: (newSettings) => emitCommand('update-settings', { settings: newSettings }),
    resetSession: () => emitCommand('reset-session'),
    loadDemoData: () => emitCommand('load-demo-data'),
  // Action functions intentionally close over the latest render state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    roomCode, roomName, queue, activeSpeaker, speakerBuffer, history, settings, activeViewState,
    currentUserId, currentUserName, currentUserAvatar, connected, reconnecting, connectionError,
    isModerator, hasJoinedRoom, isUserInQueue, userQueuePosition,
  ]);

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>;
};

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (!context) throw new Error('useMeeting must be used within a MeetingProvider');
  return context;
};
