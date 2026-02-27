import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { OrganizerSecurityStatus } from '../services/authSupabase';
import { styles } from '../styles';

type AuthNotice = {
  tone: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

type Props = {
  status: OrganizerSecurityStatus | null;
  notice?: AuthNotice | null;
  onBack: () => void;
  onEmailOtpRequest: (email: string) => Promise<void>;
  onEmailOtpVerify: (email: string, token: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onContinue: () => void | Promise<void>;
  t: Translator;
};

export function OrganizerAuthScreen({
  status,
  notice,
  onBack,
  onEmailOtpRequest,
  onEmailOtpVerify,
  onGoogleSignIn,
  onContinue,
  t,
}: Props) {
  const [email, setEmail] = useState(status?.email ?? '');
  const [otp, setOtp] = useState('');

  const socialReady = Boolean(status?.socialProvider);
  const emailReady = Boolean(status?.providers?.includes('email'));
  const securityReady = Boolean(status?.securityReady);

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

        <TextField
          label={t('organizer_security_email_label')}
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
        />
        <TextField
          label={t('organizer_security_otp_label')}
          value={otp}
          onChangeText={setOtp}
          keyboardType='decimal-pad'
        />
        <Text style={styles.helperText}>{t('organizer_security_otp_hint')}</Text>
        <View style={styles.inlineActionRow}>
          <Pressable
            style={styles.inlineActionButton}
            onPress={() => void onEmailOtpRequest(email)}
          >
            <Text style={styles.inlineActionButtonText}>
              {t('organizer_security_otp_send')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.inlineActionButton}
            onPress={() => void onEmailOtpVerify(email, otp)}
          >
            <Text style={styles.inlineActionButtonText}>
              {t('organizer_security_otp_verify')}
            </Text>
          </Pressable>
        </View>

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
