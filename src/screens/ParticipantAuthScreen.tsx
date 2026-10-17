import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { OrganizerSecurityStatus } from '../services/authSupabase';
import { styles } from '../styles';
import { cleanText, isValidEmailAddress } from '../utils/format';

type AuthNotice = {
  tone: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

type Props = {
  status: OrganizerSecurityStatus | null;
  notice?: AuthNotice | null;
  onBack: () => void;
  onEmailMagicLinkRequest: (email: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onContinue: () => void | Promise<void>;
  t: Translator;
};

export function ParticipantAuthScreen({
  status,
  notice,
  onBack,
  onEmailMagicLinkRequest,
  onGoogleSignIn,
  onSignOut,
  onContinue,
  t,
}: Props) {
  const [email, setEmail] = useState(status?.email ?? '');

  const securityReady = Boolean(status?.securityReady);
  const normalizedEmail = cleanText(email).toLowerCase();
  const canSendMagicLink = isValidEmailAddress(normalizedEmail);
  const noticeStyle =
    notice?.tone === 'error'
      ? styles.noticeCardError
      : notice?.tone === 'success'
        ? styles.noticeCardSuccess
        : styles.noticeCardInfo;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('participant_access_title')} delayMs={0}>
        {notice ? (
          <View style={[styles.noticeCard, noticeStyle]}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
        ) : null}

        {securityReady ? (
          <>
            <View style={[styles.noticeCard, styles.noticeCardSuccess]}>
              <Text style={styles.noticeText}>
                {t('organizer_auth_signed_in', { email: status?.email ?? '' })}
              </Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void onContinue()}>
              <Text style={styles.primaryButtonText}>{t('participant_access_continue')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()}>
              <Text style={styles.secondaryButtonText}>{t('participant_access_signout')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardParagraph}>{t('participant_access_required_intro')}</Text>
            <Pressable style={styles.primaryButton} onPress={() => void onGoogleSignIn()}>
              <Text style={styles.primaryButtonText}>{t('participant_access_google')}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('organizer_auth_or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextField
              label={t('organizer_security_email_label')}
              value={email}
              onChangeText={setEmail}
              keyboardType='email-address'
              autoCapitalize='none'
              autoCorrect={false}
              autoComplete='email'
              textContentType='emailAddress'
              inputMode='email'
              returnKeyType='send'
            />
            <Pressable
              style={[styles.secondaryButton, !canSendMagicLink ? styles.primaryButtonDisabled : undefined]}
              onPress={() => void onEmailMagicLinkRequest(normalizedEmail)}
              disabled={!canSendMagicLink}
            >
              <Text style={styles.secondaryButtonText}>{t('organizer_security_otp_send')}</Text>
            </Pressable>
            <Text style={styles.helperText}>{t('organizer_security_otp_hint')}</Text>

            <Pressable onPress={() => void onContinue()} accessibilityRole='button'>
              <Text style={styles.textLink}>{t('organizer_auth_already')}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={onBack} accessibilityRole='button'>
          <Text style={styles.textLink}>← {t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
