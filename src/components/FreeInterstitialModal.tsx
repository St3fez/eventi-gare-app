import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Translator } from '../i18n';
import { styles } from '../styles';
import { FreeInterstitial } from '../types';

type FreeInterstitialModalProps = {
  data: FreeInterstitial | null;
  onClose: () => void;
  t: Translator;
};

export function FreeInterstitialModal({ data, onClose, t }: FreeInterstitialModalProps) {
  return (
    <Modal
      visible={Boolean(data)}
      transparent
      animationType='fade'
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.interstitialCard}>
          <Text style={styles.interstitialTitle}>{t('free_done_title')}</Text>
          <Text style={styles.interstitialText}>
            {t('free_done_event', { event: data?.eventName ?? '' })}
          </Text>
          <Text style={styles.interstitialText}>
            {t('free_done_code', { code: data?.registrationCode ?? '' })}
          </Text>
          {data?.sponsor ? (
            <Text style={styles.interstitialSponsor}>{data.sponsor}</Text>
          ) : (
            <Text style={styles.interstitialSponsor}>{t('free_done_sponsor_fallback')}</Text>
          )}
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>{t('continue')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
