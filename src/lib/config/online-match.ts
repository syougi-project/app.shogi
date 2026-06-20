import { resolveDevLanUrlFromEnv } from '@/lib/config/resolve-dev-lan-url';

export function getMatchingServerWsBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_MATCHING_SERVER_WS_URL ?? '';
  return resolveDevLanUrlFromEnv(raw, 'ws', '3010');
}
