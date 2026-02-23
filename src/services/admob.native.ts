import { Platform } from 'react-native';
import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

import {
  ADMOB_BANNER_UNIT_ID_ANDROID,
  ADMOB_BANNER_UNIT_ID_IOS,
  ADMOB_ENABLED,
  ADMOB_INTERSTITIAL_UNIT_ID_ANDROID,
  ADMOB_INTERSTITIAL_UNIT_ID_IOS,
  ADMOB_TEST_MODE,
} from '../constants';

const MIN_INTERSTITIAL_INTERVAL_MS = 120000;

let initialized = false;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialUnitId: string | null = null;
let lastShownAt = 0;

const resolveAdUnitId = (kind: 'banner' | 'interstitial'): string | null => {
  if (!ADMOB_ENABLED) {
    return null;
  }

  if (ADMOB_TEST_MODE) {
    return kind === 'banner' ? TestIds.BANNER : TestIds.INTERSTITIAL;
  }

  const candidate =
    Platform.OS === 'ios'
      ? kind === 'banner'
        ? ADMOB_BANNER_UNIT_ID_IOS
        : ADMOB_INTERSTITIAL_UNIT_ID_IOS
      : kind === 'banner'
        ? ADMOB_BANNER_UNIT_ID_ANDROID
        : ADMOB_INTERSTITIAL_UNIT_ID_ANDROID;

  const trimmed = (candidate ?? '').trim();
  return trimmed || null;
};

export const getBannerUnitId = (): string | null => resolveAdUnitId('banner');

export const initAdMob = async (): Promise<void> => {
  if (!ADMOB_ENABLED || initialized) {
    return;
  }
  initialized = true;
  try {
    await mobileAds().initialize();
  } catch {
    // ignore init errors; ads will be skipped
  }
};

const ensureInterstitial = (): InterstitialAd | null => {
  const unitId = resolveAdUnitId('interstitial');
  if (!unitId) {
    interstitial = null;
    interstitialLoaded = false;
    interstitialUnitId = null;
    return null;
  }

  if (interstitial && interstitialUnitId === unitId) {
    return interstitial;
  }

  interstitialUnitId = unitId;
  interstitialLoaded = false;
  interstitial = InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitial?.load();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
  });

  return interstitial;
};

export const loadInterstitialAd = (): void => {
  const current = ensureInterstitial();
  if (current && !interstitialLoaded) {
    current.load();
  }
};

export const showInterstitialAd = async (): Promise<boolean> => {
  const current = ensureInterstitial();
  if (!current || !interstitialLoaded) {
    return false;
  }

  const now = Date.now();
  if (now - lastShownAt < MIN_INTERSTITIAL_INTERVAL_MS) {
    return false;
  }

  try {
    await current.show();
    lastShownAt = now;
    return true;
  } catch {
    return false;
  }
};
