import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { COMMISSION_RATE, DEFAULT_PRIVACY_TEXT } from '../constants';
import { SectionCard, SwitchRow, TextField } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { organizerCanCreatePaidEvents, verificationStatusLabel } from '../services/fraud';
import { styles } from '../styles';
import { OrganizerProfile } from '../types';
import { cleanText, parseEuro, toMoney } from '../utils/format';

type Props = {
  organizer: OrganizerProfile;
  onBack: () => void;
  onCreate: (payload: {
    name: string;
    location: string;
    date: string;
    isFree: boolean;
    feeAmount: number;
    privacyText: string;
    logoUrl?: string;
    localSponsor?: string;
    assignNumbers: boolean;
  }) => void;
  t: Translator;
  language: AppLanguage;
};

export function OrganizerCreateEventScreen({
  organizer,
  onBack,
  onCreate,
  t,
  language,
}: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isFree, setIsFree] = useState(true);
  const [feeAmount, setFeeAmount] = useState('');
  const [privacyText, setPrivacyText] = useState(DEFAULT_PRIVACY_TEXT);
  const [logoUrl, setLogoUrl] = useState('');
  const [localSponsor, setLocalSponsor] = useState('');
  const [assignNumbers, setAssignNumbers] = useState(true);

  const canCreatePaid = organizerCanCreatePaidEvents(organizer);
  const feeValue = parseEuro(feeAmount);
  const commissionPreview = Number.parseFloat((feeValue * COMMISSION_RATE).toFixed(2));

  const handlePaidToggle = (nextValue: boolean) => {
    if (!nextValue) {
      setIsFree(true);
      return;
    }

    if (!canCreatePaid) {
      Alert.alert(
        t('payments_blocked_title'),
        t('payments_blocked_unverified')
      );
      setIsFree(true);
      return;
    }

    setIsFree(false);
  };

  const submit = () => {
    if (!isFree && !cleanText(organizer.bankAccount ?? '')) {
      Alert.alert(t('iban_missing_title'), t('iban_missing_message'));
      return;
    }

    if (!isFree && !canCreatePaid) {
      Alert.alert(t('payments_blocked_title'), t('payments_profile_blocked'));
      return;
    }

    onCreate({
      name,
      location,
      date,
      isFree,
      feeAmount: feeValue,
      privacyText,
      logoUrl,
      localSponsor,
      assignNumbers,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('create_event')}>
        <Text style={styles.cardParagraph}>{t('organizer_label', { email: organizer.email })}</Text>
        <Text style={styles.cardParagraph}>
          {t('verification_status', {
            status: verificationStatusLabel(organizer.verificationStatus, language),
            payout: organizer.payoutEnabled ? t('payout_active') : t('payout_inactive'),
          })}
        </Text>

        {!canCreatePaid ? (
          <Text style={styles.helperText}>{t('antifraud_only_free')}</Text>
        ) : null}

        <TextField label={t('event_name_required')} value={name} onChangeText={setName} />
        <TextField label={t('location_required')} value={location} onChangeText={setLocation} />
        <TextField
          label={t('event_date_label')}
          value={date}
          onChangeText={setDate}
          placeholder={t('event_date_placeholder')}
        />

        <SwitchRow
          label={t('free_event_switch')}
          value={isFree}
          onValueChange={(value) => handlePaidToggle(value)}
          helper={t('free_event_helper')}
        />

        {!isFree ? (
          <View style={styles.blockSpacing}>
            <TextField
              label={t('fee_label')}
              value={feeAmount}
              onChangeText={setFeeAmount}
              keyboardType='decimal-pad'
              placeholder={t('fee_placeholder')}
            />
            <Text style={styles.helperText}>
              {t('commission_preview', { value: toMoney(commissionPreview) })}
            </Text>
          </View>
        ) : null}

        <SwitchRow
          label={t('assign_numbers')}
          value={assignNumbers}
          onValueChange={setAssignNumbers}
        />

        <TextField
          label={t('logo_optional')}
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder='https://...'
        />
        <TextField
          label={t('sponsor_optional')}
          value={localSponsor}
          onChangeText={setLocalSponsor}
          placeholder={t('sponsor_placeholder')}
        />
        <TextField
          label={t('privacy_module')}
          value={privacyText}
          onChangeText={setPrivacyText}
          multiline
        />

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>{t('publish_event')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_dashboard')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
