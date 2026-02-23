import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { SectionCard } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';

type Props = {
  onBack: () => void;
  onContinue: () => void;
  t: Translator;
};

export function ParticipantAuthScreen({ onBack, onContinue, t }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('participant_access_title')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('participant_access_message')}</Text>
        <Pressable style={styles.primaryButton} onPress={onContinue}>
          <Text style={styles.primaryButtonText}>{t('participant_access_continue')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
