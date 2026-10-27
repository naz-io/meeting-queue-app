import type { SpeakerHistoryItem } from '../../shared/meeting.ts';

// Spreadsheet apps run cells starting with these characters as formulas.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: string | number) {
  if (typeof value === 'number') return String(value);
  const text = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

export function historyToCsv(
  history: SpeakerHistoryItem[],
  formatTime: (timestamp: number) => string = (timestamp) => new Date(timestamp).toLocaleTimeString(),
) {
  const headers = ['Participant Name', 'Spoken At', 'Actual Seconds', 'Allocated Seconds', 'Status'];
  const rows = history.map((item) => [
    item.participantName,
    formatTime(item.spokenAt),
    item.actualDurationSeconds,
    item.allocatedSeconds,
    item.endedReason,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
