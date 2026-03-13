import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { OrganizerProfile, OrganizerRole } from '../types';
import { cleanText } from '../utils/format';

type Props = {
  organizers: OrganizerProfile[];
  suggestedEmail?: string;
  onBack: () => void;
  onSignOut?: () => void;
  showSignOut?: boolean;
  onCreate: (payload: {
    email: string;
    fiscalData?: string;
    bankAccount?: string;
    organizationName?: string;
    organizationRole: OrganizerRole;
    organizationRoleLabel?: string;
    legalRepresentative?: string;
    officialPhone?: string;
  }) => void;
  onUseExisting: (organizerId: string) => void;
  t: Translator;
};

export function OrganizerProfileScreen({
  organizers,
  suggestedEmail,
  onBack,
  onSignOut,
  showSignOut = false,
  onCreate,
  onUseExisting,
  t,
}: Props) {
  const normalizedSuggestedEmail = cleanText(suggestedEmail ?? '').toLowerCase();
  const previousSuggestedEmailRef = useRef(normalizedSuggestedEmail);
  const [email, setEmail] = useState(normalizedSuggestedEmail);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationRole, setOrganizationRole] = useState<OrganizerRole>('presidente_fondazione');
  const [organizationRoleLabel, setOrganizationRoleLabel] = useState('');
  const [legalRepresentative, setLegalRepresentative] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [fiscalData, setFiscalData] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const normalizedEmail = cleanText(email).toLowerCase();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const missingRequiredLabels = useMemo(() => {
    const missing: string[] = [];
    if (!emailIsValid) {
      missing.push(t('email_required'));
    }
    return missing;
  }, [emailIsValid, t]);
  const canSubmit = missingRequiredLabels.length === 0;

  useEffect(() => {
    setEmail((current) => {
      const normalizedCurrent = cleanText(current).toLowerCase();
      const previousSuggested = previousSuggestedEmailRef.current;
      previousSuggestedEmailRef.current = normalizedSuggestedEmail;

      if (!normalizedSuggestedEmail) {
        return current;
      }

      if (!normalizedCurrent || normalizedCurrent === previousSuggested) {
        return normalizedSuggestedEmail;
      }

      return current;
    });
  }, [normalizedSuggestedEmail]);

  const submit = () => {
    if (!canSubmit) {
      Alert.alert(t('invalid_email_title'), t('invalid_email_message'));
      return;
    }

    onCreate({
      email: normalizedEmail,
      fiscalData,
      bankAccount,
      organizationName,
      organizationRole,
      organizationRoleLabel,
      legalRepresentative,
      officialPhone,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('organizer_access')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('organizer_access_intro')}</Text>
        {normalizedSuggestedEmail ? (
          <View style={[styles.noticeCard, styles.noticeCardInfo]}>
            <Text style={styles.noticeTitle}>{t('organizer_profile_prefill_title')}</Text>
            <Text style={styles.noticeText}>
              {t('organizer_profile_prefill_message', { email: normalizedSuggestedEmail })}
            </Text>
          </View>
        ) : null}
        <View style={styles.registrationCard}>
          <Text style={styles.fieldLabel}>{t('guided_organizer_checklist_title')}</Text>
          <Text style={styles.helperText}>{t('guided_organizer_checklist_intro')}</Text>
          {canSubmit ? (
            <Text style={styles.helperText}>{t('guided_organizer_checklist_ready')}</Text>
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

        {organizers.length > 0 ? (
          <View style={styles.blockSpacing}>
            <Text style={styles.fieldLabel}>{t('existing_organizers')}</Text>
            {organizers.map((organizer) => (
              <Pressable
                key={organizer.id}
                style={styles.listCard}
                onPress={() => onUseExisting(organizer.id)}
              >
                <Text style={styles.listTitle}>{organizer.email}</Text>
                <Text style={styles.listSubText}>
                  {organizer.bankAccount
                    ? t('iban_prefix', { iban: organizer.bankAccount })
                    : t('iban_missing')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
        <TextField
          label={t('organization_name_label')}
          value={organizationName}
          onChangeText={setOrganizationName}
          autoComplete='organization'
          textContentType='organizationName'
          returnKeyType='next'
        />
        <Text style={styles.fieldLabel}>{t('organization_role_label')}</Text>
        <View style={styles.methodRow}>
          <Pressable
            style={[
              styles.methodChip,
              organizationRole === 'presidente_fondazione' ? styles.methodChipActive : undefined,
            ]}
            onPress={() => setOrganizationRole('presidente_fondazione')}
          >
            <Text
              style={[
                styles.methodChipText,
                organizationRole === 'presidente_fondazione'
                  ? styles.methodChipTextActive
                  : undefined,
              ]}
            >
              {t('organization_role_president')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.methodChip,
              organizationRole === 'segretario_associazione'
                ? styles.methodChipActive
                : undefined,
            ]}
            onPress={() => setOrganizationRole('segretario_associazione')}
          >
            <Text
              style={[
                styles.methodChipText,
                organizationRole === 'segretario_associazione'
                  ? styles.methodChipTextActive
                  : undefined,
              ]}
            >
              {t('organization_role_secretary')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.methodChip, organizationRole === 'altro' ? styles.methodChipActive : undefined]}
            onPress={() => setOrganizationRole('altro')}
          >
            <Text
              style={[
                styles.methodChipText,
                organizationRole === 'altro' ? styles.methodChipTextActive : undefined,
              ]}
            >
              {t('organization_role_other')}
            </Text>
          </Pressable>
        </View>
        {organizationRole === 'altro' ? (
          <TextField
            label={t('organization_role_other_label')}
            value={organizationRoleLabel}
            onChangeText={setOrganizationRoleLabel}
          />
        ) : null}
        <TextField
          label={t('legal_representative_label')}
          value={legalRepresentative}
          onChangeText={setLegalRepresentative}
        />
        <TextField
          label={t('official_phone_label')}
          value={officialPhone}
          onChangeText={setOfficialPhone}
          keyboardType='phone-pad'
          autoCapitalize='none'
          autoCorrect={false}
          autoComplete='tel'
          textContentType='telephoneNumber'
          inputMode='tel'
        />
        <TextField
          label={t('fiscal_optional')}
          value={fiscalData}
          onChangeText={setFiscalData}
          placeholder={t('fiscal_placeholder')}
        />
        <TextField
          label={t('bank_label')}
          value={bankAccount}
          onChangeText={setBankAccount}
          placeholder={t('bank_placeholder')}
        />

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>{t('save_organizer')}</Text>
        </Pressable>
        {!canSubmit ? (
          <Text style={styles.helperText}>{t('guided_complete_required_fields_hint')}</Text>
        ) : null}
        {showSignOut && onSignOut ? (
          <Pressable style={styles.secondaryButton} onPress={onSignOut}>
            <Text style={styles.secondaryButtonText}>{t('organizer_security_signout')}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
