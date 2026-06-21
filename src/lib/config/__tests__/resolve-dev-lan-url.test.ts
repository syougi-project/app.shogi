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

  it('keeps env hostname as-is', () => {
    const resolved = resolveDevLanUrlFromEnv('http://10.230.66.129:3000', 'http', '3000');
    expect(resolved).toBe('http://10.230.66.129:3000');
  });

  it('keeps production https api url as-is', () => {
    const resolved = resolveDevLanUrlFromEnv(
      'https://example.execute-api.ap-northeast-1.amazonaws.com',
      'http',
      '3000',
    );
    expect(resolved).toBe('https://example.execute-api.ap-northeast-1.amazonaws.com');
  });

  it('keeps env ws hostname as-is', () => {
    const resolved = resolveDevLanUrlFromEnv('ws://10.230.66.129:3010/ws', 'ws', '3010');
    expect(resolved).toBe('ws://10.230.66.129:3010/ws');
  });

  it('keeps production wss url as-is', () => {
    const resolved = resolveDevLanUrlFromEnv(
      'wss://example.execute-api.ap-northeast-1.amazonaws.com/prod',
      'ws',
      '3010',
    );
    expect(resolved).toBe('wss://example.execute-api.ap-northeast-1.amazonaws.com/prod');
  });

  it('adds default protocol when env value omits it', () => {
    const resolved = resolveDevLanUrlFromEnv('192.168.0.104:3000', 'http', '3000');
    expect(resolved).toBe('http://192.168.0.104:3000');
  });

  it('uses localhost fallback only when env is empty', () => {
    const resolved = resolveDevLanUrlFromEnv('', 'ws', '3010');
    expect(resolved).toBe('ws://localhost:3010/ws');
  });
});
