/**
 * Whole seconds left until `endsAt` (a server timestamp), as this device sees it.
 * `serverOffsetMs` is server time minus device time, so a phone whose clock is off still counts
 * down in step with the meeting server.
 */
export function secondsUntil(endsAt: number, serverOffsetMs: number, deviceNow = Date.now()) {
  return Math.max(0, Math.ceil((endsAt - (deviceNow + serverOffsetMs)) / 1000));
}

/** Remaining seconds for a timer the server describes by end time, or by a frozen value while paused. */
export function liveSeconds(
  timer: { endsAt?: number; isPaused: boolean } | null,
  frozenSeconds: number,
  serverOffsetMs: number,
  deviceNow = Date.now(),
) {
  if (!timer || timer.isPaused || !timer.endsAt) return frozenSeconds;
  return secondsUntil(timer.endsAt, serverOffsetMs, deviceNow);
}
