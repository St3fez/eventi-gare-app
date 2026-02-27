import React from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { PRIVACY_POLICY_URL } from '../constants';
import { Translator } from '../i18n';
import { styles } from '../styles';

type LegalModalProps = {
  visible: boolean;
  onClose: () => void;
  t: Translator;
};

export function LegalModal({ visible, onClose, t }: LegalModalProps) {
  const privacyPolicyUrl = String(PRIVACY_POLICY_URL ?? '').trim();

  const openPrivacyPolicy = async () => {
    if (!privacyPolicyUrl) {
      Alert.alert(t('privacy_policy_missing_title'), t('privacy_policy_missing_message'));
      return;
    }

    try {
      await Linking.openURL(privacyPolicyUrl);
    } catch {
      Alert.alert(t('privacy_policy_open_error_title'), t('privacy_policy_open_error_message'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.legalModalCard}>
          <ScrollView contentContainerStyle={styles.legalModalContent}>
            <Text style={styles.modalTitle}>{t('legal_title')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p1')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p2')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p3')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p4')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p5')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p6')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p7')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p8')}</Text>
            <Text style={styles.modalParagraph}>{t('legal_p9')}</Text>
            <Text style={styles.modalParagraph}>
              {t('privacy_policy_link_line', {
                url: privacyPolicyUrl || '-',
              })}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => void openPrivacyPolicy()}>
              <Text style={styles.secondaryButtonText}>{t('privacy_policy_button')}</Text>
            </Pressable>
          </ScrollView>
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>{t('close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
