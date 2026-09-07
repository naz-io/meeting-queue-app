import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { MeetingStore } from './meetingStore.ts';
import type { MeetingCommandType } from '../src/types/realtime.ts';

function setup(t: TestContext) {
  // Prevent persistence timers from touching the real meeting data.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const broadcasts: unknown[] = [];
  const store = new MeetingStore((_code, state) => broadcasts.push(structuredClone(state)));
  const room = store.getRoom('TEST-ROOM');
  let sequence = 0;
  const command = (type: MeetingCommandType, payload = {}, participantId = 'moderator', authorized = true) =>
    store.handleCommand({
      id: String(++sequence), roomCode: 'TEST-ROOM', participantId,
      participantToken: `token-${participantId}`,
      moderatorToken: authorized ? room.moderatorToken : undefined,
      type, payload,
    });
  const raise = (id: string) => command('raise-hand', { name: id }, id);
  const change = (seconds: number, scope?: string) => command('update-settings', {
    settings: { defaultTimerSeconds: seconds }, speakingTimeScope: scope,
  });
  return { room, command, raise, change, broadcasts };
}

test('existing queue changes preserve order and identity and reach subscribers', (t) => {
  const { room, raise, change, broadcasts } = setup(t);
  raise('first'); raise('second');
  const previous = structuredClone(room.state.queue);
  assert.equal(change(300, 'existing-queue').ok, true);
  assert.deepEqual(room.state.queue, previous.map((item) => ({ ...item, allocatedSeconds: 300 })));
  assert.deepEqual((broadcasts.at(-1) as typeof room.state).queue, room.state.queue);
  raise('third');
  assert.equal(room.state.queue[2].allocatedSeconds, 300);
});

test('from now on and legacy changes preserve existing allocations', (t) => {
  const { room, raise, change } = setup(t);
  raise('first');
  change(180, 'from-now-on'); raise('second');
  change(60); raise('third');
  assert.deepEqual(room.state.queue.map((item) => item.allocatedSeconds), [120, 180, 60]);
});

test('both scopes preserve running, paused and expired active speakers', (t) => {
  const { room, raise, change, command } = setup(t);
  raise('speaker'); raise('waiting');
  command('start-speaker', { skipBuffer: true });
  for (const paused of [false, true]) {
    for (const remaining of [90, 0]) {
      room.state.activeSpeaker!.isPaused = paused;
      room.state.activeSpeaker!.remainingSeconds = remaining;
      const active = structuredClone(room.state.activeSpeaker);
      change(300, 'existing-queue');
      assert.deepEqual(room.state.activeSpeaker, active);
      change(60, 'from-now-on');
      assert.deepEqual(room.state.activeSpeaker, active);
    }
  }
});

test('a called speaker keeps their time through the transition buffer', (t) => {
  const { room, raise, change, command } = setup(t);
  raise('called'); raise('waiting');
  command('start-speaker');
  const buffer = structuredClone(room.state.speakerBuffer);
  change(300, 'existing-queue');
  assert.deepEqual(room.state.speakerBuffer, buffer);
  assert.equal(room.state.queue[0].allocatedSeconds, 300);
  command('skip-buffer');
  assert.equal(room.state.activeSpeaker?.totalDurationSeconds, 120);
});

test('empty queues, bounds, invalid inputs and moderator authorization', (t) => {
  const { room, change, command } = setup(t);
  assert.equal(change(50000, 'existing-queue').ok, true);
  assert.equal(room.state.settings.defaultTimerSeconds, 10800);
  const previous = structuredClone(room.state);
  assert.equal(change(NaN, 'existing-queue').ok, false);
  assert.equal(change(60, 'invalid').ok, false);
  assert.equal(command('update-settings', {
    settings: { defaultTimerSeconds: 60 }, speakingTimeScope: 'existing-queue',
  }, 'guest', false).ok, false);
  assert.deepEqual(room.state, previous);
});
