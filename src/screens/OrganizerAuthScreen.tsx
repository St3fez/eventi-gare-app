import React, { useEffect, useMemo, useState } from 'react';
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

export function OrganizerAuthScreen({
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

  useEffect(() => {
    setEmail((current) => {
      const normalizedCurrent = cleanText(current);
      const nextEmail = cleanText(status?.email ?? '');
      if (!nextEmail) {
        return normalizedCurrent;
      }
      if (!normalizedCurrent || normalizedCurrent.toLowerCase() === nextEmail.toLowerCase()) {
        return nextEmail;
      }
      return current;
    });
  }, [status?.email]);

  const socialReady = Boolean(status?.socialProvider);
  const emailReady = Boolean(status?.providers?.includes('email'));
  const securityReady = Boolean(status?.securityReady);
  const normalizedEmail = cleanText(email).toLowerCase();
  const canSendMagicLink = isValidEmailAddress(normalizedEmail);
  const missingSecuritySteps = useMemo(() => {
    const missing: string[] = [];
    if (!socialReady) {
      missing.push(t('organizer_security_social_status', { value: t('organizer_security_missing') }));
    }
    if (!emailReady) {
      missing.push(t('organizer_security_email_status', { value: t('organizer_security_missing') }));
    }
    return missing;
  }, [emailReady, socialReady, t]);

  const noticeStyle =
    notice?.tone === 'error'
      ? styles.noticeCardError
      : notice?.tone === 'success'
      ? styles.noticeCardSuccess
      : styles.noticeCardInfo;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('organizer_security_title')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('organizer_security_intro')}</Text>
        <Text style={styles.helperText}>
          {t('organizer_security_account', {
            value: status?.email || t('organizer_security_not_logged'),
          })}
        </Text>
        {notice ? (
          <View style={[styles.noticeCard, noticeStyle]}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
        ) : null}
        <View style={styles.registrationCard}>
          <Text style={styles.fieldLabel}>{t('organizer_security_ready_status', {
            value: securityReady
              ? t('organizer_security_ready')
              : t('organizer_security_not_ready'),
          })}</Text>
          {!securityReady && missingSecuritySteps.length ? (
            <>
              {missingSecuritySteps.map((label) => (
                <Text key={label} style={styles.listSubText}>
                  - {label}
                </Text>
              ))}
            </>
          ) : null}
          <Text style={styles.listSubText}>
            {t('organizer_security_social_status', {
              value: socialReady
                ? `${t('organizer_security_ok')} (${String(status?.socialProvider).toUpperCase()})`
                : t('organizer_security_missing'),
            })}
          </Text>
          <Text style={styles.listSubText}>
            {t('organizer_security_email_status', {
              value: emailReady ? t('organizer_security_ok') : t('organizer_security_missing'),
            })}
          </Text>
          <Text style={styles.listSubText}>
            {t('organizer_security_ready_status', {
              value: securityReady
                ? t('organizer_security_ready')
                : t('organizer_security_not_ready'),
            })}
          </Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => void onGoogleSignIn()}>
          <Text style={styles.primaryButtonText}>{t('organizer_security_google')}</Text>
        </Pressable>
        {status?.email ? (
          <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()}>
            <Text style={styles.secondaryButtonText}>{t('organizer_security_signout')}</Text>
          </Pressable>
        ) : null}

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
          returnKeyType='done'
        />
        <Text style={styles.helperText}>{t('organizer_security_otp_hint')}</Text>
        {!canSendMagicLink ? (
          <Text style={styles.helperText}>{t('invalid_email_message')}</Text>
        ) : null}
        <Pressable
          style={[styles.inlineActionButton, !canSendMagicLink ? styles.primaryButtonDisabled : undefined]}
          onPress={() => void onEmailMagicLinkRequest(normalizedEmail)}
          disabled={!canSendMagicLink}
        >
          <Text style={styles.inlineActionButtonText}>
            {t('organizer_security_otp_send')}
          </Text>
        </Pressable>

        <Pressable
          style={securityReady ? styles.primaryButton : styles.secondaryButton}
          onPress={() => void onContinue()}
        >
          <Text
            style={
              securityReady ? styles.primaryButtonText : styles.secondaryButtonText
            }
          >
            {t('organizer_security_continue')}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
