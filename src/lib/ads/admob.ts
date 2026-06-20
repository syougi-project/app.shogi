import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform, StatusBar } from 'react-native';
import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

type InterstitialPlacement = 'normal-dungeon' | 'online-battle';

const SHOW_EVERY_BATTLE_COUNT = 3;
const LOAD_TIMEOUT_MS = 8000;
const IOS_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-4722276667311883/8991247351';
const REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: true,
};

let initializePromise: Promise<unknown> | null = null;
let interstitial: InterstitialAd | null = null;
let interstitialUnitId: string | null = null;
let isLoadingInterstitial = false;
let isShowingInterstitial = false;

function resolveInterstitialUnitId(): string {
  if (__DEV__) return TestIds.INTERSTITIAL;
  if (Platform.OS === 'ios') {
    const configuredUnitId = Constants.expoConfig?.extra?.admobIosInterstitialUnitId;
    return typeof configuredUnitId === 'string' && configuredUnitId.trim().length > 0
      ? configuredUnitId.trim()
      : IOS_INTERSTITIAL_AD_UNIT_ID;
  }
  return TestIds.INTERSTITIAL;
}

function getInterstitial(): InterstitialAd {
  const nextUnitId = resolveInterstitialUnitId();
  if (!interstitial || interstitialUnitId !== nextUnitId) {
    interstitial = InterstitialAd.createForAdRequest(nextUnitId, REQUEST_OPTIONS);
    interstitialUnitId = nextUnitId;
  }
  return interstitial;
}

function loadInterstitial(): Promise<boolean> {
  const ad = getInterstitial();
  if (ad.loaded) return Promise.resolve(true);
  if (isLoadingInterstitial) return Promise.resolve(false);

  isLoadingInterstitial = true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      isLoadingInterstitial = false;
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

export async function initializeAdMob(): Promise<void> {
  if (Platform.OS === 'web') return;
  initializePromise ??= mobileAds()
    .initialize()
    .then(() => loadInterstitial())
    .catch((error: unknown) => {
      console.warn('[AdMob] initialize failed', error);
    });
  await initializePromise;
}

async function showInterstitialIfReady(): Promise<void> {
  if (Platform.OS === 'web' || isShowingInterstitial) return;
  await initializeAdMob();

  const ad = getInterstitial();
  const loaded = ad.loaded || (await loadInterstitial());
  if (!loaded || !ad.loaded) return;

  isShowingInterstitial = true;
  const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(false);
    }
    isShowingInterstitial = false;
    interstitial = null;
    void loadInterstitial();
  });
  const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
    isShowingInterstitial = false;
    unsubscribeClosed();
    unsubscribeError();
  });

  try {
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(true);
    }
    await ad.show();
  } catch (error) {
    if (Platform.OS === 'ios') {
      StatusBar.setHidden(false);
    }
    isShowingInterstitial = false;
    unsubscribeClosed();
    unsubscribeError();
    console.warn('[AdMob] show failed', error);
  }
}

export async function showBattleEndInterstitialEveryThirdTime(
  placement: InterstitialPlacement,
): Promise<void> {
  const key = `admob:${placement}:finished-battle-count`;
  const raw = await SecureStore.getItemAsync(key);
  const current = Number.parseInt(raw ?? '0', 10);
  const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
  await SecureStore.setItemAsync(key, String(next));

  if (next % SHOW_EVERY_BATTLE_COUNT !== 0) {
    void loadInterstitial();
    return;
  }
  await showInterstitialIfReady();
}
