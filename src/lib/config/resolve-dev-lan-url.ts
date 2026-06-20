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

/**
 * 開発時は Expo の LAN ホストに合わせて URL の hostname を差し替える。
 * Metro（8081/8083 等）に届く IP と BFF/WS の IP を揃えるため。
 */
export function resolveDevLanUrlFromEnv(
  envUrl: string,
  defaultProtocol: 'http' | 'ws',
  defaultPort: string,
): string {
  const trimmed = envUrl.trim().replace(/\s+/g, '');
  const fallbackPath = defaultProtocol === 'ws' ? '/ws' : '';

  if (!trimmed) {
    if (__DEV__) {
      const host = resolveExpoLanHost();
      if (host) return `${defaultProtocol}://${host}:${defaultPort}${fallbackPath}`;
    }
    return `${defaultProtocol}://localhost:${defaultPort}${fallbackPath}`;
  }

  const normalized = trimmed.replace(/\/+$/, '');
  if (!__DEV__) return normalized;

  const host = resolveExpoLanHost();
  if (!host) return normalized;

  try {
    const withProtocol = normalized.includes('://')
      ? normalized
      : `${defaultProtocol}://${normalized}`;
    const url = new URL(withProtocol);
    url.hostname = host;
    if (!url.port) url.port = defaultPort;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
}
