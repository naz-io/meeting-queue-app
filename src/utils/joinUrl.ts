export function getJoinUrl(roomCode: string) {
  const configuredUrl = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '');
  const baseUrl = configuredUrl || `${window.location.origin}${window.location.pathname}`;
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('room', roomCode);
  url.searchParams.delete('view');
  return url.toString();
}
