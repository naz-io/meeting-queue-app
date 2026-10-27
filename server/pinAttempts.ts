const MAX_FAILURES = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 5 * 60_000;
const FORGET_AFTER_MS = 60 * 60_000;

interface AttemptRecord {
  failures: number;
  lockCount: number;
  lockedUntil: number;
  lastFailureAt: number;
}

/** Locks out a client after repeated wrong PINs; each lock doubles, up to five minutes. */
export class PinAttemptLimiter {
  private records = new Map<string, AttemptRecord>();

  /** Seconds the client must still wait, or 0 if it may try now. */
  retryAfterSeconds(key: string) {
    const record = this.records.get(key);
    if (!record) return 0;
    const timestamp = Date.now();
    if (timestamp - record.lastFailureAt > FORGET_AFTER_MS) {
      this.records.delete(key);
      return 0;
    }
    return Math.max(0, Math.ceil((record.lockedUntil - timestamp) / 1000));
  }

  recordFailure(key: string) {
    const timestamp = Date.now();
    const record = this.records.get(key) ?? { failures: 0, lockCount: 0, lockedUntil: 0, lastFailureAt: 0 };
    record.failures += 1;
    record.lastFailureAt = timestamp;
    if (record.failures >= MAX_FAILURES) {
      record.lockedUntil = timestamp + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** record.lockCount);
      record.lockCount += 1;
      record.failures = 0;
    }
    this.records.set(key, record);
  }

  recordSuccess(key: string) {
    this.records.delete(key);
  }
}
