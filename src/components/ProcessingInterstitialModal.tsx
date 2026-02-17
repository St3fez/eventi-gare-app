import React from 'react';
import { Modal, Text, View } from 'react-native';

import { Translator } from '../i18n';
import { styles } from '../styles';

type ProcessingInterstitialModalProps = {
  visible: boolean;
  secondsRemaining: number;
  sponsor?: string;
  t: Translator;
};

export function ProcessingInterstitialModal({
  visible,
  secondsRemaining,
  sponsor,
  t,
}: ProcessingInterstitialModalProps) {
  return (
    <Modal visible={visible} transparent animationType='fade'>
      <View style={styles.modalOverlay}>
        <View style={styles.interstitialCard}>
          <Text style={styles.interstitialTitle}>{t('interstitial_processing_title')}</Text>
          <Text style={styles.interstitialText}>
            {t('interstitial_processing_subtitle', { seconds: secondsRemaining })}
          </Text>
          <Text style={styles.interstitialSponsor}>
            {sponsor ? sponsor : t('interstitial_processing_fallback')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
