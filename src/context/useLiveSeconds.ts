import { useEffect, useState } from 'react';
import { liveSeconds } from '../utils/countdown';

/**
 * Remaining seconds for a server timer, computed on this device. While the timer runs it checks
 * four times a second but only re-renders when the whole-second value changes, and it catches up
 * immediately when a sleeping phone or background tab becomes visible again.
 */
export function useLiveSeconds(
  timer: { endsAt?: number; isPaused: boolean } | null,
  frozenSeconds: number,
  serverOffsetMs: number,
) {
  const [, setRenderedSeconds] = useState(0);
  const running = Boolean(timer && !timer.isPaused && timer.endsAt);
  const endsAt = timer?.endsAt;

  useEffect(() => {
    if (!running) return;
    const update = () => setRenderedSeconds(liveSeconds({ endsAt, isPaused: false }, 0, serverOffsetMs));
    const interval = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, [running, endsAt, serverOffsetMs]);

  // Computed during render so a new timer shows its correct value on the very first frame.
  return liveSeconds(timer, frozenSeconds, serverOffsetMs);
}
