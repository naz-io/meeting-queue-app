import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PinAttemptLimiter } from './pinAttempts.ts';

test('five wrong PINs lock the client for 30 seconds', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const limiter = new PinAttemptLimiter();
  for (let attempt = 0; attempt < 4; attempt++) limiter.recordFailure('phone');
  assert.equal(limiter.retryAfterSeconds('phone'), 0);
  limiter.recordFailure('phone');
  assert.equal(limiter.retryAfterSeconds('phone'), 30);
  assert.equal(limiter.retryAfterSeconds('laptop'), 0);
  t.mock.timers.tick(30_000);
  assert.equal(limiter.retryAfterSeconds('phone'), 0);
});

test('each new lock doubles, capped at five minutes', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const limiter = new PinAttemptLimiter();
  const expected = [30, 60, 120, 240, 300, 300];
  for (const seconds of expected) {
    for (let attempt = 0; attempt < 5; attempt++) limiter.recordFailure('phone');
    assert.equal(limiter.retryAfterSeconds('phone'), seconds);
    t.mock.timers.tick(seconds * 1000);
  }
});

test('a correct PIN clears the history', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const limiter = new PinAttemptLimiter();
  for (let attempt = 0; attempt < 4; attempt++) limiter.recordFailure('phone');
  limiter.recordSuccess('phone');
  limiter.recordFailure('phone');
  assert.equal(limiter.retryAfterSeconds('phone'), 0);
});

test('failures are forgotten after an hour of quiet', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const limiter = new PinAttemptLimiter();
  for (let attempt = 0; attempt < 5; attempt++) limiter.recordFailure('phone');
  t.mock.timers.tick(61 * 60_000);
  assert.equal(limiter.retryAfterSeconds('phone'), 0);
  for (let attempt = 0; attempt < 5; attempt++) limiter.recordFailure('phone');
  assert.equal(limiter.retryAfterSeconds('phone'), 30);
});
