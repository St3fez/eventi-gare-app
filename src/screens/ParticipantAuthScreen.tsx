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
  const noticeStyle =
    notice?.tone === 'error'
      ? styles.noticeCardError
      : notice?.tone === 'success'
      ? styles.noticeCardSuccess
      : styles.noticeCardInfo;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('participant_access_title')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('participant_access_message')}</Text>
        <Text style={styles.helperText}>
          {t('participant_access_account', {
            value: status?.email || t('participant_access_not_logged'),
          })}
        </Text>
        <Text style={styles.helperText}>
          {t('participant_access_status', {
            value: securityReady
              ? t('participant_access_ready')
              : t('participant_access_not_ready'),
          })}
        </Text>
        {notice ? (
          <View style={[styles.noticeCard, noticeStyle]}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
        ) : null}

        <Pressable style={styles.primaryButton} onPress={() => void onGoogleSignIn()}>
          <Text style={styles.primaryButtonText}>{t('participant_access_google')}</Text>
        </Pressable>
        {status?.email ? (
          <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()}>
            <Text style={styles.secondaryButtonText}>{t('participant_access_signout')}</Text>
          </Pressable>
        ) : null}

        <TextField
          label={t('participant_access_email_label')}
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
        />
        <Text style={styles.helperText}>{t('participant_access_magic_hint')}</Text>
        <Pressable
          style={styles.inlineActionButton}
          onPress={() => void onEmailMagicLinkRequest(email)}
        >
          <Text style={styles.inlineActionButtonText}>{t('participant_access_magic_send')}</Text>
        </Pressable>

        <Pressable
          style={securityReady ? styles.primaryButton : styles.secondaryButton}
          onPress={() => void onContinue()}
        >
          <Text style={securityReady ? styles.primaryButtonText : styles.secondaryButtonText}>
            {t('participant_access_continue')}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
