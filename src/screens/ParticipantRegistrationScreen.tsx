import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { CheckboxRow, SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, RegistrationDraft } from '../types';
import { cleanText, formatDate, formatEventSchedule, toMoney } from '../utils/format';

type Props = {
  event: EventItem;
  onBack: () => void;
  onCompleteFree: (draft: RegistrationDraft) => Promise<void>;
  onProceedPayment: (draft: RegistrationDraft) => Promise<void>;
  t: Translator;
};

export function ParticipantRegistrationScreen({
  event,
  onBack,
  onCompleteFree,
  onProceedPayment,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1080;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [groupParticipantsCount, setGroupParticipantsCount] = useState('1');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [retentionConsent, setRetentionConsent] = useState(false);

  const submit = () => {
    if (!cleanText(fullName) || !cleanText(email)) {
      Alert.alert(t('missing_data_title'), t('missing_registration_data_message'));
      return;
    }

    const parsedGroupCount = Number.parseInt(groupParticipantsCount, 10);
    if (!Number.isFinite(parsedGroupCount) || parsedGroupCount <= 0) {
      Alert.alert(t('missing_data_title'), t('group_participants_invalid'));
      return;
    }

    const draft: RegistrationDraft = {
      fullName,
      email,
      phone,
      city,
      birthDate,
      groupParticipantsCount: parsedGroupCount,
      privacyConsent,
      retentionConsent,
    };

    if (event.isFree) {
      void onCompleteFree(draft);
      return;
    }

    void onProceedPayment(draft);
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('event_detail')} delayMs={0}>
            <Text style={styles.listTitle}>{event.name}</Text>
            <Text style={styles.listSubText}>{t('place_label', { value: event.location })}</Text>
            <Text style={styles.listSubText}>
              {t('date_label', { value: formatEventSchedule(event) })}
            </Text>
            <Text style={styles.listSubText}>
              {t('registration_window_line', {
                from: formatDate(event.registrationOpenDate),
                to: formatDate(event.registrationCloseDate),
              })}
            </Text>
            <Text style={styles.listSubText}>
              {t('type_label', {
                value: event.isFree ? t('free_type') : t('paid_type', { fee: toMoney(event.feeAmount) }),
              })}
            </Text>
            <Text style={styles.listSubText}>
              {t('participant_no_auth_line')}
            </Text>
            {!event.isFree ? (
              <Text style={styles.helperText}>{t('paid_pending_helper')}</Text>
            ) : null}
            <Text style={styles.helperText}>{event.privacyText}</Text>
          </SectionCard>
        </View>

        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('participant_data')} delayMs={120}>
            <TextField label={t('full_name_required')} value={fullName} onChangeText={setFullName} />
            <TextField label={t('email_required')} value={email} onChangeText={setEmail} keyboardType='email-address' />
            <TextField label={t('phone_label')} value={phone} onChangeText={setPhone} keyboardType='phone-pad' />
            <TextField label={t('city_label')} value={city} onChangeText={setCity} />
            <TextField
              label={t('group_participants_count_label')}
              value={groupParticipantsCount}
              onChangeText={setGroupParticipantsCount}
              keyboardType='decimal-pad'
            />
            <Text style={styles.helperText}>{t('group_participants_count_helper')}</Text>
            <TextField
              label={t('birthdate_optional')}
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder={t('birthdate_placeholder')}
            />
            {!event.isFree ? (
              <Text style={styles.helperText}>
                {t('group_total_amount_line', {
                  value: toMoney(
                    event.feeAmount *
                      Math.max(1, Number.isFinite(Number.parseInt(groupParticipantsCount, 10)) ? Number.parseInt(groupParticipantsCount, 10) : 1)
                  ),
                })}
              </Text>
            ) : null}

            <CheckboxRow
              value={privacyConsent}
              onToggle={() => setPrivacyConsent((value) => !value)}
              label={t('consent_privacy')}
            />
            <CheckboxRow
              value={retentionConsent}
              onToggle={() => setRetentionConsent((value) => !value)}
              label={t('consent_retention')}
            />
            <Text style={styles.helperText}>{t('retention_policy_notice')}</Text>

            <Pressable style={styles.primaryButton} onPress={submit}>
              <Text style={styles.primaryButtonText}>
                {event.isFree ? t('confirm_free_registration') : t('open_payment_session')}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_search')}</Text>
            </Pressable>
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
