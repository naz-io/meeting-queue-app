import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, historyToCsv } from './csv.ts';
import type { SpeakerHistoryItem } from '../types/index.ts';

const entry = (participantName: string): SpeakerHistoryItem => ({
  id: 'h_1',
  participantName,
  avatar: '👤',
  spokenAt: 0,
  actualDurationSeconds: 75,
  allocatedSeconds: 120,
  endedReason: 'completed',
});

test('quotes are doubled so names cannot break the row', () => {
  assert.equal(csvCell('Ali "The Voice" Reza'), '"Ali ""The Voice"" Reza"');
});

test('formula-like names are neutralised', () => {
  for (const name of ['=HYPERLINK("x")', '+1', '-1', '@SUM(A1)']) {
    assert.equal(csvCell(name), `"'${name.replaceAll('"', '""')}"`);
  }
});

test('commas, hashes and newlines stay inside one cell', () => {
  assert.equal(csvCell('Room #2, east\nwing'), '"Room #2, east\nwing"');
});

test('history export has a header and one row per entry', () => {
  const csv = historyToCsv([entry('Sara'), entry('=cmd')], () => '10:00');
  assert.deepEqual(csv.split('\r\n'), [
    '"Participant Name","Spoken At","Actual Seconds","Allocated Seconds","Status"',
    '"Sara","10:00",75,120,"completed"',
    '"\'=cmd","10:00",75,120,"completed"',
  ]);
});
