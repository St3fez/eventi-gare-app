import React from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { SectionCard } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { styles } from '../styles';

type Props = {
  appPublicUrl: string | null;
  contactEmail: string;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  onOpenHome: () => void;
  t: Translator;
};

export function PrivacyPolicyScreen({
  appPublicUrl,
  contactEmail,
  language,
  onLanguageChange,
  onOpenHome,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 980;
  const normalizedBaseUrl = appPublicUrl ? appPublicUrl.replace(/\/+$/, '') : '';
  const privacyPolicyUrl = normalizedBaseUrl ? `${normalizedBaseUrl}/privacy-policy` : '';

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View
          style={[
            styles.screenSplitColumn,
            isDesktopLayout ? styles.screenSplitColumnMain : undefined,
          ]}
        >
          <SectionCard title={t('privacy_policy_page_title')} delayMs={0}>
            <View style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>{t('privacy_policy_eyebrow')}</Text>
              <Text style={styles.heroHeadline}>{t('privacy_policy_page_title')}</Text>
              <Text style={styles.emphasisParagraph}>{t('privacy_policy_page_intro')}</Text>
              <Text style={styles.helperText}>{t('privacy_policy_page_last_updated')}</Text>
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

            <View style={styles.inlineActionRow}>
              <Pressable style={styles.primaryButton} onPress={onOpenHome}>
                <Text style={styles.primaryButtonText}>{t('privacy_policy_back_home')}</Text>
              </Pressable>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_scope_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_scope_body')}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_data_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_data_item_1')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_data_item_2')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_data_item_3')}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_purposes_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_purposes_body')}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_basis_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_basis_body')}</Text>
            </View>
          </SectionCard>
        </View>

        <View
          style={[
            styles.screenSplitColumn,
            isDesktopLayout ? styles.screenSplitColumnSide : undefined,
          ]}
        >
          <SectionCard title={t('privacy_policy_additional_title')} delayMs={120}>
            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_retention_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_retention_body')}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_third_parties_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_third_parties_body')}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_rights_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_rights_body', { email: contactEmail })}</Text>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('privacy_policy_disclaimer_title')}</Text>
              <Text style={styles.cardParagraph}>{t('privacy_policy_disclaimer_body')}</Text>
            </View>

            {privacyPolicyUrl ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>{t('privacy_policy_public_url_title')}</Text>
                <Text style={styles.noticeText}>{privacyPolicyUrl}</Text>
              </View>
            ) : null}
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
