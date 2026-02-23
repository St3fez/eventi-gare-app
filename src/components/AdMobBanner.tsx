import React from 'react';
import { Platform } from 'react-native';

type BannerComponent = () => React.JSX.Element | null;

const BannerImpl = (Platform.OS === 'web'
  ? require('./AdMobBanner.web')
  : require('./AdMobBanner.native')) as { AdMobBanner: BannerComponent };

export function AdMobBanner() {
  return <BannerImpl.AdMobBanner />;
}
