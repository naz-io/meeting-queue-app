import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveSeconds, secondsUntil } from './countdown.ts';

test('counts whole seconds up, so 0 means time is really up', () => {
  assert.equal(secondsUntil(10_000, 0, 0), 10);
  assert.equal(secondsUntil(10_000, 0, 9_001), 1);
  assert.equal(secondsUntil(10_000, 0, 10_000), 0);
  assert.equal(secondsUntil(10_000, 0, 60_000), 0, 'never negative');
});

test('a device clock that is off is corrected by the server offset', () => {
  // The phone's clock is 30 s behind the server: offset = server - device = +30 s.
  const serverEndsAt = 100_000;
  const phoneNow = 40_000; // server time is actually 70 000
  assert.equal(secondsUntil(serverEndsAt, 30_000, phoneNow), 30);
  assert.equal(secondsUntil(serverEndsAt, 0, phoneNow), 60, 'without the offset it would be 30 s wrong');
});

test('paused or missing timers show their frozen value', () => {
  assert.equal(liveSeconds({ isPaused: true, endsAt: undefined }, 42, 0, 0), 42);
  assert.equal(liveSeconds(null, 7, 0, 0), 7);
  assert.equal(liveSeconds({ isPaused: false, endsAt: 5_000 }, 99, 0, 0), 5);
});
