import type { SpeakerHistoryItem } from '../../shared/meeting.ts';

/**
 * Whether a history entry belongs to this participant. Entries carry the participant ID, so two
 * people with the same name stay separate; the name is only used for old entries saved without one.
 */
function belongsTo(item: SpeakerHistoryItem, participantId?: string, name?: string) {
  if (item.participantId) return item.participantId === participantId;
  return Boolean(name) && item.participantName.toLowerCase() === name!.toLowerCase();
}

export function totalSpokenSeconds(history: SpeakerHistoryItem[], participantId?: string, name?: string) {
  return history.reduce((total, item) => (belongsTo(item, participantId, name) ? total + item.actualDurationSeconds : total), 0);
}

export function turnCount(history: SpeakerHistoryItem[], participantId?: string, name?: string) {
  return history.filter((item) => belongsTo(item, participantId, name)).length;
}
