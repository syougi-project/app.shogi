import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

import { initializeAdMob } from '@/lib/ads/admob';
import { isAdMobEnabled } from '@/lib/ads/is-admob-enabled';

export type RewardedAdResult = {
  ok: boolean;
  cancelled?: boolean;
};

const LOAD_TIMEOUT_MS = 10000;
const IOS_REWARDED_AD_UNIT_ID = 'ca-app-pub-4722276667311883/9275875313';
const IOS_REWARDED_TEST_AD_UNIT_ID = 'ca-app-pub-3940256099942544/1712485313';
const REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};

let rewardedAd: ReturnType<typeof RewardedAd.createForAdRequest> | null = null;
let rewardedUnitId: string | null = null;
let isShowingRewarded = false;

function resolveRewardedUnitId(): string {
  if (__DEV__) {
    return Platform.OS === 'ios' ? IOS_REWARDED_TEST_AD_UNIT_ID : TestIds.REWARDED;
  }
  if (Platform.OS === 'ios') {
    const configuredUnitId = Constants.expoConfig?.extra?.admobIosRewardedUnitId;
    return typeof configuredUnitId === 'string' && configuredUnitId.trim().length > 0
      ? configuredUnitId.trim()
      : IOS_REWARDED_AD_UNIT_ID;
  }
  return TestIds.REWARDED;
}

function getRewardedAd() {
  const nextUnitId = resolveRewardedUnitId();
  if (!rewardedAd || rewardedUnitId !== nextUnitId) {
    rewardedAd = RewardedAd.createForAdRequest(nextUnitId, REQUEST_OPTIONS);
    rewardedUnitId = nextUnitId;
  }
  return rewardedAd;
}

function resetRewardedAd(ad: ReturnType<typeof RewardedAd.createForAdRequest>): void {
  if (rewardedAd === ad) {
    rewardedAd = null;
    rewardedUnitId = null;
  }
}

function logRewardedError(error: unknown): void {
  const details = error as { code?: unknown; message?: unknown } | null | undefined;
  console.error('[Rewarded] error', {
    code: details?.code,
    message: details?.message,
    raw: error,
  });
}

function loadRewardedAd(): Promise<boolean> {
  const ad = getRewardedAd();
  const adUnitId = rewardedUnitId ?? resolveRewardedUnitId();
  if (ad.loaded) {
    console.log('[Rewarded] loaded');
    return Promise.resolve(true);
  }

  console.log('[Rewarded] loading', { adUnitId });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      unsubscribeLoaded();
      unsubscribeError();
      clearTimeout(timeout);
      resolve(loaded);
    };
    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[Rewarded] loaded');
      finish(true);
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      logRewardedError(error);
      resetRewardedAd(ad);
      finish(false);
    });
    const timeout = setTimeout(() => {
      logRewardedError({
        code: 'load-timeout',
        message: `Rewarded ad did not load within ${LOAD_TIMEOUT_MS}ms`,
      });
      resetRewardedAd(ad);
      finish(false);
    }, LOAD_TIMEOUT_MS);

    ad.load();
  });
}

async function showAdMobRewardedAd(): Promise<RewardedAdResult> {
  if (isShowingRewarded) return { ok: false, cancelled: true };
  await initializeAdMob();

  const ad = getRewardedAd();
  let loaded = ad.loaded;
  if (loaded) {
    console.log('[Rewarded] loaded');
  } else {
    loaded = await loadRewardedAd();
  }
  if (!loaded || !ad.loaded) return { ok: false };

  isShowingRewarded = true;
  return new Promise((resolve) => {
    let settled = false;
    let earnedReward = false;
    const finish = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      isShowingRewarded = false;
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resetRewardedAd(ad);
      resolve(result);
    };

    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      console.log('[Rewarded] earned reward', reward);
      earnedReward = true;
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[Rewarded] closed');
      finish(earnedReward ? { ok: true } : { ok: false, cancelled: true });
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      logRewardedError(error);
      finish({ ok: false });
    });

    ad.show().catch((error: unknown) => {
      logRewardedError(error);
      finish({ ok: false });
    });
  });
}

/**
 * リワード広告視聴。Expo Go / web では開発向けダイアログで代用する。
 */
export function showRewardedAd(): Promise<RewardedAdResult> {
  const enabled = isAdMobEnabled();
  console.log('[Rewarded] requested', { enabled, platform: Platform.OS, isDev: __DEV__ });
  if (Platform.OS !== 'web' && enabled) {
    return showAdMobRewardedAd().catch((error: unknown) => {
      // SDK初期化・広告生成など、イベント通知より前の例外も呼び出し側で扱える失敗結果にする。
      logRewardedError(error);
      rewardedAd = null;
      rewardedUnitId = null;
      isShowingRewarded = false;
      return { ok: false };
    });
  }

  console.warn('[Rewarded] native AdMob disabled; using development alert');
  return new Promise((resolve) => {
    Alert.alert(
      '広告視聴',
      '動画広告を最後まで視聴すると、本日の対象ガチャを1回無料で引けます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
          onPress: () => resolve({ ok: false, cancelled: true }),
        },
        {
          text: '視聴完了',
          onPress: () => resolve({ ok: true }),
        },
      ],
      { cancelable: true, onDismiss: () => resolve({ ok: false, cancelled: true }) },
    );
  });
}
