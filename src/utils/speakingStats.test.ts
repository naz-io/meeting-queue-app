import assert from 'node:assert/strict';
import { test } from 'node:test';
import { totalSpokenSeconds, turnCount } from './speakingStats.ts';
import type { SpeakerHistoryItem } from '../../shared/meeting.ts';

const turn = (participantName: string, seconds: number, participantId?: string): SpeakerHistoryItem => ({
  id: `h_${participantName}_${seconds}`,
  participantId,
  participantName,
  avatar: '👤',
  spokenAt: 0,
  actualDurationSeconds: seconds,
  allocatedSeconds: 120,
  endedReason: 'completed',
});

test('two people with the same name keep separate totals', () => {
  const history = [turn('Ali', 60, 'p1'), turn('Ali', 30, 'p2'), turn('ali', 10, 'p1')];
  assert.equal(totalSpokenSeconds(history, 'p1', 'Ali'), 70);
  assert.equal(turnCount(history, 'p1', 'Ali'), 2);
  assert.equal(totalSpokenSeconds(history, 'p2', 'Ali'), 30);
});

test('old entries without an ID still count by name', () => {
  const history = [turn('Sara', 45), turn('sara', 15), turn('Sara', 20, 'someone-else')];
  assert.equal(totalSpokenSeconds(history, 'p9', 'SARA'), 60);
  assert.equal(turnCount(history, 'p9', 'Sara'), 2);
  assert.equal(totalSpokenSeconds(history, 'p9'), 0, 'no name, no legacy match');
});
