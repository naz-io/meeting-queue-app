/* oxlint-disable react/only-export-components -- Provider and hook form one context module. */
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { ActiveSpeaker, SpeakerBuffer } from '../../shared/meeting';
import { soundManager } from '../utils/sound';
import { useLiveSeconds } from './useLiveSeconds';

// The only part of the app that changes every second. It lives in its own context so a running
// timer re-renders just the components that display seconds, not the whole meeting screen.

interface Countdown {
  speakerSeconds: number;
  bufferSeconds: number;
}

const CountdownContext = createContext<Countdown>({ speakerSeconds: 0, bufferSeconds: 0 });

interface CountdownProviderProps {
  activeSpeaker: ActiveSpeaker | null;
  speakerBuffer: SpeakerBuffer | null;
  serverOffsetMs: number;
  warningChimeSeconds: number;
  /** Moderator and stage screens play the warning chime and time-up alert; phones stay quiet. */
  playsAlerts: boolean;
  children: React.ReactNode;
}

export const CountdownProvider: React.FC<CountdownProviderProps> = ({
  activeSpeaker,
  speakerBuffer,
  serverOffsetMs,
  warningChimeSeconds,
  playsAlerts,
  children,
}) => {
  const speakerSeconds = useLiveSeconds(activeSpeaker, activeSpeaker?.remainingSeconds ?? 0, serverOffsetMs);
  const bufferSeconds = useLiveSeconds(speakerBuffer, speakerBuffer?.remainingBufferSeconds ?? 0, serverOffsetMs);

  const lastCountdownRef = useRef<{ queueItemId: string; seconds: number } | null>(null);
  const speakerId = activeSpeaker?.queueItem.id;
  useEffect(() => {
    const previous = lastCountdownRef.current;
    lastCountdownRef.current = speakerId ? { queueItemId: speakerId, seconds: speakerSeconds } : null;
    if (!playsAlerts || !previous || previous.queueItemId !== speakerId) return;

    if (previous.seconds > warningChimeSeconds && speakerSeconds <= warningChimeSeconds && speakerSeconds > 0) {
      soundManager.playWarningChime();
    }
    if (previous.seconds > 0 && speakerSeconds === 0) {
      soundManager.playTimerEndAlert();
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  }, [playsAlerts, speakerId, speakerSeconds, warningChimeSeconds]);

  const value = useMemo(() => ({ speakerSeconds, bufferSeconds }), [speakerSeconds, bufferSeconds]);
  return <CountdownContext.Provider value={value}>{children}</CountdownContext.Provider>;
};

/** Live seconds left for the active speaker and the transition buffer, counted on this device. */
export const useCountdown = () => useContext(CountdownContext);
