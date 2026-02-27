import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { OrganizerProfile, OrganizerRole } from '../types';

type Props = {
  organizers: OrganizerProfile[];
  onBack: () => void;
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
  onBack,
  onCreate,
  onUseExisting,
  t,
}: Props) {
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationRole, setOrganizationRole] = useState<OrganizerRole>('presidente_fondazione');
  const [organizationRoleLabel, setOrganizationRoleLabel] = useState('');
  const [legalRepresentative, setLegalRepresentative] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [fiscalData, setFiscalData] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
      <SectionCard title={t('organizer_access')} delayMs={0}>
        <Text style={styles.cardParagraph}>{t('organizer_access_intro')}</Text>

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

        <TextField label={t('email_required')} value={email} onChangeText={setEmail} keyboardType='email-address' />
        <TextField
          label={t('organization_name_label')}
          value={organizationName}
          onChangeText={setOrganizationName}
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

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            onCreate({
              email,
              fiscalData,
              bankAccount,
              organizationName,
              organizationRole,
              organizationRoleLabel,
              legalRepresentative,
              officialPhone,
            })
          }
        >
          <Text style={styles.primaryButtonText}>{t('save_organizer')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
