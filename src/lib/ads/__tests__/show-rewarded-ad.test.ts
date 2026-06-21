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

type AdListener = () => void;

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
    emit(event: string) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
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
    jest
      .mocked(RewardedAd.createForAdRequest)
      .mockReturnValue(mock.ad as unknown as ReturnType<typeof RewardedAd.createForAdRequest>);

    const result = showRewardedAd();
    await flushPromises();

    mock.emit(RewardedAdEventType.EARNED_REWARD);
    mock.emit(AdEventType.CLOSED);

    await expect(result).resolves.toEqual({ ok: true });
    expect(initializeAdMob).toHaveBeenCalled();
    expect(mock.ad.show).toHaveBeenCalled();
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
  });
});
