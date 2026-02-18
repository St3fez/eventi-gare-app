import React from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { MetricChip, SectionCard } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { styles } from '../styles';

type Props = {
  eventCount: number;
  registrationCount: number;
  onOrganizer: () => void;
  onParticipant: () => void;
  onOpenLegal: () => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  t: Translator;
};

export function RoleSelectionScreen({
  eventCount,
  registrationCount,
  onOrganizer,
  onParticipant,
  onOpenLegal,
  language,
  onLanguageChange,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 980;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('home_select_user_type')} delayMs={0}>
            <Text style={styles.cardParagraph}>{t('home_intro')}</Text>
            <View style={styles.homeTopActions}>
              <Pressable style={styles.inlineActionButton} onPress={onOpenLegal}>
                <Text style={styles.inlineActionButtonText}>{t('legal_button')}</Text>
              </Pressable>
            </View>
            <View style={styles.languageRow}>
              <Text style={styles.fieldLabel}>{t('language_label')}</Text>
              <View style={styles.languageSwitchWrap}>
                <Pressable
                  style={[
                    styles.languageChip,
                    language === 'it' ? styles.languageChipActive : undefined,
                  ]}
                  onPress={() => onLanguageChange('it')}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      language === 'it' ? styles.languageChipTextActive : undefined,
                    ]}
                  >
                    IT
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.languageChip,
                    language === 'en' ? styles.languageChipActive : undefined,
                  ]}
                  onPress={() => onLanguageChange('en')}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      language === 'en' ? styles.languageChipTextActive : undefined,
                    ]}
                  >
                    EN
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('metric_total_events')} value={String(eventCount)} />
              <MetricChip label={t('metric_total_registrations')} value={String(registrationCount)} />
            </View>
            <Pressable style={styles.primaryButton} onPress={onOrganizer}>
              <Text style={styles.primaryButtonText}>{t('enter_as_organizer')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onParticipant}>
              <Text style={styles.secondaryButtonText}>{t('enter_as_participant')}</Text>
            </Pressable>
          </SectionCard>
        </View>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('included_features')} delayMs={120}>
            <Text style={styles.cardParagraph}>{t('feature_1')}</Text>
            <Text style={styles.cardParagraph}>{t('feature_2')}</Text>
            <Text style={styles.cardParagraph}>{t('feature_3')}</Text>
            <Text style={styles.cardParagraph}>{t('feature_4')}</Text>
            <Text style={styles.cardParagraph}>{t('feature_5')}</Text>
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
