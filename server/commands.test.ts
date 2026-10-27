import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from './commands.ts';

const envelope = { id: 'c1', roomCode: 'TEST-ROOM', participantId: 'p1', participantToken: 't1' };
const parse = (type: string, payload?: unknown, extra: object = {}) => parseCommand({ ...envelope, ...extra, type, payload });

function expectError(result: ReturnType<typeof parseCommand>, pattern: RegExp) {
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', pattern);
}

test('a valid command comes back typed and unchanged', () => {
  const result = parse('move-queue-item', { queueItemId: 'q_1', direction: 'top' });
  assert.ok(result.ok);
  assert.equal(result.command.type, 'move-queue-item');
  if (result.command.type === 'move-queue-item') {
    // Narrowed: TypeScript knows this payload's exact shape here.
    assert.deepEqual(result.command.payload, { queueItemId: 'q_1', direction: 'top' });
  }
});

test('commands without a payload accept a missing, null or empty one', () => {
  for (const payload of [undefined, null, {}]) {
    const result = parse('lower-hand', payload);
    assert.ok(result.ok);
    assert.equal(result.command.payload, undefined);
  }
});

test('anything that is not a command object is rejected, not thrown', () => {
  for (const raw of [null, undefined, 'raise-hand', 42, [], { type: 'raise-hand' }]) {
    assert.equal(parseCommand(raw).ok, false);
  }
  expectError(parse('make-coffee'), /type must be one of/);
  expectError(parse('add-time', 'thirty'), /payload must be an object/);
});

test('ids and tokens that are too long are rejected rather than shortened', () => {
  expectError(parse('lower-hand', undefined, { participantToken: 'x'.repeat(201) }), /participantToken is not valid/);
  expectError(parse('lower-hand', undefined, { moderatorToken: 'x'.repeat(201) }), /moderatorToken is not valid/);
  expectError(parse('lower-hand', undefined, { id: 7 }), /id is not valid/);
  assert.ok(parse('lower-hand', undefined, { participantToken: 'x'.repeat(200) }).ok);
});

test('display text is trimmed and shortened, and null means not sent', () => {
  const result = parse('raise-hand', { name: `  ${'N'.repeat(70)}  `, avatar: null, note: ' topic ' });
  assert.ok(result.ok && result.command.type === 'raise-hand');
  assert.deepEqual(result.command.payload, { name: 'N'.repeat(60), avatar: undefined, note: 'topic' });
  expectError(parse('raise-hand', { name: 42 }), /name must be text/);
});

test('numbers must be finite and positions whole', () => {
  expectError(parse('add-time', { seconds: Number.NaN }), /seconds must be a number/);
  expectError(parse('add-time', { seconds: '30' }), /seconds must be a number/);
  expectError(parse('add-time', {}), /seconds is required/);
  expectError(parse('reorder-queue', { startIndex: 0.5, endIndex: 1 }), /startIndex must be a whole number/);
  assert.ok(parse('add-time', { seconds: -30 }).ok, 'negative values are a business rule, handled by the store');
});

test('choices only accept their listed values', () => {
  expectError(parse('move-queue-item', { queueItemId: 'q', direction: 'sideways' }), /direction must be one of/);
  expectError(parse('finish-speaker', { reason: 'bored' }), /reason must be one of/);
  expectError(parse('update-settings', { settings: {}, speakingTimeScope: 'sometimes' }), /speakingTimeScope must be one of/);
});

test('settings patches keep only the fields that were sent', () => {
  const result = parse('update-settings', { settings: { autoAdvance: false, roomName: ' Hall B ', unknownField: 1 } });
  assert.ok(result.ok && result.command.type === 'update-settings');
  assert.deepEqual(result.command.payload, { settings: { autoAdvance: false, roomName: 'Hall B' }, speakingTimeScope: undefined });
  expectError(parse('update-settings', { settings: { soundEnabled: 'yes' } }), /soundEnabled must be true or false/);
});
