import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { CheckboxRow, SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, RegistrationDraft } from '../types';
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

  const parsedGroupCount = useMemo(() => {
    const parsed = Number.parseInt(groupParticipantsCount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return parsed;
  }, [groupParticipantsCount]);

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

  const buildDraft = (): RegistrationDraft | null => {
    if (!cleanText(fullName) || !cleanText(email)) {
      Alert.alert(t('missing_data_title'), t('missing_registration_data_message'));
      return null;
    }

    const parsedGroupCountInput = Number.parseInt(groupParticipantsCount, 10);
    if (!Number.isFinite(parsedGroupCountInput) || parsedGroupCountInput <= 0) {
      Alert.alert(t('missing_data_title'), t('group_participants_invalid'));
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
      Alert.alert(t('missing_data_title'), t('group_participants_names_required'));
      return null;
    }

    return {
      fullName,
      email,
      phone,
      city,
      birthDate,
      groupParticipantsCount: parsedGroupCountInput,
      participantMessage,
      groupParticipants: normalizedGroupParticipants,
      privacyConsent,
      retentionConsent,
    };
  };

  const submit = () => {
    const draft = buildDraft();
    if (!draft) {
      return;
    }

    if (event.isFree) {
      void onCompleteFree(draft);
      return;
    }

    void onProceedPayment(draft);
  };

  const sendMessageToOrganizer = () => {
    if (!onSendMessageToOrganizer) {
      return;
    }
    if (!cleanText(participantMessage)) {
      Alert.alert(t('missing_data_title'), t('participant_message_missing_message'));
      return;
    }
    const draft = buildDraft();
    if (!draft) {
      return;
    }
    void onSendMessageToOrganizer(draft);
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
              {t('participant_auth_required_line', { mode: participantAuthModeLabel })}
            </Text>
            <Text style={styles.listSubText}>
              {event.participantPhoneRequired
                ? t('participant_phone_required_enabled')
                : t('participant_phone_required_disabled')}
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
              label={t('birthdate_optional')}
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder={t('birthdate_placeholder')}
            />
            <TextField
              label={t('participant_message_to_organizer_label')}
              value={participantMessage}
              onChangeText={setParticipantMessage}
              placeholder={t('participant_message_to_organizer_placeholder')}
              multiline
            />
            {!event.isFree ? (
              <Text style={styles.helperText}>
                {t('group_total_amount_line', {
                  value: toMoney(
                    event.feeAmount *
                      Math.max(
                        1,
                        Number.isFinite(Number.parseInt(groupParticipantsCount, 10))
                          ? Number.parseInt(groupParticipantsCount, 10)
                          : 1
                      )
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
                {isEditing
                  ? t('update_registration_data')
                  : event.isFree
                    ? t('confirm_free_registration')
                    : t('open_payment_session')}
              </Text>
            </Pressable>
            {onSendMessageToOrganizer ? (
              <Pressable style={styles.secondaryButton} onPress={sendMessageToOrganizer}>
                <Text style={styles.secondaryButtonText}>{t('participant_message_send_button')}</Text>
              </Pressable>
            ) : null}
            {isEditing && onCancelRegistration ? (
              <Pressable style={styles.secondaryButton} onPress={() => void onCancelRegistration()}>
                <Text style={styles.secondaryButtonText}>{t('cancel_registration_action')}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_search')}</Text>
            </Pressable>
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
