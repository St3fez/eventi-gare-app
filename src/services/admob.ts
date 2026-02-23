import { Platform } from 'react-native';

type AdMobApi = {
  getBannerUnitId: () => string | null;
  initAdMob: () => Promise<void>;
  loadInterstitialAd: () => void;
  showInterstitialAd: () => Promise<boolean>;
};

const impl = (Platform.OS === 'web'
  ? require('./admob.web')
  : require('./admob.native')) as AdMobApi;

export const getBannerUnitId = impl.getBannerUnitId;
export const initAdMob = impl.initAdMob;
export const loadInterstitialAd = impl.loadInterstitialAd;
export const showInterstitialAd = impl.showInterstitialAd;
