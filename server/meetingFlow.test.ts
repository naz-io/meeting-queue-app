import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MeetingStore } from './meetingStore.ts';
import { openRoom, setup, TEST_PIN } from './testSupport.ts';
import type { CommandPayloads, MeetingCommandType } from '../shared/protocol.ts';

// End-to-end behaviour of a meeting: permissions, the 250 ms timer loop, and restarts.

/** A valid payload for every command; the mapped type forces an entry for each new command. */
const SAMPLE_PAYLOADS: { [T in MeetingCommandType]: CommandPayloads[T] } = {
  'raise-hand': { name: 'Guest' },
  'lower-hand': undefined,
  'leave-meeting': undefined,
  'move-queue-item': { queueItemId: 'missing', direction: 'up' },
  'reorder-queue': { startIndex: 0, endIndex: 0 },
  'dismiss-queue-item': { queueItemId: 'missing' },
  'start-speaker': {},
  'skip-buffer': undefined,
  'cancel-buffer': undefined,
  'pause-timer': undefined,
  'resume-timer': undefined,
  'add-time': { seconds: 30 },
  'set-speaker-timer': { seconds: 60 },
  'finish-speaker': {},
  'update-settings': { settings: { soundEnabled: true } },
  'reset-session': undefined,
  'load-demo-data': undefined,
};
const COMMAND_TYPES = Object.keys(SAMPLE_PAYLOADS) as MeetingCommandType[];
const PARTICIPANT_COMMANDS = ['raise-hand', 'lower-hand', 'leave-meeting'];

test('participants may only raise, lower and leave; moderators may do everything', (t) => {
  const { command } = setup(t);
  for (const type of COMMAND_TYPES) {
    const response = command(type, SAMPLE_PAYLOADS[type], 'guest', false);
    if (PARTICIPANT_COMMANDS.includes(type)) {
      assert.equal(response.ok, true, `${type} as participant`);
    } else if (type === 'finish-speaker') {
      assert.match(response.error ?? '', /Only the active speaker/, 'a bystander cannot end a turn');
    } else {
      assert.equal(response.code, 'moderator-auth-required', `${type} as participant`);
    }
  }
  for (const type of COMMAND_TYPES) {
    assert.equal(command(type, SAMPLE_PAYLOADS[type]).ok, true, `${type} as moderator`);
  }
});

test('the active speaker can end their own turn but not advance the queue', (t) => {
  const { room, command, raise } = setup(t);
  raise('speaker'); raise('next');
  command('start-speaker', { skipBuffer: true });
  assert.equal(command('finish-speaker', { autoAdvanceNext: true }, 'speaker', false).ok, true);
  assert.equal(room.state.activeSpeaker, null);
  assert.equal(room.state.history[0].participantId, 'speaker');
  assert.deepEqual(room.state.queue.map((item) => item.participant.id), ['next']);
});

test('a repeated command id is applied once', (t) => {
  const { store, room } = setup(t);
  const raw = { id: 'same', roomCode: 'TEST-ROOM', participantId: 'p', participantToken: 'token-p', type: 'raise-hand', payload: { name: 'P' } };
  assert.equal(store.handleCommand(raw).ok, true);
  store.handleCommand({ ...raw });
  store.handleCommand({ ...raw, type: 'lower-hand', payload: undefined });
  assert.equal(room.state.queue.length, 1, 'both repeats ignored, including one with a different type');
});

test('the transition buffer hands over to the speaker when it runs out', async (t) => {
  const { room, command, raise, start, advance, store } = setup(t);
  await start();
  raise('speaker');
  command('start-speaker');
  assert.equal(room.state.speakerBuffer?.remainingBufferSeconds, 10);
  advance(4_000);
  assert.equal(room.state.speakerBuffer?.remainingBufferSeconds, 6);
  advance(6_000);
  assert.equal(room.state.speakerBuffer, null);
  assert.equal(room.state.activeSpeaker?.queueItem.participant.id, 'speaker');
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 120);
  await store.flush();
});

test('cancelling the buffer puts the speaker back at the front of the queue', (t) => {
  const { room, command, raise } = setup(t);
  raise('called'); raise('waiting');
  command('start-speaker');
  command('cancel-buffer');
  assert.equal(room.state.speakerBuffer, null);
  assert.deepEqual(room.state.queue.map((item) => item.participant.id), ['called', 'waiting']);
});

test('without auto-advance an expired speaker stays on the floor', async (t) => {
  const { room, command, raise, start, advance, store } = setup(t);
  await start();
  raise('speaker'); raise('next');
  command('start-speaker', { skipBuffer: true });
  advance(125_000);
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 0);
  assert.equal(room.state.activeSpeaker?.queueItem.participant.id, 'speaker');
  assert.equal(room.state.history.length, 0);
  await store.flush();
});

test('auto-advance waits 1.2 s after time runs out, logs the turn and calls the next person', async (t) => {
  const { room, command, raise, start, advance, store } = setup(t);
  await start();
  command('update-settings', { settings: { autoAdvance: true } });
  raise('speaker'); raise('next');
  command('start-speaker', { skipBuffer: true });
  advance(120_000);
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 0, 'time is up but the hand-off has not happened yet');
  advance(1_000);
  assert.equal(room.state.activeSpeaker?.queueItem.participant.id, 'speaker');
  advance(250);
  assert.equal(room.state.activeSpeaker, null);
  assert.equal(room.state.speakerBuffer?.queueItem.participant.id, 'next');
  assert.deepEqual(
    { reason: room.state.history[0].endedReason, spoke: room.state.history[0].actualDurationSeconds },
    { reason: 'completed', spoke: 120 },
  );
  await store.flush();
});

test('pausing freezes the countdown and resuming continues from the same point', async (t) => {
  const { room, command, raise, start, advance, store } = setup(t);
  await start();
  raise('speaker');
  command('start-speaker', { skipBuffer: true });
  advance(30_000);
  command('pause-timer');
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 90);
  advance(60_000);
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 90);
  command('resume-timer');
  advance(10_000);
  assert.equal(room.state.activeSpeaker?.remainingSeconds, 80);
  await store.flush();
});

test('adding and setting time stay between 1 second and 3 hours', (t) => {
  const { room, command, raise } = setup(t);
  raise('speaker');
  command('start-speaker', { skipBuffer: true });
  const active = () => room.state.activeSpeaker!;
  command('add-time', { seconds: -1_000 });
  assert.equal(active().remainingSeconds, 1);
  command('add-time', { seconds: 50_000 });
  assert.equal(active().remainingSeconds, 10_800);
  command('set-speaker-timer', { seconds: 0 });
  assert.equal(active().remainingSeconds, 10_800, 'zero is ignored');
  command('set-speaker-timer', { seconds: 99_999 });
  assert.equal(active().totalDurationSeconds, 10_800);
});

test('leaving while speaking logs the turn; leaving during the buffer does not', (t) => {
  const { room, command, raise } = setup(t);
  raise('speaker'); raise('buffered');
  command('start-speaker', { skipBuffer: true });
  command('leave-meeting', {}, 'speaker', false);
  assert.equal(room.state.activeSpeaker, null);
  assert.equal(room.state.history[0].endedReason, 'manual');

  command('start-speaker');
  assert.equal(room.state.speakerBuffer?.queueItem.participant.id, 'buffered');
  command('leave-meeting', {}, 'buffered', false);
  assert.equal(room.state.speakerBuffer, null);
  assert.equal(room.state.history.length, 1);
});

test('a restart resumes running timers from their saved end time', async (t) => {
  const { command, raise, advance, store, dataDirectory } = setup(t);
  raise('running');
  command('start-speaker', { skipBuffer: true });
  advance(30_000);
  await store.flush();

  // Fifteen seconds pass while the server is down.
  advance(15_000);
  const restarted = new MeetingStore(() => {}, { moderatorPin: TEST_PIN, dataDirectory });
  await restarted.initialize();
  advance(250);
  const active = openRoom(restarted, 'TEST-ROOM').state.activeSpeaker;
  assert.equal(active?.queueItem.participant.id, 'running');
  assert.equal(active?.remainingSeconds, 75);
  await restarted.flush();
});

test('a restart keeps a paused timer paused', async (t) => {
  const { command, raise, advance, store, dataDirectory } = setup(t);
  raise('paused');
  command('start-speaker', { skipBuffer: true });
  advance(20_000);
  command('pause-timer');
  await store.flush();

  advance(60_000);
  const restarted = new MeetingStore(() => {}, { moderatorPin: TEST_PIN, dataDirectory });
  await restarted.initialize();
  advance(5_000);
  const active = openRoom(restarted, 'TEST-ROOM').state.activeSpeaker;
  assert.equal(active?.isPaused, true);
  assert.equal(active?.remainingSeconds, 100);
  await restarted.flush();
});

test('a running timer is broadcast at hand-offs and expiry, not every second', async (t) => {
  const { command, raise, start, advance, store, broadcasts } = setup(t);
  await start();
  raise('speaker');
  command('start-speaker');
  const afterCall = broadcasts.length;

  advance(9_000);
  assert.equal(broadcasts.length, afterCall, 'buffer counting down: nothing sent');
  advance(1_000);
  assert.equal(broadcasts.length, afterCall + 1, 'buffer ran out: speaker starts');

  advance(119_000);
  assert.equal(broadcasts.length, afterCall + 1, 'speaker counting down: nothing sent');
  advance(1_000);
  assert.equal(broadcasts.length, afterCall + 2, 'time ran out');
  const last = broadcasts.at(-1) as { activeSpeaker: { remainingSeconds: number; endsAt: number } };
  assert.equal(last.activeSpeaker.remainingSeconds, 0);

  advance(10_000);
  assert.equal(broadcasts.length, afterCall + 2, 'an expired speaker is not re-sent');
  await store.flush();
});
