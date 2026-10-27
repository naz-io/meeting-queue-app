import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { io, type Socket } from 'socket.io-client';
import { startServer } from './app.ts';
import { tempDataDirectory, TEST_PIN } from './testSupport.ts';
import type { MeetingState } from '../src/types/index.ts';
import type { ClientToServerEvents, MeetingCommand, ServerToClientEvents } from '../src/types/realtime.ts';

// Runs the real server on a random port and talks to it over real sockets, like two phones would.

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const ROOM = 'SOCKET-TEST';

function connect(port: number): Promise<Client> {
  const socket: Client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true, reconnection: false });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Resolves with the next broadcast that matches, so tests wait for real pushes instead of sleeping. */
function nextState(socket: Client, matches: (state: MeetingState) => boolean) {
  return new Promise<MeetingState>((resolve) => {
    const listener = (state: MeetingState) => {
      if (!matches(state)) return;
      socket.off('meeting-state', listener);
      resolve(state);
    };
    socket.on('meeting-state', listener);
  });
}

let sequence = 0;
function send(socket: Client, participantId: string, command: Omit<MeetingCommand, 'id' | 'roomCode' | 'participantId' | 'participantToken'>) {
  return socket.emitWithAck('meeting-command', {
    id: `cmd-${++sequence}`, roomCode: ROOM, participantId, participantToken: `token-${participantId}`, ...command,
  } as MeetingCommand);
}

test('two devices share one live meeting through the real server', { timeout: 15_000 }, async (t) => {
  const dataDirectory = tempDataDirectory(t);
  const server = await startServer({ port: 0, host: '127.0.0.1', moderatorPin: TEST_PIN, dataDirectory });
  const phone = await connect(server.port);
  const stage = await connect(server.port);
  t.after(async () => {
    phone.disconnect();
    stage.disconnect();
    await server.close();
  });

  await t.test('both devices join the same room', async () => {
    for (const [socket, id] of [[phone, 'phone'], [stage, 'stage']] as const) {
      const joined = await socket.emitWithAck('join-room', { roomCode: ROOM, participantId: id, participantToken: `token-${id}` });
      assert.equal(joined.ok, true);
      assert.equal(joined.state?.roomCode, ROOM);
      assert.equal(joined.moderatorAuthorized, false);
    }
  });

  await t.test('a raised hand on one device reaches the other', async () => {
    const seenByStage = nextState(stage, (state) => state.queue.length === 1);
    assert.deepEqual(await send(phone, 'phone', { type: 'raise-hand', payload: { name: 'Sara' } }), { ok: true });
    const state = await seenByStage;
    assert.equal(state.queue[0].participant.name, 'Sara');
  });

  await t.test('moderator commands need a token from the PIN', async () => {
    const refused = await send(phone, 'phone', { type: 'reset-session', payload: undefined });
    assert.equal(refused.code, 'moderator-auth-required');

    const wrong = await stage.emitWithAck('authenticate-moderator', { roomCode: ROOM, pin: '0000' });
    assert.equal(wrong.ok, false);
    const login = await stage.emitWithAck('authenticate-moderator', { roomCode: ROOM, pin: TEST_PIN });
    assert.ok(login.ok && login.moderatorToken);

    const seenByPhone = nextState(phone, (state) => state.queue.length === 0);
    const reset = await send(stage, 'stage', { type: 'reset-session', payload: undefined, moderatorToken: login.moderatorToken });
    assert.deepEqual(reset, { ok: true });
    await seenByPhone;
  });

  await t.test('bad input gets an error reply and the server keeps working', async () => {
    const garbage = await phone.emitWithAck('meeting-command', 'not a command' as unknown as MeetingCommand);
    assert.equal(garbage.ok, false);
    const invalidRoom = await phone.emitWithAck('join-room', { roomCode: 'no', participantId: 'phone', participantToken: 'token-phone' });
    assert.equal(invalidRoom.code, 'invalid-room');
    assert.deepEqual(await send(phone, 'phone', { type: 'raise-hand', payload: { name: 'Sara' } }), { ok: true });
  });

  await t.test('closing saves the meeting to disk', async () => {
    await server.close();
    assert.equal(existsSync(path.join(dataDirectory, 'meetings.json')), true);
  });
});
