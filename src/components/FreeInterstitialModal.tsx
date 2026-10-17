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
  const hasNumber = typeof data?.assignedNumber === 'number';

  return (
    <Modal
      visible={Boolean(data)}
      transparent
      animationType='fade'
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.interstitialCard}>
          <Text style={styles.confirmCheck}>✓</Text>
          <Text style={styles.interstitialTitle}>{t('free_done_title')}</Text>
          <Text style={styles.interstitialText}>{data?.eventName ?? ''}</Text>

          {hasNumber ? (
            <View style={styles.bibBadge}>
              <Text style={styles.bibBadgeLabel}>{t('confirm_bib_label')}</Text>
              <Text style={styles.bibBadgeValue}>{data?.assignedNumber}</Text>
            </View>
          ) : null}

          <Text style={styles.interstitialText}>
            {t('free_done_code', { code: data?.registrationCode ?? '' })}
          </Text>
          {data && (data.groupParticipantsCount ?? 1) > 1 ? (
            <Text style={styles.helperText}>
              {t('group_participants_line', { count: data.groupParticipantsCount ?? 1 })}
            </Text>
          ) : null}

          {data?.participantEmail ? (
            <Text style={[styles.helperText, styles.textCenter]}>
              {t('confirm_email_sent_to', { email: data.participantEmail })}
            </Text>
          ) : data?.emailFailed ? (
            <View style={[styles.noticeCard, styles.noticeCardWarning]}>
              <Text style={styles.noticeText}>{t('confirm_email_failed_keep_code')}</Text>
            </View>
          ) : null}

          {data?.sponsor ? (
            <Text style={styles.interstitialSponsor}>{data.sponsor}</Text>
          ) : null}
          <Pressable style={[styles.primaryButton, styles.fullWidth]} onPress={onClose}>
            <Text style={styles.primaryButtonText}>{t('continue')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
