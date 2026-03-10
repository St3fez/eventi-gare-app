import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { CheckboxRow, SectionCard, StatusBadge, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, RegistrationDraft } from '../types';
import { requestHumanConfirmation } from '../utils/confirm';
import {
  getParticipantMessageValidationIssues,
  getRegistrationMissingFields,
  getRegistrationProgressSummary,
  getRegistrationTotalAmount,
  getRegistrationValidationIssues,
  normalizeBirthDateForStorage,
  parseGroupParticipantsCount,
} from '../utils/participantUx';
import { cleanText, formatDate, formatEventSchedule, toMoney } from '../utils/format';

type Props = {
  event: EventItem;
  initialDraft?: RegistrationDraft;
  isEditing?: boolean;
  onBack: () => void;
  onCompleteFree: (draft: RegistrationDraft) => Promise<void>;
  onProceedPayment: (draft: RegistrationDraft) => Promise<void>;
  onCancelRegistration?: () => Promise<void>;
  onSendMessageToOrganizer?: (draft: RegistrationDraft) => Promise<void>;
  t: Translator;
};

export function ParticipantRegistrationScreen({
  event,
  initialDraft,
  isEditing = false,
  onBack,
  onCompleteFree,
  onProceedPayment,
  onCancelRegistration,
  onSendMessageToOrganizer,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1080;
  const isCompactLayout = width < 620;
  const [fullName, setFullName] = useState(initialDraft?.fullName ?? '');
  const [email, setEmail] = useState(initialDraft?.email ?? '');
  const [phone, setPhone] = useState(initialDraft?.phone ?? '');
  const [city, setCity] = useState(initialDraft?.city ?? '');
  const [birthDate, setBirthDate] = useState(initialDraft?.birthDate ?? '');
  const [groupParticipantsCount, setGroupParticipantsCount] = useState(
    String(Math.max(1, initialDraft?.groupParticipantsCount ?? 1))
  );
  const [participantMessage, setParticipantMessage] = useState(
    initialDraft?.participantMessage ?? ''
  );
  const [groupParticipants, setGroupParticipants] = useState<string[]>(
    initialDraft?.groupParticipants?.length
      ? initialDraft.groupParticipants
      : [initialDraft?.fullName ?? '']
  );
  const [privacyConsent, setPrivacyConsent] = useState(initialDraft?.privacyConsent ?? false);
  const [retentionConsent, setRetentionConsent] = useState(initialDraft?.retentionConsent ?? false);

  const parsedGroupCount = useMemo(
    () => parseGroupParticipantsCount(groupParticipantsCount),
    [groupParticipantsCount]
  );

  const participantAuthModeLabel = useMemo(() => {
    if (event.participantAuthMode === 'email') {
      return t('participant_auth_mode_email');
    }
    if (event.participantAuthMode === 'social_verified') {
      return t('participant_auth_mode_social');
    }
    if (event.participantAuthMode === 'flexible') {
      return t('participant_auth_mode_flexible');
    }
    return t('participant_auth_mode_anonymous');
  }, [event.participantAuthMode, t]);

  useEffect(() => {
    if (initialDraft) {
      setFullName(initialDraft.fullName ?? '');
      setEmail(initialDraft.email ?? '');
      setPhone(initialDraft.phone ?? '');
      setCity(initialDraft.city ?? '');
      setBirthDate(initialDraft.birthDate ?? '');
      setGroupParticipantsCount(String(Math.max(1, initialDraft.groupParticipantsCount ?? 1)));
      setParticipantMessage(initialDraft.participantMessage ?? '');
      setGroupParticipants(
        initialDraft.groupParticipants?.length
          ? initialDraft.groupParticipants
          : [initialDraft.fullName ?? '']
      );
      setPrivacyConsent(initialDraft.privacyConsent ?? false);
      setRetentionConsent(initialDraft.retentionConsent ?? false);
      return;
    }
    setFullName('');
    setEmail('');
    setPhone('');
    setCity('');
    setBirthDate('');
    setGroupParticipantsCount('1');
    setParticipantMessage('');
    setGroupParticipants(['']);
    setPrivacyConsent(false);
    setRetentionConsent(false);
  }, [event.id, initialDraft]);

  useEffect(() => {
    setGroupParticipants((current) => {
      const next = [...current];
      while (next.length < parsedGroupCount) {
        next.push('');
      }
      if (next.length > parsedGroupCount) {
        next.length = parsedGroupCount;
      }
      next[0] = fullName;
      const isSameLength = next.length === current.length;
      const isSameValues =
        isSameLength && next.every((value, index) => value === current[index]);
      return isSameValues ? current : next;
    });
  }, [fullName, parsedGroupCount]);

  const missingRequiredFields = useMemo(
    () =>
      getRegistrationMissingFields({
        fullName,
        email,
        phone,
        birthDate,
        requiresPhone: event.participantPhoneRequired,
        groupParticipantsCountInput: groupParticipantsCount,
        groupParticipants,
        privacyConsent,
        retentionConsent,
      }),
    [
      email,
      event.participantPhoneRequired,
      fullName,
      birthDate,
      groupParticipants,
      groupParticipantsCount,
      phone,
      privacyConsent,
      retentionConsent,
    ]
  );

  const missingRequiredLabels = useMemo(() => {
    return missingRequiredFields.map((field) => {
      switch (field) {
        case 'fullName':
          return t('full_name_required');
        case 'email':
          return t('email_required');
        case 'phone':
          return event.participantPhoneRequired ? t('phone_required_label') : t('phone_label');
        case 'groupParticipants':
          return t('group_participants_names_label');
        case 'privacyConsent':
          return t('consent_privacy');
        case 'retentionConsent':
          return t('consent_retention');
        default:
          return field;
      }
    });
  }, [event.participantPhoneRequired, missingRequiredFields, t]);
  const validationIssues = useMemo(
    () =>
      getRegistrationValidationIssues({
        fullName,
        email,
        phone,
        birthDate,
        requiresPhone: event.participantPhoneRequired,
        groupParticipantsCountInput: groupParticipantsCount,
        groupParticipants,
        privacyConsent,
        retentionConsent,
      }),
    [
      birthDate,
      email,
      event.participantPhoneRequired,
      fullName,
      groupParticipants,
      groupParticipantsCount,
      phone,
      privacyConsent,
      retentionConsent,
    ]
  );
  const validationLabels = useMemo(() => {
    return validationIssues.map((issue) => {
      switch (issue) {
        case 'emailFormat':
          return t('registration_email_invalid_label');
        case 'birthDate':
          return t('birthdate_invalid_message');
        default:
          return missingRequiredLabels.find((label, index) => missingRequiredFields[index] === issue) ?? issue;
      }
    });
  }, [missingRequiredFields, missingRequiredLabels, t, validationIssues]);

  const totalAmount = useMemo(
    () => getRegistrationTotalAmount(event.feeAmount, groupParticipantsCount),
    [event.feeAmount, groupParticipantsCount]
  );
  const progressSummary = useMemo(
    () =>
      getRegistrationProgressSummary({
        fullName,
        email,
        phone,
        birthDate,
        requiresPhone: event.participantPhoneRequired,
        groupParticipantsCountInput: groupParticipantsCount,
        groupParticipants,
        privacyConsent,
        retentionConsent,
      }),
    [
      email,
      event.participantPhoneRequired,
      fullName,
      birthDate,
      groupParticipants,
      groupParticipantsCount,
      phone,
      privacyConsent,
      retentionConsent,
    ]
  );
  const messageValidationIssues = useMemo(
    () =>
      getParticipantMessageValidationIssues({
        fullName,
        email,
        participantMessage,
      }),
    [email, fullName, participantMessage]
  );

  const canSubmit = validationIssues.length === 0;
  const canSendMessage = messageValidationIssues.length === 0;
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const summaryBadgeLabel = canSubmit
    ? t('registration_ready_badge')
    : t('registration_missing_badge', { count: validationLabels.length });
  const summaryBadgeTone = canSubmit ? 'success' : 'warning';
  const phoneFieldLabel = event.participantPhoneRequired
    ? t('phone_required_label')
    : t('phone_label');
  const phoneRequirementHint = event.participantPhoneRequired
    ? t('registration_phone_requirement_required')
    : t('registration_phone_requirement_optional');
  const emailLooksValid = !cleanText(email) || !validationIssues.includes('emailFormat');
  const birthDateLooksValid = !cleanText(birthDate) || !validationIssues.includes('birthDate');
  const primaryActionLabel = isEditing
    ? t('update_registration_data')
    : event.isFree
      ? t('confirm_free_registration')
      : t('open_payment_session');

  const showValidationAlert = (
    issue:
      | (typeof validationIssues)[number]
      | (typeof messageValidationIssues)[number]
  ) => {
    switch (issue) {
      case 'emailFormat':
        showAlert(t('invalid_email_title'), t('invalid_email_message'));
        return;
      case 'birthDate':
        showAlert(t('birthdate_invalid_title'), t('birthdate_invalid_message'));
        return;
      case 'phone':
        showAlert(t('missing_data_title'), t('participant_phone_required_message'));
        return;
      case 'groupParticipants':
        showAlert(t('missing_data_title'), t('group_participants_names_required'));
        return;
      case 'participantMessage':
        showAlert(t('missing_data_title'), t('participant_message_missing_message'));
        return;
      default:
        showAlert(t('missing_data_title'), t('guided_complete_required_fields_hint'));
    }
  };

  const buildDraft = (): RegistrationDraft | null => {
    if (validationIssues.length > 0) {
      showValidationAlert(validationIssues[0]);
      return null;
    }

    const parsedGroupCountInput = Number.parseInt(groupParticipantsCount, 10);
    if (!Number.isFinite(parsedGroupCountInput) || parsedGroupCountInput <= 0) {
      showAlert(t('missing_data_title'), t('group_participants_invalid'));
      return null;
    }

    const normalizedGroupParticipants = groupParticipants
      .slice(0, parsedGroupCountInput)
      .map((value) => cleanText(value));
    normalizedGroupParticipants[0] = cleanText(fullName);
    while (normalizedGroupParticipants.length < parsedGroupCountInput) {
      normalizedGroupParticipants.push('');
    }

    if (
      parsedGroupCountInput > 1 &&
      normalizedGroupParticipants.slice(1).some((value) => !cleanText(value))
    ) {
      showValidationAlert('groupParticipants');
      return null;
    }

    return {
      fullName,
      email,
      phone,
      city,
      birthDate: normalizeBirthDateForStorage(birthDate),
      groupParticipantsCount: parsedGroupCountInput,
      participantMessage,
      groupParticipants: normalizedGroupParticipants,
      privacyConsent,
      retentionConsent,
    };
  };

  const submit = async () => {
    const draft = buildDraft();
    if (!draft) {
      return;
    }

    if (isEditing) {
      const confirmed = await requestHumanConfirmation({
        title: t('registration_update_confirm_title'),
        message: t('registration_update_confirm_message', {
          event: event.name,
          participants: parsedGroupCount,
          total: event.isFree ? t('registration_total_free_value') : toMoney(totalAmount),
        }),
        confirmLabel: t('confirm_action'),
        cancelLabel: t('close'),
      });
      if (!confirmed) {
        return;
      }
    }

    if (event.isFree) {
      void onCompleteFree(draft);
      return;
    }

    void onProceedPayment(draft);
  };

  const cancelRegistrationWithConfirmation = async () => {
    if (!onCancelRegistration) {
      return;
    }

    const confirmed = await requestHumanConfirmation({
      title: t('registration_cancel_confirm_title'),
      message: t('registration_cancel_confirm_message', {
        event: event.name,
      }),
      confirmLabel: t('cancel_registration_action'),
      cancelLabel: t('close'),
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    await onCancelRegistration();
  };

  const sendMessageToOrganizer = () => {
    if (!onSendMessageToOrganizer) {
      return;
    }
    if (messageValidationIssues.length > 0) {
      showValidationAlert(messageValidationIssues[0]);
      return;
    }
    const parsedGroupCountInput = parseGroupParticipantsCount(groupParticipantsCount);
    const normalizedGroupParticipants = groupParticipants
      .slice(0, parsedGroupCountInput)
      .map((value) => cleanText(value));
    while (normalizedGroupParticipants.length < parsedGroupCountInput) {
      normalizedGroupParticipants.push('');
    }
    normalizedGroupParticipants[0] = cleanText(fullName);

    void onSendMessageToOrganizer({
      fullName,
      email,
      phone,
      city,
      birthDate: normalizeBirthDateForStorage(birthDate),
      groupParticipantsCount: parsedGroupCountInput,
      participantMessage,
      groupParticipants: normalizedGroupParticipants,
      privacyConsent,
      retentionConsent,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode='on-drag'
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
          <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
            <SectionCard title={t('event_detail')} delayMs={0}>
              <Text style={styles.listTitle}>{event.name}</Text>
              <View style={styles.statusBadgeRow}>
                <StatusBadge
                  label={
                    event.isFree
                      ? t('free_event_label')
                      : t('entry_fee_label', { fee: toMoney(event.feeAmount) })
                  }
                  tone={event.isFree ? 'success' : 'warning'}
                />
                <StatusBadge label={participantAuthModeLabel} />
                <StatusBadge
                  label={
                    event.participantPhoneRequired
                      ? t('badge_phone_short_required')
                      : t('badge_phone_short_optional')
                  }
                />
              </View>
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
              {!event.isFree ? (
                <Text style={styles.helperText}>{t('paid_pending_helper')}</Text>
              ) : null}
              <Text style={styles.helperText}>{event.privacyText}</Text>
              <View style={styles.flowCard}>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>1</Text>
                  <Text style={styles.flowStepText}>{t('registration_step_personal_hint')}</Text>
                </View>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>2</Text>
                  <Text style={styles.flowStepText}>{t('registration_step_group_hint')}</Text>
                </View>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>3</Text>
                  <Text style={styles.flowStepText}>{t('registration_step_consents_hint')}</Text>
                </View>
              </View>
            </SectionCard>
          </View>

          <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
            <SectionCard title={t('participant_data')} delayMs={120}>
              <View style={styles.sectionStack}>
                <View style={styles.heroPanel}>
                  <Text style={styles.heroEyebrow}>{t('registration_summary_title')}</Text>
                  <Text style={styles.emphasisParagraph}>{event.name}</Text>
                  <View style={styles.miniMetricsGrid}>
                    <View
                      style={[
                        styles.miniMetricCard,
                        isCompactLayout ? styles.miniMetricCardCompact : undefined,
                      ]}
                    >
                      <Text style={styles.miniMetricValue}>
                        {progressSummary.completedSteps}/{progressSummary.totalSteps}
                      </Text>
                      <Text style={styles.miniMetricLabel}>{t('registration_progress_label')}</Text>
                    </View>
                    <View
                      style={[
                        styles.miniMetricCard,
                        isCompactLayout ? styles.miniMetricCardCompact : undefined,
                      ]}
                    >
                      <Text style={styles.miniMetricValue}>{parsedGroupCount}</Text>
                      <Text style={styles.miniMetricLabel}>
                        {t('registration_participants_metric')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.miniMetricCard,
                        isCompactLayout ? styles.miniMetricCardCompact : undefined,
                      ]}
                    >
                      <Text style={styles.miniMetricValue}>
                        {event.isFree ? t('registration_total_free_value') : toMoney(totalAmount)}
                      </Text>
                      <Text style={styles.miniMetricLabel}>{t('registration_total_metric')}</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadgeRow}>
                    <StatusBadge label={t('registration_step_personal')} tone={progressSummary.personalComplete ? 'success' : 'warning'} />
                    <StatusBadge label={t('registration_step_group')} tone={progressSummary.groupComplete ? 'success' : 'warning'} />
                    <StatusBadge label={t('registration_step_consents')} tone={progressSummary.consentComplete ? 'success' : 'warning'} />
                    <StatusBadge label={summaryBadgeLabel} tone={summaryBadgeTone} />
                  </View>
                  <Text style={styles.helperText}>{t('registration_summary_hint')}</Text>
                  <Text style={styles.helperText}>
                    {event.isFree
                      ? t('registration_free_flow_hint')
                      : t('registration_paid_flow_hint')}
                  </Text>
                  {!event.isFree ? (
                    <Text style={styles.helperText}>
                      {t('group_total_amount_line', { value: toMoney(totalAmount) })}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.formSectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderTitle}>{t('registration_step_personal')}</Text>
                    <StatusBadge label={participantAuthModeLabel} />
                  </View>
                  <Text style={styles.helperText}>
                    {t('participant_auth_required_line', { mode: participantAuthModeLabel })}
                  </Text>
                  <Text style={styles.helperText}>{phoneRequirementHint}</Text>
                  <Text style={styles.helperText}>{t('registration_email_usage_hint')}</Text>
                  <TextField
                    label={t('full_name_required')}
                    value={fullName}
                    onChangeText={setFullName}
                    autoFocus
                    autoComplete='name'
                    textContentType='name'
                    returnKeyType='next'
                  />
                  <TextField
                    label={t('email_required')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType='email-address'
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoComplete='email'
                    textContentType='emailAddress'
                    inputMode='email'
                    returnKeyType='next'
                  />
                  {!emailLooksValid ? (
                    <Text style={styles.noticeText}>{t('invalid_email_message')}</Text>
                  ) : null}
                  <TextField
                    label={phoneFieldLabel}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType='phone-pad'
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoComplete='tel'
                    textContentType='telephoneNumber'
                    inputMode='tel'
                    returnKeyType='next'
                  />
                  <TextField
                    label={t('city_label')}
                    value={city}
                    onChangeText={setCity}
                    autoComplete='postal-address-locality'
                    textContentType='addressCity'
                    returnKeyType='next'
                  />
                  <TextField
                    label={t('birthdate_optional')}
                    value={birthDate}
                    onChangeText={setBirthDate}
                    placeholder={t('birthdate_placeholder')}
                    autoCapitalize='none'
                    autoCorrect={false}
                    inputMode='numeric'
                    returnKeyType='done'
                  />
                  <Text style={styles.helperText}>{t('birthdate_helper')}</Text>
                  {!birthDateLooksValid ? (
                    <Text style={styles.noticeText}>{t('birthdate_invalid_message')}</Text>
                  ) : null}
                </View>

                <View style={styles.formSectionCard}>
                  <Text style={styles.sectionHeaderTitle}>{t('registration_step_group')}</Text>
                  <Text style={styles.helperText}>{t('registration_group_hint')}</Text>
                  <TextField
                    label={t('group_participants_count_label')}
                    value={groupParticipantsCount}
                    onChangeText={setGroupParticipantsCount}
                    keyboardType='number-pad'
                    autoCapitalize='none'
                    autoCorrect={false}
                    inputMode='numeric'
                    maxLength={3}
                  />
                  <Text style={styles.helperText}>{t('group_participants_count_helper')}</Text>
                  {parsedGroupCount > 1 ? (
                    <>
                      <Text style={styles.fieldLabel}>{t('group_participants_names_label')}</Text>
                      {Array.from({ length: parsedGroupCount - 1 }).map((_, index) => {
                        const participantIndex = index + 2;
                        const currentValue = groupParticipants[participantIndex - 1] ?? '';
                        return (
                          <TextField
                            key={`group_participant_${participantIndex}`}
                            label={t('group_participant_name_label', { index: participantIndex })}
                            value={currentValue}
                            onChangeText={(value) => {
                              setGroupParticipants((current) => {
                                const next = [...current];
                                while (next.length < parsedGroupCount) {
                                  next.push('');
                                }
                                next[participantIndex - 1] = value;
                                return next;
                              });
                            }}
                          />
                        );
                      })}
                      <Text style={styles.helperText}>{t('group_participants_names_helper')}</Text>
                    </>
                  ) : null}
                  <TextField
                    label={t('participant_message_to_organizer_label')}
                    value={participantMessage}
                    onChangeText={setParticipantMessage}
                    placeholder={t('participant_message_to_organizer_placeholder')}
                    multiline
                    returnKeyType='default'
                  />
                  {!event.isFree ? (
                    <Text style={styles.helperText}>
                      {t('group_total_amount_line', { value: toMoney(totalAmount) })}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.formSectionCard}>
                  <Text style={styles.sectionHeaderTitle}>{t('registration_step_consents')}</Text>
                  <View style={styles.registrationCard}>
                    <Text style={styles.fieldLabel}>{t('guided_required_checklist_title')}</Text>
                    <Text style={styles.helperText}>{t('guided_required_checklist_intro')}</Text>
                    {validationLabels.length === 0 ? (
                      <Text style={styles.helperText}>{t('guided_required_checklist_ready')}</Text>
                    ) : (
                      <>
                        <Text style={styles.helperText}>
                          {t('guided_required_checklist_missing', {
                            count: validationLabels.length,
                          })}
                        </Text>
                        {validationLabels.map((label) => (
                          <Text key={label} style={styles.listSubText}>
                            - {label}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>

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

                  <Pressable
                    style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : undefined]}
                    onPress={() => {
                      void submit();
                    }}
                    disabled={!canSubmit}
                  >
                    <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
                  </Pressable>
                  {!canSubmit ? (
                    <Text style={styles.helperText}>
                      {t('guided_complete_required_fields_hint')}
                    </Text>
                  ) : null}
                  {onSendMessageToOrganizer ? (
                    <Pressable
                      style={[
                        styles.secondaryButton,
                        !canSendMessage ? styles.primaryButtonDisabled : undefined,
                      ]}
                      onPress={sendMessageToOrganizer}
                      disabled={!canSendMessage}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {t('participant_message_send_button')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {onSendMessageToOrganizer && !canSendMessage ? (
                    <Text style={styles.helperText}>
                      {t('participant_message_requirements_hint')}
                    </Text>
                  ) : null}
                  {isEditing && onCancelRegistration ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        void cancelRegistrationWithConfirmation();
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {t('cancel_registration_action')}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.secondaryButton} onPress={onBack}>
                    <Text style={styles.secondaryButtonText}>{t('back_search')}</Text>
                  </Pressable>
                </View>
              </View>
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
