import React from 'react';
import QRCode from 'react-native-qrcode-svg';
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
  appPublicUrl: string | null;
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
  appPublicUrl,
  language,
  onLanguageChange,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 980;
  const qrSize = isDesktopLayout ? 136 : 112;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('home_select_user_type')} delayMs={0}>
            <View style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>{t('app_name')}</Text>
              <Text style={styles.heroHeadline}>{t('home_flow_title')}</Text>
              <Text style={styles.emphasisParagraph}>{t('home_intro')}</Text>
              <View style={styles.inlineMetricRow}>
                <MetricChip label={t('metric_total_events')} value={String(eventCount)} />
                <MetricChip
                  label={t('metric_total_registrations')}
                  value={String(registrationCount)}
                />
              </View>
            </View>

            <View style={styles.flowCard}>
              <View style={styles.flowStepRow}>
                <Text style={styles.flowStepIndex}>1</Text>
                <Text style={styles.flowStepText}>{t('home_flow_step_1')}</Text>
              </View>
              <View style={styles.flowStepRow}>
                <Text style={styles.flowStepIndex}>2</Text>
                <Text style={styles.flowStepText}>{t('home_flow_step_2')}</Text>
              </View>
              <View style={styles.flowStepRow}>
                <Text style={styles.flowStepIndex}>3</Text>
                <Text style={styles.flowStepText}>{t('home_flow_step_3')}</Text>
              </View>
            </View>

            {appPublicUrl ? (
              <View style={styles.formSectionCard}>
                <Text style={styles.sectionHeaderTitle}>{t('home_mobile_qr_title')}</Text>
                <Text style={styles.helperText}>{t('home_mobile_qr_intro')}</Text>
                <View
                  style={[
                    styles.homeQrLayout,
                    isDesktopLayout ? styles.homeQrLayoutDesktop : undefined,
                  ]}
                >
                  <View style={styles.qrWrap}>
                    <View style={styles.qrCard}>
                      <QRCode value={appPublicUrl} size={qrSize} />
                    </View>
                  </View>
                  <View style={styles.homeQrTextBlock}>
                    <Text style={styles.fieldLabel}>{t('official_app_qr_title')}</Text>
                    <Text style={styles.listSubText}>{t('home_mobile_qr_hint')}</Text>
                    <Text style={styles.homeQrUrl}>{appPublicUrl}</Text>
                  </View>
                </View>
              </View>
            ) : null}

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

            <View
              style={[
                styles.actionChoiceGrid,
                isDesktopLayout ? styles.actionChoiceGridDesktop : undefined,
              ]}
            >
              <View style={[styles.actionChoiceCard, styles.actionChoiceCardPrimary]}>
                <Text style={styles.actionChoiceTitle}>{t('enter_as_participant')}</Text>
                <Text style={styles.actionChoiceText}>{t('home_role_participant_hint')}</Text>
                <Pressable style={styles.primaryButton} onPress={onParticipant}>
                  <Text style={styles.primaryButtonText}>{t('enter_as_participant')}</Text>
                </Pressable>
              </View>

              <View style={styles.actionChoiceCard}>
                <Text style={styles.actionChoiceTitle}>{t('enter_as_organizer')}</Text>
                <Text style={styles.actionChoiceText}>{t('home_role_organizer_hint')}</Text>
                <Pressable style={styles.secondaryButton} onPress={onOrganizer}>
                  <Text style={styles.secondaryButtonText}>{t('enter_as_organizer')}</Text>
                </Pressable>
              </View>
            </View>
          </SectionCard>
        </View>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('included_features')} delayMs={120}>
            <Text style={styles.cardParagraph}>{t('home_features_hint')}</Text>
            <View style={styles.flowCard}>
              <Text style={styles.cardParagraph}>{t('feature_1')}</Text>
              <Text style={styles.cardParagraph}>{t('feature_2')}</Text>
              <Text style={styles.cardParagraph}>{t('feature_3')}</Text>
              <Text style={styles.cardParagraph}>{t('feature_4')}</Text>
              <Text style={styles.cardParagraph}>{t('feature_5')}</Text>
            </View>
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
