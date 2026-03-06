import React, { useMemo, useState } from 'react';
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
  const missingAccessSteps = useMemo(() => {
    const missing: string[] = [];
    if (!securityReady) {
      missing.push(t('participant_access_checklist_login'));
    }
    return missing;
  }, [securityReady, t]);
  const canContinue = missingAccessSteps.length === 0;
  const noticeStyle =
    notice?.tone === 'error'
      ? styles.noticeCardError
      : notice?.tone === 'success'
      ? styles.noticeCardSuccess
      : styles.noticeCardInfo;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('participant_access_title')} delayMs={0}>
        <View style={styles.heroPanel}>
          <Text style={styles.heroEyebrow}>{t('participant_access_eyebrow')}</Text>
          <Text style={styles.emphasisParagraph}>{t('participant_access_message')}</Text>
          <View style={styles.statusBadgeRow}>
            <Text style={styles.helperText}>
              {t('participant_access_account', {
                value: status?.email || t('participant_access_not_logged'),
              })}
            </Text>
          </View>
        </View>
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
        <View style={styles.registrationCard}>
          <Text style={styles.fieldLabel}>{t('participant_access_checklist_title')}</Text>
          <Text style={styles.helperText}>{t('participant_access_checklist_intro')}</Text>
          {canContinue ? (
            <Text style={styles.helperText}>{t('participant_access_checklist_ready')}</Text>
          ) : (
            <>
              <Text style={styles.helperText}>
                {t('guided_required_checklist_missing', { count: missingAccessSteps.length })}
              </Text>
              {missingAccessSteps.map((label) => (
                <Text key={label} style={styles.listSubText}>
                  - {label}
                </Text>
              ))}
            </>
          )}
        </View>
        <View style={styles.flowCard}>
          <View style={styles.flowStepRow}>
            <Text style={styles.flowStepIndex}>1</Text>
            <Text style={styles.flowStepText}>{t('participant_access_step_1')}</Text>
          </View>
          <View style={styles.flowStepRow}>
            <Text style={styles.flowStepIndex}>2</Text>
            <Text style={styles.flowStepText}>{t('participant_access_step_2')}</Text>
          </View>
          <View style={styles.flowStepRow}>
            <Text style={styles.flowStepIndex}>3</Text>
            <Text style={styles.flowStepText}>{t('participant_access_step_3')}</Text>
          </View>
        </View>
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
        {!canSendMagicLink ? (
          <Text style={styles.helperText}>{t('participant_access_magic_email_hint')}</Text>
        ) : null}
        <Pressable
          style={[styles.inlineActionButton, !canSendMagicLink ? styles.primaryButtonDisabled : undefined]}
          onPress={() => void onEmailMagicLinkRequest(normalizedEmail)}
          disabled={!canSendMagicLink}
        >
          <Text style={styles.inlineActionButtonText}>{t('participant_access_magic_send')}</Text>
        </Pressable>

        <Pressable
          style={[
            securityReady ? styles.primaryButton : styles.secondaryButton,
            !canContinue ? styles.primaryButtonDisabled : undefined,
          ]}
          onPress={() => void onContinue()}
          disabled={!canContinue}
        >
          <Text style={securityReady ? styles.primaryButtonText : styles.secondaryButtonText}>
            {t('participant_access_continue')}
          </Text>
        </Pressable>
        {!canContinue ? (
          <Text style={styles.helperText}>{t('participant_access_continue_hint')}</Text>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
