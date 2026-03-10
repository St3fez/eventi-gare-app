import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import {
  ADMIN_CONTACT_EMAIL,
  COMMISSION_RATE,
  DEFAULT_PRIVACY_TEXT,
  MAX_IMAGE_UPLOAD_BYTES,
  STRIPE_PROVIDER_FEE_FIXED,
  STRIPE_PROVIDER_FEE_RATE,
} from '../constants';
import { SectionCard, StatusBadge, SwitchRow, TextField } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { verificationStatusLabel } from '../services/fraud';
import { styles } from '../styles';
import {
  EventClaimAttachment,
  EventItem,
  EventFeePolicy,
  EventPaymentChannel,
  OrganizerProfile,
  ParticipantAuthMode,
} from '../types';
import { requestHumanConfirmation } from '../utils/confirm';
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
    claimSubmissionMethod?: EventItem['claimSubmissionMethod'];
    claimOfficialEmail?: string;
    claimSocialHandle?: string;
    claimEvidenceFileName?: string;
    claimNote?: string;
    claimAttachment?: EventClaimAttachment | null;
  }) => Promise<void>;
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
  const [participantAuthMode, setParticipantAuthMode] = useState<ParticipantAuthMode>(
    initialEvent?.participantAuthMode ?? 'anonymous'
  );
  const [participantPhoneRequired, setParticipantPhoneRequired] = useState(
    initialEvent?.participantPhoneRequired ?? false
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
  const [claimSubmissionMethod, setClaimSubmissionMethod] = useState<
    EventItem['claimSubmissionMethod']
  >(initialEvent?.claimSubmissionMethod ?? 'official_email');
  const [claimOfficialEmail, setClaimOfficialEmail] = useState(
    initialEvent?.claimOfficialEmail ?? ''
  );
  const [claimSocialHandle, setClaimSocialHandle] = useState(
    initialEvent?.claimSocialHandle ?? ''
  );
  const [claimEvidenceFileName, setClaimEvidenceFileName] = useState(
    initialEvent?.claimEvidenceFileName ?? ''
  );
  const [claimAttachment, setClaimAttachment] = useState<EventClaimAttachment | null>(null);
  const [claimNote, setClaimNote] = useState('');

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
    setParticipantAuthMode(initialEvent?.participantAuthMode ?? 'anonymous');
    setParticipantPhoneRequired(initialEvent?.participantPhoneRequired ?? false);
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
    setClaimSubmissionMethod(initialEvent?.claimSubmissionMethod ?? 'official_email');
    setClaimOfficialEmail(initialEvent?.claimOfficialEmail ?? '');
    setClaimSocialHandle(initialEvent?.claimSocialHandle ?? '');
    setClaimEvidenceFileName(initialEvent?.claimEvidenceFileName ?? '');
    setClaimAttachment(null);
    setClaimNote('');
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

  const pickClaimProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    if (!file.uri || !file.name) {
      return;
    }

    setClaimAttachment({
      kind: 'event_claim_proof',
      uri: file.uri,
      fileName: file.name,
      mimeType: file.mimeType ?? 'application/octet-stream',
    });
    setClaimEvidenceFileName(file.name);
  };

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
  const claimStatus =
    isFree ? 'not_required' : initialEvent?.claimStatus ?? 'pending_review';
  const normalizedEventTime = toIsoTime(startTime);
  const missingRequiredLabels = useMemo(() => {
    const missing: string[] = [];
    if (!cleanText(name)) {
      missing.push(t('event_name_required'));
    }
    if (!cleanText(location)) {
      missing.push(t('location_required'));
    }
    if (!cleanText(date)) {
      missing.push(t('event_start_date_label'));
    }
    if (!cleanText(endDate)) {
      missing.push(t('event_end_date_label'));
    }
    if (!normalizedEventTime) {
      missing.push(t('event_time_label'));
    }
    if (!cleanText(registrationOpenDate)) {
      missing.push(t('registration_open_date_label'));
    }
    if (!cleanText(registrationCloseDate)) {
      missing.push(t('registration_close_date_label'));
    }
    if (!isFree && baseFeeValue <= 0) {
      missing.push(t('base_fee_label'));
    }
    if (!isFree && cashPaymentEnabled && !cleanText(cashPaymentInstructions)) {
      missing.push(t('cash_payment_instructions_label'));
    }
    if (!isFree && cashPaymentEnabled && !cleanText(cashPaymentDeadline)) {
      missing.push(t('cash_payment_deadline_label'));
    }
    if (!isFree && claimStatus !== 'approved') {
      if (!claimSubmissionMethod) {
        missing.push(t('event_claim_method_label'));
      }
      if (
        claimSubmissionMethod === 'official_email' &&
        !cleanText(claimOfficialEmail)
      ) {
        missing.push(t('event_claim_official_email_label'));
      }
      if (
        claimSubmissionMethod === 'social_profile' &&
        !cleanText(claimSocialHandle)
      ) {
        missing.push(t('event_claim_social_label'));
      }
      if (!cleanText(claimEvidenceFileName)) {
        missing.push(t('event_claim_proof_label'));
      }
    }
    return missing;
  }, [
    baseFeeValue,
    cashPaymentDeadline,
    cashPaymentEnabled,
    cashPaymentInstructions,
    claimEvidenceFileName,
    claimOfficialEmail,
    claimSocialHandle,
    claimStatus,
    claimSubmissionMethod,
    date,
    endDate,
    isFree,
    location,
    name,
    normalizedEventTime,
    registrationCloseDate,
    registrationOpenDate,
    t,
  ]);
  const canSubmit = missingRequiredLabels.length === 0;
  const claimStatusLabel =
    claimStatus === 'approved'
      ? t('event_claim_status_approved')
      : claimStatus === 'rejected'
        ? t('event_claim_status_rejected')
        : claimStatus === 'pending_review'
          ? t('event_claim_status_pending')
          : t('event_claim_status_not_required');

  useEffect(() => {
    if (!isFree && claimStatus !== 'approved' && visibility === 'public') {
      setVisibility('hidden');
    }
  }, [claimStatus, isFree, visibility]);

  const handlePaidToggle = (nextValue: boolean) => {
    if (nextValue) {
      setIsFree(true);
      return;
    }

    setIsFree(false);
    setVisibility('hidden');
  };

  const submit = async () => {
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

    if (initialEvent) {
      const confirmed = await requestHumanConfirmation({
        title: t('event_save_changes_confirm_title'),
        message: t('event_save_changes_confirm_message', {
          name: cleanText(name) || initialEvent.name,
        }),
        confirmLabel: t('save_event_changes'),
        cancelLabel: t('close'),
      });
      if (!confirmed) {
        return;
      }
    }

    if (!isFree && claimSubmissionMethod === 'official_email' && !cleanText(claimOfficialEmail)) {
      Alert.alert(t('event_claim_title'), t('event_claim_official_email_required'));
      return;
    }

    if (!isFree && claimSubmissionMethod === 'social_profile' && !cleanText(claimSocialHandle)) {
      Alert.alert(t('event_claim_title'), t('event_claim_social_required'));
      return;
    }

    if (!isFree && !cleanText(claimEvidenceFileName)) {
      Alert.alert(t('event_claim_title'), t('event_claim_proof_required'));
      return;
    }

    await onCreate({
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
      participantAuthMode,
      participantPhoneRequired,
      privacyText,
      logoUrl,
      localSponsor: localSponsorLogoUrl || localSponsorText,
      assignNumbers,
      claimSubmissionMethod: isFree ? undefined : claimSubmissionMethod,
      claimOfficialEmail: isFree ? '' : cleanText(claimOfficialEmail).toLowerCase(),
      claimSocialHandle: isFree ? '' : cleanText(claimSocialHandle),
      claimEvidenceFileName: isFree ? '' : cleanText(claimEvidenceFileName),
      claimNote: isFree ? '' : cleanText(claimNote),
      claimAttachment,
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
        <Text style={styles.helperText}>{t('event_claim_intro_short')}</Text>
        <View style={styles.registrationCard}>
          <Text style={styles.fieldLabel}>{t('guided_event_checklist_title')}</Text>
          <Text style={styles.helperText}>{t('guided_event_checklist_intro')}</Text>
          {missingRequiredLabels.length === 0 ? (
            <Text style={styles.helperText}>{t('guided_event_checklist_ready')}</Text>
          ) : (
            <>
              <Text style={styles.helperText}>
                {t('guided_required_checklist_missing', { count: missingRequiredLabels.length })}
              </Text>
              {missingRequiredLabels.map((label) => (
                <Text key={label} style={styles.listSubText}>
                  - {label}
                </Text>
              ))}
            </>
          )}
        </View>
        <View style={styles.heroPanel}>
          <Text style={styles.heroEyebrow}>
            {initialEvent ? t('event_edit_summary_title') : t('event_create_summary_title')}
          </Text>
          <Text style={styles.emphasisParagraph}>
            {cleanText(name) || t('event_summary_name_placeholder')}
          </Text>
          <View style={styles.statusBadgeRow}>
            <StatusBadge
              label={isFree ? t('free_event_label') : t('participant_search_paid')}
              tone={isFree ? 'success' : 'warning'}
            />
            <StatusBadge
              label={
                visibility === 'public'
                  ? t('event_visibility_public_short')
                  : t('event_visibility_hidden_short')
              }
            />
            <StatusBadge
              label={
                participantPhoneRequired
                  ? t('badge_phone_short_required')
                  : t('badge_phone_short_optional')
              }
            />
            <StatusBadge
              label={
                participantAuthMode === 'email'
                  ? t('participant_auth_mode_email')
                  : participantAuthMode === 'social_verified'
                    ? t('participant_auth_mode_social')
                    : participantAuthMode === 'flexible'
                      ? t('participant_auth_mode_flexible')
                      : t('participant_auth_mode_anonymous')
              }
            />
          </View>
          <Text style={styles.helperText}>{t('guided_event_checklist_intro')}</Text>
        </View>

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
          onValueChange={(next) => {
            if (!isFree && claimStatus !== 'approved' && next) {
              Alert.alert(t('event_claim_title'), t('event_claim_visibility_locked'));
              setVisibility('hidden');
              return;
            }
            setVisibility(next ? 'public' : 'hidden');
          }}
          helper={
            !isFree && claimStatus !== 'approved'
              ? t('event_claim_visibility_helper')
              : t('event_visibility_helper')
          }
        />

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>{t('participant_access_section_title')}</Text>
          <Text style={styles.helperText}>{t('participant_access_policy_note')}</Text>
          <Text style={styles.fieldLabel}>{t('participant_auth_mode_label')}</Text>
          <View style={styles.methodRow}>
            {[
              ['anonymous', t('participant_auth_mode_anonymous')],
              ['email', t('participant_auth_mode_email')],
              ['social_verified', t('participant_auth_mode_social')],
              ['flexible', t('participant_auth_mode_flexible')],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                style={[
                  styles.methodChip,
                  participantAuthMode === value ? styles.methodChipActive : undefined,
                ]}
                onPress={() => setParticipantAuthMode(value as ParticipantAuthMode)}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    participantAuthMode === value ? styles.methodChipTextActive : undefined,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <SwitchRow
            label={t('participant_phone_required_label')}
            value={participantPhoneRequired}
            onValueChange={setParticipantPhoneRequired}
            helper={t('participant_phone_required_helper')}
          />
        </View>

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
            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('event_claim_title')}</Text>
              <Text style={styles.helperText}>
                {t('event_claim_intro', { email: ADMIN_CONTACT_EMAIL })}
              </Text>
              <View style={styles.statusBadgeRow}>
                <StatusBadge
                  label={claimStatusLabel}
                  tone={
                    claimStatus === 'approved'
                      ? 'success'
                      : claimStatus === 'rejected'
                        ? 'warning'
                        : 'neutral'
                  }
                />
                <StatusBadge label={t('event_visibility_hidden_short')} />
              </View>
              {initialEvent?.claimRejectedReason ? (
                <Text style={styles.helperText}>
                  {t('event_claim_rejected_reason_line', {
                    reason: initialEvent.claimRejectedReason,
                  })}
                </Text>
              ) : null}
              <Text style={styles.fieldLabel}>{t('event_claim_method_label')}</Text>
              <View style={styles.methodRow}>
                <Pressable
                  style={[
                    styles.methodChip,
                    claimSubmissionMethod === 'official_email'
                      ? styles.methodChipActive
                      : undefined,
                  ]}
                  onPress={() => setClaimSubmissionMethod('official_email')}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      claimSubmissionMethod === 'official_email'
                        ? styles.methodChipTextActive
                        : undefined,
                    ]}
                  >
                    {t('event_claim_method_official_email')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.methodChip,
                    claimSubmissionMethod === 'social_profile'
                      ? styles.methodChipActive
                      : undefined,
                  ]}
                  onPress={() => setClaimSubmissionMethod('social_profile')}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      claimSubmissionMethod === 'social_profile'
                        ? styles.methodChipTextActive
                        : undefined,
                    ]}
                  >
                    {t('event_claim_method_social')}
                  </Text>
                </Pressable>
              </View>
              {claimSubmissionMethod === 'official_email' ? (
                <TextField
                  label={t('event_claim_official_email_label')}
                  value={claimOfficialEmail}
                  onChangeText={setClaimOfficialEmail}
                  keyboardType='email-address'
                  placeholder={t('event_claim_official_email_placeholder')}
                />
              ) : (
                <TextField
                  label={t('event_claim_social_label')}
                  value={claimSocialHandle}
                  onChangeText={setClaimSocialHandle}
                  placeholder={t('event_claim_social_placeholder')}
                />
              )}
              <Text style={styles.fieldLabel}>{t('event_claim_proof_label')}</Text>
              <Text style={styles.helperText}>
                {claimEvidenceFileName || t('document_not_selected')}
              </Text>
              <Pressable style={styles.secondaryButton} onPress={() => void pickClaimProof()}>
                <Text style={styles.secondaryButtonText}>{t('event_claim_proof_pick_button')}</Text>
              </Pressable>
              {claimAttachment ? (
                <Text style={styles.helperText}>{claimAttachment.fileName}</Text>
              ) : null}
              <TextField
                label={t('event_claim_note_label')}
                value={claimNote}
                onChangeText={setClaimNote}
                placeholder={t('event_claim_note_placeholder')}
                multiline
              />
            </View>
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

        <Pressable
          style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : undefined]}
          onPress={() => {
            void submit();
          }}
          disabled={!canSubmit}
        >
          <Text style={styles.primaryButtonText}>
            {initialEvent
              ? t('save_event_changes')
              : isFree
                ? t('publish_event')
                : t('save_paid_event_draft')}
          </Text>
        </Pressable>
        {!canSubmit ? (
          <Text style={styles.helperText}>{t('guided_complete_required_fields_hint')}</Text>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_dashboard')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
