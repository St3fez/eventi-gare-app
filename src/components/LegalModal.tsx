import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Translator } from '../i18n';
import { styles } from '../styles';

type LegalModalProps = {
  visible: boolean;
  onClose: () => void;
  t: Translator;
};

export function LegalModal({ visible, onClose, t }: LegalModalProps) {
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
          </ScrollView>
          <Pressable style={styles.primaryButton} onPress={onClose}>
            <Text style={styles.primaryButtonText}>{t('close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
