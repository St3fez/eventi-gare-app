import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { getBannerUnitId } from '../services/admob';
import { styles } from '../styles';

export function AdMobBanner() {
  const adUnitId = getBannerUnitId();
  if (!adUnitId) {
    return null;
  }

  return (
    <View style={styles.adBannerWrap}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}
