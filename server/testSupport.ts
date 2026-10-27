import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { MeetingStore } from './meetingStore.ts';
import type { MeetingCommandType } from '../shared/protocol.ts';

// Shared helpers for the store tests. Not named *.test.ts, so the runner does not execute it.

export const TEST_PIN = '7892';
const TICK_MS = 250;

export function tempDataDirectory(t: TestContext) {
  const directory = mkdtempSync(path.join(tmpdir(), 'meeting-store-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

export function openRoom(store: MeetingStore, roomCode: string) {
  const opened = store.openRoom(roomCode);
  assert.ok(opened.ok, `could not open ${roomCode}`);
  return opened.room;
}

export function setup(t: TestContext) {
  // Fake timers keep debounced saves from firing; the temp directory keeps real data safe if one does.
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const dataDirectory = tempDataDirectory(t);
  const broadcasts: unknown[] = [];
  const store = new MeetingStore((_code, state) => broadcasts.push(structuredClone(state)), { moderatorPin: TEST_PIN, dataDirectory });
  const room = openRoom(store, 'TEST-ROOM');
  const moderatorToken = store.authenticateModerator('TEST-ROOM', TEST_PIN)!;
  let sequence = 0;
  const command = (type: MeetingCommandType, payload: unknown = {}, participantId = 'moderator', authorized = true) =>
    store.handleCommand({
      id: String(++sequence), roomCode: 'TEST-ROOM', participantId,
      participantToken: `token-${participantId}`,
      moderatorToken: authorized ? moderatorToken : undefined,
      type, payload,
    });
  const raise = (id: string) => command('raise-hand', { name: id }, id);
  const change = (seconds: number, scope?: string) => command('update-settings', {
    settings: { defaultTimerSeconds: seconds }, speakingTimeScope: scope,
  });

  /** Starts the store's real 250 ms timer loop on the fake clock. */
  const start = () => store.initialize();

  /**
   * Moves the fake clock forward one loop tick at a time. A single big tick() would fire every
   * pending interval with Date already at the end time, which real time never does.
   */
  const advance = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) t.mock.timers.tick(Math.min(TICK_MS, ms - elapsed));
  };

  return { store, room, command, raise, change, start, advance, broadcasts, dataDirectory, moderatorToken };
}
