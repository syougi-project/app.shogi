import { Alert } from 'react-native';
import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';

import { initializeAdMob } from '@/lib/ads/admob';
import { isAdMobEnabled } from '@/lib/ads/is-admob-enabled';
import { showRewardedAd } from '@/lib/ads/show-rewarded-ad';

jest.mock('@/lib/ads/admob', () => ({
  initializeAdMob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/ads/is-admob-enabled', () => ({
  isAdMobEnabled: jest.fn(),
}));

type AdListener = (payload?: unknown) => void;

function createMockRewardedAd(loaded = true) {
  const listeners = new Map<string, AdListener[]>();
  const unsubscribe = jest.fn();
  const ad = {
    loaded,
    load: jest.fn(() => {
      ad.loaded = false;
    }),
    show: jest.fn().mockResolvedValue(undefined),
    addAdEventListener: jest.fn((event: string, listener: AdListener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return unsubscribe;
    }),
  };

  return {
    ad,
    emit(event: string, payload?: unknown) {
      if (event === RewardedAdEventType.LOADED) ad.loaded = true;
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('showRewardedAd', () => {
  beforeEach(() => {
    jest.mocked(isAdMobEnabled).mockReturnValue(true);
    jest.mocked(initializeAdMob).mockResolvedValue(undefined);
  });

  it('報酬獲得イベント後に広告が閉じられたら成功を返す', async () => {
    const mock = createMockRewardedAd();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest
      .mocked(RewardedAd.createForAdRequest)
      .mockReturnValue(mock.ad as unknown as ReturnType<typeof RewardedAd.createForAdRequest>);

    try {
      const result = showRewardedAd();
      await flushPromises();
      const reward = { amount: 1, type: 'daily-gacha' };

      mock.emit(RewardedAdEventType.EARNED_REWARD, reward);
      mock.emit(AdEventType.CLOSED);

      await expect(result).resolves.toEqual({ ok: true });
      expect(initializeAdMob).toHaveBeenCalled();
      expect(RewardedAd.createForAdRequest).toHaveBeenCalledWith(
        'ca-app-pub-3940256099942544/1712485313',
        {
          requestNonPersonalizedAdsOnly: true,
        },
      );
      expect(mock.ad.show).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('[Rewarded] loaded');
      expect(logSpy).toHaveBeenCalledWith('[Rewarded] earned reward', reward);
      expect(logSpy).toHaveBeenCalledWith('[Rewarded] closed');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('ロード失敗を詳細ログに残し、次回操作で新しい広告を再ロードする', async () => {
    const first = createMockRewardedAd(false);
    const second = createMockRewardedAd(false);
    jest
      .mocked(RewardedAd.createForAdRequest)
      .mockReturnValueOnce(first.ad as unknown as ReturnType<typeof RewardedAd.createForAdRequest>)
      .mockReturnValueOnce(
        second.ad as unknown as ReturnType<typeof RewardedAd.createForAdRequest>,
      );
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const firstResult = showRewardedAd();
      await flushPromises();
      const error = Object.assign(new Error('No fill'), { code: 'google-mobile-ads/no-fill' });
      first.emit(AdEventType.ERROR, error);

      await expect(firstResult).resolves.toEqual({ ok: false });
      expect(errorSpy).toHaveBeenCalledWith('[Rewarded] error', {
        code: 'google-mobile-ads/no-fill',
        message: 'No fill',
        raw: error,
      });

      const secondResult = showRewardedAd();
      await flushPromises();
      expect(second.ad.load).toHaveBeenCalled();
      second.emit(RewardedAdEventType.LOADED, { amount: 1, type: 'reward' });
      await flushPromises();
      second.emit(RewardedAdEventType.EARNED_REWARD, { amount: 1, type: 'reward' });
      second.emit(AdEventType.CLOSED);

      await expect(secondResult).resolves.toEqual({ ok: true });
      expect(logSpy).toHaveBeenCalledWith('[Rewarded] loading', {
        adUnitId: expect.any(String),
      });
      expect(logSpy).toHaveBeenCalledWith('[Rewarded] loaded');
      expect(RewardedAd.createForAdRequest).toHaveBeenCalledTimes(2);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('報酬獲得前に広告が閉じられたらキャンセル扱いにする', async () => {
    const mock = createMockRewardedAd();
    jest
      .mocked(RewardedAd.createForAdRequest)
      .mockReturnValue(mock.ad as unknown as ReturnType<typeof RewardedAd.createForAdRequest>);

    const result = showRewardedAd();
    await flushPromises();

    mock.emit(AdEventType.CLOSED);

    await expect(result).resolves.toEqual({ ok: false, cancelled: true });
    expect(mock.ad.show).toHaveBeenCalled();
  });

  it('SDK初期化が例外を投げても詳細ログを残して失敗結果を返す', async () => {
    const error = Object.assign(new Error('SDK initialization failed'), {
      code: 'google-mobile-ads/initialize-failed',
    });
    jest.mocked(initializeAdMob).mockRejectedValueOnce(error);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(showRewardedAd()).resolves.toEqual({ ok: false });
      expect(errorSpy).toHaveBeenCalledWith('[Rewarded] error', {
        code: 'google-mobile-ads/initialize-failed',
        message: 'SDK initialization failed',
        raw: error,
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('AdMob無効時は開発用Alertで視聴完了を返す', async () => {
    jest.mocked(isAdMobEnabled).mockReturnValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === '視聴完了')?.onPress?.();
    });

    await expect(showRewardedAd()).resolves.toEqual({ ok: true });

    expect(alertSpy).toHaveBeenCalledWith(
      '広告視聴',
      '動画広告を最後まで視聴すると、本日の対象ガチャを1回無料で引けます。',
      expect.any(Array),
      expect.objectContaining({ cancelable: true }),
    );
    expect(initializeAdMob).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
