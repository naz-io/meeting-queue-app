import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { MeetingStore } from './meetingStore.ts';
import type { MeetingCommandType } from '../src/types/realtime.ts';

function tempDataDirectory(t: TestContext) {
  const directory = mkdtempSync(path.join(tmpdir(), 'meeting-store-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function setup(t: TestContext) {
  // Fake timers keep debounced saves from firing; the temp directory keeps real data safe if one does.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dataDirectory = tempDataDirectory(t);
  const broadcasts: unknown[] = [];
  const store = new MeetingStore((_code, state) => broadcasts.push(structuredClone(state)), { dataDirectory });
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
  return { store, room, command, raise, change, broadcasts, dataDirectory };
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

test('flush writes pending changes without waiting for the debounce', async (t) => {
  const { store, raise, dataDirectory } = setup(t);
  raise('last-second');
  await store.flush();
  const saved = JSON.parse(readFileSync(path.join(dataDirectory, 'meetings.json'), 'utf8'));
  assert.equal(saved['TEST-ROOM'].state.queue[0].participant.id, 'last-second');
});

test('flushing during a pending write keeps the latest state', async (t) => {
  const { store, raise, dataDirectory } = setup(t);
  raise('first');
  const firstFlush = store.flush();
  raise('second');
  await Promise.all([firstFlush, store.flush()]);
  const saved = JSON.parse(readFileSync(path.join(dataDirectory, 'meetings.json'), 'utf8'));
  assert.deepEqual(saved['TEST-ROOM'].state.queue.map((item: { participant: { id: string } }) => item.participant.id), ['first', 'second']);
});

test('queue moves reject unknown directions and keep the order', (t) => {
  const { room, raise, command } = setup(t);
  raise('a'); raise('b'); raise('c');
  const order = () => room.state.queue.map((item) => item.participant.id);
  const middle = room.state.queue[1].id;
  assert.equal(command('move-queue-item', { queueItemId: middle, direction: 'sideways' }).ok, false);
  assert.deepEqual(order(), ['a', 'b', 'c']);
  assert.equal(command('move-queue-item', { queueItemId: middle, direction: 'top' }).ok, true);
  assert.deepEqual(order(), ['b', 'a', 'c']);
});

test('reorder rejects fractional positions', (t) => {
  const { room, raise, command } = setup(t);
  raise('a'); raise('b'); raise('c');
  const order = () => room.state.queue.map((item) => item.participant.id);
  assert.equal(command('reorder-queue', { startIndex: 0.5, endIndex: 2 }).ok, false);
  assert.deepEqual(order(), ['a', 'b', 'c']);
  assert.equal(command('reorder-queue', { startIndex: 0, endIndex: 2 }).ok, true);
  assert.deepEqual(order(), ['b', 'c', 'a']);
});

test('turning auto-advance off cancels a pending hand-off', (t) => {
  const { room, command } = setup(t);
  command('update-settings', { settings: { autoAdvance: true } });
  room.autoAdvanceAt = Date.now() + 1000;
  command('update-settings', { settings: { autoAdvance: false } });
  assert.equal(room.autoAdvanceAt, undefined);
});

test('moderator PIN must be the exact string', (t) => {
  const { store } = setup(t);
  assert.ok(store.authenticateModerator('TEST-ROOM', '7892'));
  for (const wrong of ['789', '78920', '', 7892, null, { pin: '7892' }]) {
    assert.equal(store.authenticateModerator('TEST-ROOM', wrong), null);
  }
});
