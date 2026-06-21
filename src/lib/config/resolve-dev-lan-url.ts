import Constants from 'expo-constants';

/** Expo Go / dev client が Metro 接続に使っている LAN IP（`debuggerHost`）を返す。 */
export function resolveExpoLanHost(): string | null {
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ?? Constants.expoConfig?.hostUri?.split(':')[0] ?? null;
  if (!debuggerHost) return null;

  const host = debuggerHost.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/** env URL を正規化する。空の場合だけ localhost の既定URLを返す。 */
export function resolveDevLanUrlFromEnv(
  envUrl: string,
  defaultProtocol: 'http' | 'ws',
  defaultPort: string,
): string {
  const trimmed = envUrl.trim().replace(/\s+/g, '');
  const fallbackPath = defaultProtocol === 'ws' ? '/ws' : '';

  if (!trimmed) {
    return `${defaultProtocol}://localhost:${defaultPort}${fallbackPath}`;
  }

  const normalized = trimmed.replace(/\/+$/, '');
  if (normalized.includes('://')) return normalized;
  return `${defaultProtocol}://${normalized}`;
}
