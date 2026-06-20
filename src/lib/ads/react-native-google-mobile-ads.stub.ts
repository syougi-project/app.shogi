/** Expo Go 向けスタブ（本番/EAS ビルドでは EXPO_PUBLIC_ENABLE_ADMOB=true で実モジュールを使用） */

export const TestIds = {
  INTERSTITIAL: 'test-interstitial',
};

export const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  CLOSED: 'closed',
  OPENED: 'opened',
} as const;

class StubInterstitialAd {
  loaded = false;

  load() {
    this.loaded = false;
  }

  show() {
    return Promise.resolve();
  }

  addAdEventListener(_event: string, _listener: () => void) {
    return () => {};
  }
}

export class InterstitialAd {
  static createForAdRequest(_unitId: string, _options?: unknown) {
    return new StubInterstitialAd();
  }
}

export default function mobileAds() {
  return {
    initialize: () => Promise.resolve([]),
  };
}
