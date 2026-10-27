import type {
  CommandPayloads,
  MeetingCommand,
  MeetingCommandType,
  QueueDirection,
  SettingsPatch,
  SpeakerEndReason,
  SpeakingTimeScope,
} from '../shared/protocol.ts';

// Hand-written runtime checks for data arriving over the socket. TypeScript types vanish at
// runtime, so everything here starts from `unknown` and either returns typed data or an error.

type Fields = Record<string, unknown>;

export type ParseCommandResult =
  | { ok: true; command: MeetingCommand }
  | { ok: false; error: string };

class InvalidCommand extends Error {}

function fields(value: unknown, what: string): Fields {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new InvalidCommand(`${what} must be an object.`);
  return value as Fields;
}

/** Missing and null both mean "not sent": JSON drops undefined but can carry null. */
function present(source: Fields, key: string) {
  const value = source[key];
  return value === undefined || value === null ? undefined : value;
}

/** Free text: trimmed and cut to length, because it is only ever displayed. */
function optionalText(source: Fields, key: string, maxLength: number) {
  const value = present(source, key);
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new InvalidCommand(`${key} must be text.`);
  return value.trim().slice(0, maxLength);
}

/** IDs and tokens: rejected when too long, never cut, so a long token cannot shrink into a valid one. */
function optionalIdentifier(source: Fields, key: string, maxLength: number) {
  const value = present(source, key);
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) throw new InvalidCommand(`${key} is not valid.`);
  return value;
}

function requiredIdentifier(source: Fields, key: string, maxLength: number) {
  const value = optionalIdentifier(source, key, maxLength);
  if (!value) throw new InvalidCommand(`${key} is required.`);
  return value;
}

function optionalNumber(source: Fields, key: string) {
  const value = present(source, key);
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new InvalidCommand(`${key} must be a number.`);
  return value;
}

function requiredNumber(source: Fields, key: string) {
  const value = optionalNumber(source, key);
  if (value === undefined) throw new InvalidCommand(`${key} is required.`);
  return value;
}

function requiredInteger(source: Fields, key: string) {
  const value = requiredNumber(source, key);
  if (!Number.isInteger(value)) throw new InvalidCommand(`${key} must be a whole number.`);
  return value;
}

function optionalBoolean(source: Fields, key: string) {
  const value = present(source, key);
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new InvalidCommand(`${key} must be true or false.`);
  return value;
}

function optionalChoice<T extends string>(source: Fields, key: string, choices: readonly T[]) {
  const value = present(source, key);
  if (value === undefined) return undefined;
  if (!choices.includes(value as T)) throw new InvalidCommand(`${key} must be one of: ${choices.join(', ')}.`);
  return value as T;
}

function requiredChoice<T extends string>(source: Fields, key: string, choices: readonly T[]) {
  const value = optionalChoice(source, key, choices);
  if (value === undefined) throw new InvalidCommand(`${key} is required.`);
  return value;
}

const DIRECTIONS: readonly QueueDirection[] = ['up', 'down', 'top', 'bottom'];
const END_REASONS: readonly SpeakerEndReason[] = ['completed', 'dismissed', 'skipped', 'manual'];
const SCOPES: readonly SpeakingTimeScope[] = ['existing-queue', 'from-now-on'];

function parseSettingsPatch(source: Fields): SettingsPatch {
  const patch: SettingsPatch = {
    defaultTimerSeconds: optionalNumber(source, 'defaultTimerSeconds'),
    bufferSeconds: optionalNumber(source, 'bufferSeconds'),
    warningChimeSeconds: optionalNumber(source, 'warningChimeSeconds'),
    autoAdvance: optionalBoolean(source, 'autoAdvance'),
    soundEnabled: optionalBoolean(source, 'soundEnabled'),
    roomName: optionalText(source, 'roomName', 80),
  };
  // Drop fields that were not sent so "absent" and "unchanged" stay the same thing.
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as SettingsPatch;
}

const none = () => undefined;

/** One parser per command; the mapped type makes a missing entry a compile error. */
const PAYLOAD_PARSERS: { [T in MeetingCommandType]: (payload: Fields) => CommandPayloads[T] } = {
  'raise-hand': (p) => ({
    name: optionalText(p, 'name', 60),
    avatar: optionalText(p, 'avatar', 12),
    note: optionalText(p, 'note', 160),
  }),
  'lower-hand': none,
  'leave-meeting': none,
  'move-queue-item': (p) => ({
    queueItemId: requiredIdentifier(p, 'queueItemId', 120),
    direction: requiredChoice(p, 'direction', DIRECTIONS),
  }),
  'reorder-queue': (p) => ({
    startIndex: requiredInteger(p, 'startIndex'),
    endIndex: requiredInteger(p, 'endIndex'),
  }),
  'dismiss-queue-item': (p) => ({ queueItemId: requiredIdentifier(p, 'queueItemId', 120) }),
  'start-speaker': (p) => ({
    queueItemId: optionalIdentifier(p, 'queueItemId', 120),
    secondsOverride: optionalNumber(p, 'secondsOverride'),
    skipBuffer: optionalBoolean(p, 'skipBuffer'),
  }),
  'skip-buffer': none,
  'cancel-buffer': none,
  'pause-timer': none,
  'resume-timer': none,
  'add-time': (p) => ({ seconds: requiredNumber(p, 'seconds') }),
  'set-speaker-timer': (p) => ({ seconds: requiredNumber(p, 'seconds') }),
  'finish-speaker': (p) => ({
    reason: optionalChoice(p, 'reason', END_REASONS),
    autoAdvanceNext: optionalBoolean(p, 'autoAdvanceNext'),
  }),
  'update-settings': (p) => ({
    settings: parseSettingsPatch(fields(p.settings, 'settings')),
    speakingTimeScope: optionalChoice(p, 'speakingTimeScope', SCOPES),
  }),
  'reset-session': none,
  'load-demo-data': none,
};

const COMMAND_TYPES = Object.keys(PAYLOAD_PARSERS) as MeetingCommandType[];

export function parseCommand(raw: unknown): ParseCommandResult {
  try {
    const source = fields(raw, 'Command');
    const type = requiredChoice(source, 'type', COMMAND_TYPES);
    // TypeScript cannot link `type` to its own payload parser here, so the pairing is asserted once.
    const command = {
      id: requiredIdentifier(source, 'id', 100),
      roomCode: requiredIdentifier(source, 'roomCode', 40),
      participantId: requiredIdentifier(source, 'participantId', 120),
      participantToken: requiredIdentifier(source, 'participantToken', 200),
      moderatorToken: optionalIdentifier(source, 'moderatorToken', 200),
      type,
      payload: PAYLOAD_PARSERS[type](fields(source.payload, 'payload')),
    } as MeetingCommand;
    return { ok: true, command };
  } catch (error) {
    if (error instanceof InvalidCommand) return { ok: false, error: `Invalid request: ${error.message}` };
    throw error;
  }
}
