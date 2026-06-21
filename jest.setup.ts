jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
    loop: false,
    volume: 1,
  })),
  setAudioModeAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

jest.mock('react-native-google-mobile-ads', () => {
  const ad = {
    loaded: true,
    load: jest.fn(),
    show: jest.fn().mockResolvedValue(undefined),
    addAdEventListener: jest.fn(() => jest.fn()),
  };
  return {
    __esModule: true,
    default: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue({}),
    })),
    AdEventType: {
      LOADED: 'loaded',
      ERROR: 'error',
      CLOSED: 'closed',
      OPENED: 'opened',
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => ad),
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => ad),
    },
    RewardedAdEventType: {
      EARNED_REWARD: 'earned_reward',
    },
    TestIds: {
      INTERSTITIAL: 'test-interstitial',
      REWARDED: 'test-rewarded',
    },
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      const effectRef = React.useRef(effect);
      effectRef.current = effect;
      React.useEffect(() => {
        const cleanup = effectRef.current();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('expo-audio', () => ({
  AudioPlayer: jest.fn(),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    volume: 1,
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase/supabase-client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
      signInAnonymously: jest.fn(),
    },
  },
}));
