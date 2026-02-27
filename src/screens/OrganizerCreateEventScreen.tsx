import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  COMMISSION_RATE,
  DEFAULT_PRIVACY_TEXT,
  MAX_IMAGE_UPLOAD_BYTES,
  ORGANIZER_TEST_MODE,
  STRIPE_PROVIDER_FEE_FIXED,
  STRIPE_PROVIDER_FEE_RATE,
} from '../constants';
import { SectionCard, SwitchRow, TextField } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { organizerCanUsePaidSection, verificationStatusLabel } from '../services/fraud';
import { styles } from '../styles';
import {
  EventItem,
  EventFeePolicy,
  EventPaymentChannel,
  OrganizerProfile,
  ParticipantAuthMode,
} from '../types';
import {
  cleanText,
  estimateDataUrlBytes,
  isImageDataUrl,
  parseEuro,
  toIsoDate,
  toIsoTime,
  toMoney,
} from '../utils/format';

const assetToDataUrl = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('file_read_error'));
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('file_read_error'));
      };
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const mime = cleanText(asset.mimeType ?? '') || 'image/png';
  return `data:${mime};base64,${base64}`;
};

type Props = {
  organizer: OrganizerProfile;
  initialEvent?: EventItem;
  onBack: () => void;
  onCreate: (payload: {
    eventId?: string;
    name: string;
    location: string;
    date: string;
    endDate: string;
    startTime: string;
    isFree: boolean;
    baseFeeAmount: number;
    feePolicy: EventFeePolicy;
    paymentChannel: EventPaymentChannel;
    cashPaymentEnabled: boolean;
    cashPaymentInstructions?: string;
    cashPaymentDeadline?: string;
    registrationOpenDate: string;
    registrationCloseDate: string;
    visibility: 'public' | 'hidden';
    participantAuthMode: ParticipantAuthMode;
    participantPhoneRequired: boolean;
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
  initialEvent,
  onBack,
  onCreate,
  t,
  language,
}: Props) {
  const maxImageKb = Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(initialEvent?.name ?? '');
  const [location, setLocation] = useState(initialEvent?.location ?? '');
  const [date, setDate] = useState(initialEvent?.date ?? todayIso);
  const [endDate, setEndDate] = useState(initialEvent?.endDate ?? initialEvent?.date ?? todayIso);
  const [startTime, setStartTime] = useState(initialEvent?.startTime ?? '09:00');
  const [isFree, setIsFree] = useState(initialEvent?.isFree ?? true);
  const [baseFeeAmount, setBaseFeeAmount] = useState(
    initialEvent && !initialEvent.isFree ? String(initialEvent.baseFeeAmount) : ''
  );
  const [feePolicy, setFeePolicy] = useState<EventFeePolicy>(
    initialEvent?.feePolicy ?? 'organizer_absorbs_fees'
  );
  const paymentChannel: EventPaymentChannel = 'stripe';
  const [cashPaymentEnabled, setCashPaymentEnabled] = useState(
    initialEvent?.cashPaymentEnabled ?? false
  );
  const [cashPaymentInstructions, setCashPaymentInstructions] = useState(
    initialEvent?.cashPaymentInstructions ?? ''
  );
  const [cashPaymentDeadline, setCashPaymentDeadline] = useState(
    initialEvent?.cashPaymentDeadline ?? ''
  );
  const [registrationOpenDate, setRegistrationOpenDate] = useState(
    initialEvent?.registrationOpenDate ?? todayIso
  );
  const [registrationCloseDate, setRegistrationCloseDate] = useState(
    initialEvent?.registrationCloseDate ?? todayIso
  );
  const [visibility, setVisibility] = useState<'public' | 'hidden'>(
    initialEvent?.visibility ?? 'public'
  );
  const [privacyText, setPrivacyText] = useState(
    initialEvent?.privacyText ?? DEFAULT_PRIVACY_TEXT
  );
  const [logoUrl, setLogoUrl] = useState(initialEvent?.logoUrl ?? '');
  const [logoFileName, setLogoFileName] = useState('');
  const [localSponsorText, setLocalSponsorText] = useState(() => {
    const initialValue = initialEvent?.localSponsor ?? '';
    return isImageDataUrl(initialValue) ? '' : initialValue;
  });
  const [localSponsorLogoUrl, setLocalSponsorLogoUrl] = useState(() => {
    const initialValue = initialEvent?.localSponsor ?? '';
    return isImageDataUrl(initialValue) ? initialValue : '';
  });
  const [localSponsorFileName, setLocalSponsorFileName] = useState('');
  const [assignNumbers, setAssignNumbers] = useState(initialEvent?.assignNumbers ?? true);

  useEffect(() => {
    setName(initialEvent?.name ?? '');
    setLocation(initialEvent?.location ?? '');
    setDate(initialEvent?.date ?? todayIso);
    setEndDate(initialEvent?.endDate ?? initialEvent?.date ?? todayIso);
    setStartTime(initialEvent?.startTime ?? '09:00');
    setIsFree(initialEvent?.isFree ?? true);
    setBaseFeeAmount(initialEvent && !initialEvent.isFree ? String(initialEvent.baseFeeAmount) : '');
    setFeePolicy(initialEvent?.feePolicy ?? 'organizer_absorbs_fees');
    setCashPaymentEnabled(initialEvent?.cashPaymentEnabled ?? false);
    setCashPaymentInstructions(initialEvent?.cashPaymentInstructions ?? '');
    setCashPaymentDeadline(initialEvent?.cashPaymentDeadline ?? '');
    setRegistrationOpenDate(initialEvent?.registrationOpenDate ?? todayIso);
    setRegistrationCloseDate(initialEvent?.registrationCloseDate ?? todayIso);
    setVisibility(initialEvent?.visibility ?? 'public');
    setPrivacyText(initialEvent?.privacyText ?? DEFAULT_PRIVACY_TEXT);
    setLogoUrl(initialEvent?.logoUrl ?? '');
    setLogoFileName('');
    const initialSponsor = initialEvent?.localSponsor ?? '';
    if (isImageDataUrl(initialSponsor)) {
      setLocalSponsorText('');
      setLocalSponsorLogoUrl(initialSponsor);
    } else {
      setLocalSponsorText(initialSponsor);
      setLocalSponsorLogoUrl('');
    }
    setLocalSponsorFileName('');
    setAssignNumbers(initialEvent?.assignNumbers ?? true);
  }, [initialEvent?.id, todayIso]);

  const pickEventLogo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    if (!file.uri || !file.name) {
      return;
    }

    try {
      const dataUrl = await assetToDataUrl(file);
      if (estimateDataUrlBytes(dataUrl) > MAX_IMAGE_UPLOAD_BYTES) {
        Alert.alert(
          t('image_upload_too_large_title'),
          t('image_upload_too_large_message', { maxKb: maxImageKb })
        );
        return;
      }
      setLogoUrl(dataUrl);
      setLogoFileName(file.name);
    } catch {
      Alert.alert(t('event_logo_upload_error_title'), t('event_logo_upload_error_message'));
    }
  };

  const pickLocalSponsorLogo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    if (!file.uri || !file.name) {
      return;
    }

    try {
      const dataUrl = await assetToDataUrl(file);
      if (estimateDataUrlBytes(dataUrl) > MAX_IMAGE_UPLOAD_BYTES) {
        Alert.alert(
          t('image_upload_too_large_title'),
          t('image_upload_too_large_message', { maxKb: maxImageKb })
        );
        return;
      }
      setLocalSponsorLogoUrl(dataUrl);
      setLocalSponsorFileName(file.name);
    } catch {
      Alert.alert(
        t('sponsor_local_logo_upload_error_title'),
        t('sponsor_local_logo_upload_error_message')
      );
    }
  };

  const canCreatePaid = organizerCanUsePaidSection(organizer, ORGANIZER_TEST_MODE);
  const baseFeeValue = parseEuro(baseFeeAmount);
  const providerRate = STRIPE_PROVIDER_FEE_RATE;
  const providerFixed = STRIPE_PROVIDER_FEE_FIXED;
  const commissionPreview = Number.parseFloat((baseFeeValue * COMMISSION_RATE).toFixed(2));
  const providerPreview = Number.parseFloat(
    (baseFeeValue * providerRate + providerFixed).toFixed(2)
  );
  const participantTotalPreview =
    feePolicy === 'participant_pays_fees'
      ? Number.parseFloat((baseFeeValue + commissionPreview + providerPreview).toFixed(2))
      : baseFeeValue;
  const organizerNetPreview =
    feePolicy === 'participant_pays_fees'
      ? baseFeeValue
      : Number.parseFloat(
          Math.max(0, baseFeeValue - commissionPreview - providerPreview).toFixed(2)
        );

  const handlePaidToggle = (nextValue: boolean) => {
    if (!nextValue) {
      setIsFree(true);
      return;
    }

    if (!canCreatePaid) {
      Alert.alert(
        t('payments_blocked_title'),
        t('payments_blocked_unlock_required')
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

    if (!isFree && !cleanText(organizer.fiscalData ?? '')) {
      Alert.alert(t('missing_data_title'), t('fiscal_required_message'));
      return;
    }

    if (!isFree && !canCreatePaid) {
      Alert.alert(t('payments_blocked_title'), t('payments_profile_blocked'));
      return;
    }

    const normalizedRegistrationOpenDate = toIsoDate(registrationOpenDate);
    const normalizedEventDate = toIsoDate(date);
    const normalizedEventEndDate = toIsoDate(endDate);
    const normalizedEventTime = toIsoTime(startTime);
    const normalizedRegistrationCloseDate = toIsoDate(registrationCloseDate);
    const normalizedCashDeadline = cashPaymentEnabled ? toIsoDate(cashPaymentDeadline) : undefined;

    if (normalizedEventEndDate < normalizedEventDate) {
      Alert.alert(t('registration_window_invalid_title'), t('event_date_range_invalid_message'));
      return;
    }

    if (!normalizedEventTime) {
      Alert.alert(t('missing_data_title'), t('event_time_invalid_message'));
      return;
    }

    if (!isFree && cashPaymentEnabled && !cleanText(cashPaymentInstructions)) {
      Alert.alert(t('missing_data_title'), t('cash_payment_instructions_required'));
      return;
    }

    if (!isFree && cashPaymentEnabled && !cleanText(cashPaymentDeadline)) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_required'));
      return;
    }

    if (normalizedCashDeadline && normalizedCashDeadline < normalizedRegistrationOpenDate) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_before_open'));
      return;
    }

    if (normalizedCashDeadline && normalizedCashDeadline > normalizedEventEndDate) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_after_event'));
      return;
    }

    if (normalizedRegistrationCloseDate > normalizedEventEndDate) {
      Alert.alert(t('registration_window_invalid_title'), t('registration_window_after_event_message'));
      return;
    }

    onCreate({
      eventId: initialEvent?.id,
      name,
      location,
      date: normalizedEventDate,
      endDate: normalizedEventEndDate,
      startTime: normalizedEventTime,
      isFree,
      baseFeeAmount: baseFeeValue,
      feePolicy,
      paymentChannel,
      cashPaymentEnabled: !isFree && cashPaymentEnabled,
      cashPaymentInstructions: !isFree && cashPaymentEnabled ? cleanText(cashPaymentInstructions) : '',
      cashPaymentDeadline: !isFree && cashPaymentEnabled ? normalizedCashDeadline : undefined,
      registrationOpenDate: normalizedRegistrationOpenDate,
      registrationCloseDate: normalizedRegistrationCloseDate,
      visibility,
      participantAuthMode: 'anonymous',
      participantPhoneRequired: false,
      privacyText,
      logoUrl,
      localSponsor: localSponsorLogoUrl || localSponsorText,
      assignNumbers,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={initialEvent ? t('edit_event') : t('create_event')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('organizer_label', { email: organizer.email })}</Text>
        <Text style={styles.cardParagraph}>
          {t('verification_status', {
            status: verificationStatusLabel(organizer.verificationStatus, language),
            payout: organizer.payoutEnabled ? t('payout_active') : t('payout_inactive'),
          })}
        </Text>

        {!canCreatePaid ? (
          <Text style={styles.helperText}>{t('paid_unlock_required_message')}</Text>
        ) : null}

        <TextField label={t('event_name_required')} value={name} onChangeText={setName} />
        <TextField label={t('location_required')} value={location} onChangeText={setLocation} />
        <TextField
          label={t('event_start_date_label')}
          value={date}
          onChangeText={setDate}
          placeholder={t('event_date_placeholder')}
        />
        <TextField
          label={t('event_end_date_label')}
          value={endDate}
          onChangeText={setEndDate}
          placeholder={t('event_date_placeholder')}
        />
        <TextField
          label={t('event_time_label')}
          value={startTime}
          onChangeText={setStartTime}
          placeholder={t('event_time_placeholder')}
        />
        <TextField
          label={t('registration_open_date_label')}
          value={registrationOpenDate}
          onChangeText={setRegistrationOpenDate}
          placeholder={t('event_date_placeholder')}
        />
        <TextField
          label={t('registration_close_date_label')}
          value={registrationCloseDate}
          onChangeText={setRegistrationCloseDate}
          placeholder={t('event_date_placeholder')}
        />

        <SwitchRow
          label={t('event_visibility_public')}
          value={visibility === 'public'}
          onValueChange={(next) => setVisibility(next ? 'public' : 'hidden')}
          helper={t('event_visibility_helper')}
        />

        <Text style={styles.helperText}>{t('participant_access_policy_note')}</Text>

        <SwitchRow
          label={t('free_event_switch')}
          value={isFree}
          onValueChange={(value) => handlePaidToggle(value)}
          helper={t('free_event_helper')}
        />

        {!isFree ? (
          <View style={styles.blockSpacing}>
            <TextField
              label={t('base_fee_label')}
              value={baseFeeAmount}
              onChangeText={setBaseFeeAmount}
              keyboardType='decimal-pad'
              placeholder={t('fee_placeholder')}
            />
            <Text style={styles.fieldLabel}>{t('payment_channel_label')}</Text>
            <Text style={styles.helperText}>{t('payment_channel_stripe_only')}</Text>
            <Text style={styles.fieldLabel}>{t('fee_policy_label')}</Text>
            <View style={styles.methodRow}>
              <Pressable
                style={[
                  styles.methodChip,
                  feePolicy === 'organizer_absorbs_fees' ? styles.methodChipActive : undefined,
                ]}
                onPress={() => setFeePolicy('organizer_absorbs_fees')}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    feePolicy === 'organizer_absorbs_fees'
                      ? styles.methodChipTextActive
                      : undefined,
                  ]}
                >
                  {t('fee_policy_absorb')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.methodChip,
                  feePolicy === 'participant_pays_fees'
                    ? styles.methodChipActive
                    : undefined,
                ]}
                onPress={() => setFeePolicy('participant_pays_fees')}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    feePolicy === 'participant_pays_fees'
                      ? styles.methodChipTextActive
                      : undefined,
                  ]}
                >
                  {t('fee_policy_plus')}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              {t('commission_preview', { value: toMoney(commissionPreview) })}
            </Text>
            <Text style={styles.helperText}>
              {t('provider_fee_preview', { value: toMoney(providerPreview) })}
            </Text>
            <Text style={styles.helperText}>
              {t('participant_total_preview', { value: toMoney(participantTotalPreview) })}
            </Text>
            <Text style={styles.helperText}>
              {t('organizer_net_preview', { value: toMoney(organizerNetPreview) })}
            </Text>
            <SwitchRow
              label={t('cash_payment_enabled_label')}
              value={cashPaymentEnabled}
              onValueChange={setCashPaymentEnabled}
              helper={t('cash_payment_enabled_helper')}
            />
            {cashPaymentEnabled ? (
              <>
                <TextField
                  label={t('cash_payment_instructions_label')}
                  value={cashPaymentInstructions}
                  onChangeText={setCashPaymentInstructions}
                  placeholder={t('cash_payment_instructions_placeholder')}
                  multiline
                />
                <TextField
                  label={t('cash_payment_deadline_label')}
                  value={cashPaymentDeadline}
                  onChangeText={setCashPaymentDeadline}
                  placeholder={t('event_date_placeholder')}
                />
              </>
            ) : null}
          </View>
        ) : null}

        <SwitchRow
          label={t('assign_numbers')}
          value={assignNumbers}
          onValueChange={setAssignNumbers}
        />

        <Text style={styles.fieldLabel}>{t('logo_optional')}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void pickEventLogo()}>
          <Text style={styles.secondaryButtonText}>{t('event_logo_pick_button')}</Text>
        </Pressable>
        <Text style={styles.helperText}>{logoFileName || t('document_not_selected')}</Text>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.sponsorLogoPreview} /> : null}

        <TextField
          label={t('sponsor_optional')}
          value={localSponsorText}
          onChangeText={setLocalSponsorText}
          placeholder={t('sponsor_placeholder')}
        />
        <Text style={styles.fieldLabel}>{t('sponsor_local_logo_optional')}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void pickLocalSponsorLogo()}>
          <Text style={styles.secondaryButtonText}>{t('sponsor_local_logo_pick_button')}</Text>
        </Pressable>
        <Text style={styles.helperText}>{localSponsorFileName || t('document_not_selected')}</Text>
        {localSponsorLogoUrl ? (
          <Image source={{ uri: localSponsorLogoUrl }} style={styles.sponsorLogoPreview} />
        ) : null}

        <TextField
          label={t('privacy_module')}
          value={privacyText}
          onChangeText={setPrivacyText}
          multiline
        />

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>
            {initialEvent ? t('save_event_changes') : t('publish_event')}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_dashboard')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
