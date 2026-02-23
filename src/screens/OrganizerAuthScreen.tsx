import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { OrganizerSecurityStatus } from '../services/authSupabase';
import { styles } from '../styles';

type Props = {
  status: OrganizerSecurityStatus | null;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onAppleSignIn: () => Promise<void>;
  onContinue: () => void;
  t: Translator;
};

export function OrganizerAuthScreen({
  status,
  onBack,
  onRefresh,
  onEmailSignIn,
  onEmailSignUp,
  onGoogleSignIn,
  onAppleSignIn,
  onContinue,
  t,
}: Props) {
  const [email, setEmail] = useState(status?.email ?? '');
  const [password, setPassword] = useState('');

  const socialReady = Boolean(status?.socialProvider);
  const emailReady = Boolean(status?.providers?.includes('email'));
  const securityReady = Boolean(status?.securityReady);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('organizer_security_title')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('organizer_security_intro')}</Text>
        <Text style={styles.helperText}>
          {t('organizer_security_account', {
            value: status?.email || t('organizer_security_not_logged'),
          })}
        </Text>
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
        <Pressable style={styles.secondaryButton} onPress={() => void onAppleSignIn()}>
          <Text style={styles.secondaryButtonText}>{t('organizer_security_apple')}</Text>
        </Pressable>

        <TextField
          label={t('organizer_security_email_label')}
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
        />
        <TextField
          label={t('organizer_security_password_label')}
          value={password}
          onChangeText={setPassword}
        />
        <View style={styles.inlineActionRow}>
          <Pressable
            style={styles.inlineActionButton}
            onPress={() => void onEmailSignIn(email, password)}
          >
            <Text style={styles.inlineActionButtonText}>{t('organizer_security_email_login')}</Text>
          </Pressable>
          <Pressable
            style={styles.inlineActionButton}
            onPress={() => void onEmailSignUp(email, password)}
          >
            <Text style={styles.inlineActionButtonText}>{t('organizer_security_email_signup')}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => void onRefresh()}>
          <Text style={styles.secondaryButtonText}>{t('organizer_security_refresh')}</Text>
        </Pressable>

        <Pressable
          style={securityReady ? styles.primaryButton : styles.secondaryButton}
          onPress={onContinue}
          disabled={!securityReady}
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
