// Shared by the browser and the meeting server so both accept exactly the same codes.
export const DEFAULT_ROOM_CODE = 'MEET-7892';

const ROOM_CODE_PATTERN = /^[A-Z0-9-]{4,24}$/;

/** The upper-cased room code, or null when the value is not a valid code. */
export function parseRoomCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(normalized) ? normalized : null;
}
