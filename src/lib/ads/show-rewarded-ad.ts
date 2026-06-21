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
const REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};

let rewardedAd: ReturnType<typeof RewardedAd.createForAdRequest> | null = null;
let rewardedUnitId: string | null = null;
let isShowingRewarded = false;

function resolveRewardedUnitId(): string {
  if (__DEV__) return TestIds.REWARDED;
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

function loadRewardedAd(): Promise<boolean> {
  const ad = getRewardedAd();
  if (ad.loaded) return Promise.resolve(true);

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
    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => finish(true));
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
    const timeout = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    ad.load();
  });
}

async function showAdMobRewardedAd(): Promise<RewardedAdResult> {
  if (isShowingRewarded) return { ok: false, cancelled: true };
  await initializeAdMob();

  const ad = getRewardedAd();
  const loaded = ad.loaded || (await loadRewardedAd());
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
      rewardedAd = null;
      resolve(result);
    };

    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedReward = true;
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      finish(earnedReward ? { ok: true } : { ok: false, cancelled: true });
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      finish({ ok: false });
    });

    ad.show().catch((error: unknown) => {
      console.warn('[AdMob] rewarded show failed', error);
      finish({ ok: false });
    });
  });
}

/**
 * リワード広告視聴。Expo Go / web では開発向けダイアログで代用する。
 */
export function showRewardedAd(): Promise<RewardedAdResult> {
  if (Platform.OS !== 'web' && isAdMobEnabled()) {
    return showAdMobRewardedAd();
  }

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
