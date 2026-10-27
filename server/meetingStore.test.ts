import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { MeetingStore } from './meetingStore.ts';
import { openRoom, setup, tempDataDirectory } from './testSupport.ts';

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

test('moderator tokens expire after 12 hours', async (t) => {
  const { store, command, moderatorToken } = setup(t);
  assert.equal(store.isModerator('TEST-ROOM', moderatorToken), true);
  t.mock.timers.tick(12 * 60 * 60 * 1000 - 1);
  assert.equal(store.isModerator('TEST-ROOM', moderatorToken), true);
  t.mock.timers.tick(1);
  assert.equal(store.isModerator('TEST-ROOM', moderatorToken), false);
  const response = command('reset-session');
  assert.equal(response.ok, false);
  assert.equal(response.code, 'moderator-auth-required');
  // Advancing the clock fired the debounced save; let it finish before the temp folder is removed.
  await store.flush();
});

test('each login gets its own token and others stay valid', (t) => {
  const { store, moderatorToken } = setup(t);
  const second = store.authenticateModerator('TEST-ROOM', '7892');
  assert.ok(second && second !== moderatorToken);
  assert.equal(store.isModerator('TEST-ROOM', moderatorToken), true);
  assert.equal(store.isModerator('TEST-ROOM', second), true);
  assert.equal(store.isModerator('OTHER-ROOM', second), false);
  for (const bogus of [undefined, '', 'guess', 42]) assert.equal(store.isModerator('TEST-ROOM', bogus), false);
});

test('sessions survive a restart but not a PIN change', async (t) => {
  const { store, dataDirectory, moderatorToken } = setup(t);
  await store.flush();
  const saved = readFileSync(path.join(dataDirectory, 'meetings.json'), 'utf8');
  assert.equal(saved.includes(moderatorToken), false, 'raw tokens are never written to disk');

  const restarted = new MeetingStore(() => {}, { moderatorPin: '7892', dataDirectory });
  await restarted.initialize();
  assert.equal(restarted.isModerator('TEST-ROOM', moderatorToken), true);

  const newPin = new MeetingStore(() => {}, { moderatorPin: '135790', dataDirectory });
  await newPin.initialize();
  assert.equal(newPin.isModerator('TEST-ROOM', moderatorToken), false);
});

test('files with the old single moderator token load and sign everyone out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dataDirectory = tempDataDirectory(t);
  const legacy = openRoom(new MeetingStore(() => {}, { moderatorPin: '7892', dataDirectory }), 'OLD-ROOM');
  writeFileSync(path.join(dataDirectory, 'meetings.json'), JSON.stringify({
    'OLD-ROOM': { state: legacy.state, moderatorToken: 'legacy-token', participantTokens: { p1: 't1' } },
  }));
  const store = new MeetingStore(() => {}, { moderatorPin: '7892', dataDirectory });
  await store.initialize();
  const room = openRoom(store, 'OLD-ROOM');
  assert.equal(store.isModerator('OLD-ROOM', 'legacy-token'), false);
  assert.deepEqual(room.moderatorSessions, {});
  assert.deepEqual(room.participantTokens, { p1: 't1' });
  assert.equal('moderatorToken' in room, false);
});

test('room codes are validated and normalised before a room exists', (t) => {
  const { store } = setup(t);
  for (const bad of ['ab', 'room code!', '', 'X'.repeat(25), 42, null]) {
    const opened = store.openRoom(bad);
    assert.equal(opened.ok, false);
    assert.equal(!opened.ok && opened.code, 'invalid-room');
  }
  const opened = store.openRoom('  team-a ');
  assert.equal(opened.ok && opened.roomCode, 'TEAM-A');
});

test('commands and logins never create rooms', (t) => {
  const { store } = setup(t);
  const response = store.handleCommand({
    id: 'c1', roomCode: 'GHOST-ROOM', participantId: 'p', participantToken: 't', type: 'raise-hand',
  });
  assert.equal(response.ok, false);
  assert.equal(store.authenticateModerator('GHOST-ROOM', '7892'), null);
  assert.equal(store.getSnapshot('GHOST-ROOM'), null);
  assert.equal(store.openRoom('GHOST-ROOM').ok, true, 'still free to open properly afterwards');
});

test('the room limit frees up as idle empty rooms age out', async (t) => {
  const { store, raise } = setup(t);
  raise('keeps-test-room-busy');
  for (let index = 2; index <= 50; index++) assert.equal(store.openRoom(`ROOM-${index}`).ok, true);
  const full = store.openRoom('ROOM-51');
  assert.equal(!full.ok && full.code, 'room-limit');

  t.mock.timers.tick(24 * 60 * 60 * 1000 - 1);
  assert.equal(store.openRoom('ROOM-51').ok, false, 'not idle for a full day yet');
  t.mock.timers.tick(1);
  assert.equal(store.openRoom('ROOM-51').ok, true);
  assert.ok(store.getSnapshot('TEST-ROOM'), 'a room with people queued is never pruned');
  assert.equal(store.getSnapshot('ROOM-2'), null);
  await store.flush();
});

test('the queue stops at 200 people', (t) => {
  const { room, raise } = setup(t);
  for (let index = 1; index <= 200; index++) assert.equal(raise(`p${index}`).ok, true);
  const response = raise('p201');
  assert.equal(response.ok, false);
  assert.match(response.error ?? '', /queue is full/);
  assert.equal(room.state.queue.length, 200);
});

test('malformed commands are refused before they touch the room', (t) => {
  const { store, room } = setup(t);
  const before = structuredClone(room.state);
  for (const raw of [null, 'reset-session', { type: 'reset-session' }, { roomCode: 'TEST-ROOM', type: 'reset-session', payload: 1 }]) {
    assert.equal(store.handleCommand(raw).ok, false);
  }
  assert.deepEqual(room.state, before);
});

test('per-device fields in older files are not loaded or broadcast', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dataDirectory = tempDataDirectory(t);
  const fresh = openRoom(new MeetingStore(() => {}, { moderatorPin: '7892', dataDirectory }), 'OLD-ROOM');
  const oldState = { ...fresh.state, activeView: 'participant', currentUserId: '', currentUserName: '', currentUserAvatar: '' };
  writeFileSync(path.join(dataDirectory, 'meetings.json'), JSON.stringify({
    'OLD-ROOM': { state: oldState, moderatorSessions: {}, participantTokens: {} },
  }));
  const store = new MeetingStore(() => {}, { moderatorPin: '7892', dataDirectory });
  await store.initialize();
  const snapshot = store.getSnapshot('OLD-ROOM');
  assert.ok(snapshot);
  for (const field of ['activeView', 'currentUserId', 'currentUserName', 'currentUserAvatar']) {
    assert.equal(field in snapshot, false, field);
  }
  assert.equal(snapshot.roomCode, 'OLD-ROOM');
});
