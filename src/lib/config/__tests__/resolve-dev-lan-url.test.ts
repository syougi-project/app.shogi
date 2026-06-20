import { resolveDevLanUrlFromEnv, resolveExpoLanHost } from '@/lib/config/resolve-dev-lan-url';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoGoConfig: { debuggerHost: '10.232.96.54:8083' },
    expoConfig: null,
  },
}));

describe('resolve-dev-lan-url', () => {
  it('reads LAN host from Expo debuggerHost', () => {
    expect(resolveExpoLanHost()).toBe('10.232.96.54');
  });

  it('replaces stale env hostname with Expo LAN host in dev', () => {
    const resolved = resolveDevLanUrlFromEnv('http://10.230.66.129:3000', 'http', '3000');
    expect(resolved).toBe('http://10.232.96.54:3000');
  });

  it('replaces stale ws env hostname with Expo LAN host in dev', () => {
    const resolved = resolveDevLanUrlFromEnv('ws://10.230.66.129:3010/ws', 'ws', '3010');
    expect(resolved).toBe('ws://10.232.96.54:3010/ws');
  });
});
