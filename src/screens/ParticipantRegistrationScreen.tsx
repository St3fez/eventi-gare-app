import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';

import { CheckboxRow, SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, RegistrationDraft } from '../types';
import { cleanText, formatDate, toMoney } from '../utils/format';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [retentionConsent, setRetentionConsent] = useState(false);

  const submit = () => {
    if (!cleanText(fullName) || !cleanText(email)) {
      Alert.alert(t('missing_data_title'), t('missing_registration_data_message'));
      return;
    }

    const draft: RegistrationDraft = {
      fullName,
      email,
      phone,
      city,
      birthDate,
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
      <SectionCard title={t('event_detail')}>
        <Text style={styles.listTitle}>{event.name}</Text>
        <Text style={styles.listSubText}>{t('place_label', { value: event.location })}</Text>
        <Text style={styles.listSubText}>{t('date_label', { value: formatDate(event.date) })}</Text>
        <Text style={styles.listSubText}>
          {t('type_label', {
            value: event.isFree ? t('free_type') : t('paid_type', { fee: toMoney(event.feeAmount) }),
          })}
        </Text>
        {!event.isFree ? (
          <Text style={styles.helperText}>{t('paid_pending_helper')}</Text>
        ) : null}
        <Text style={styles.helperText}>{event.privacyText}</Text>
      </SectionCard>

      <SectionCard title={t('participant_data')}>
        <TextField label={t('full_name_required')} value={fullName} onChangeText={setFullName} />
        <TextField label={t('email_required')} value={email} onChangeText={setEmail} keyboardType='email-address' />
        <TextField label={t('phone_label')} value={phone} onChangeText={setPhone} keyboardType='phone-pad' />
        <TextField label={t('city_label')} value={city} onChangeText={setCity} />
        <TextField
          label={t('birthdate_optional')}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder={t('birthdate_placeholder')}
        />

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

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>
            {event.isFree ? t('confirm_free_registration') : t('open_payment_session')}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_search')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
