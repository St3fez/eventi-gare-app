import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { OrganizerProfile } from '../types';

type Props = {
  organizers: OrganizerProfile[];
  onBack: () => void;
  onCreate: (payload: { email: string; fiscalData?: string; bankAccount?: string }) => void;
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
  const [fiscalData, setFiscalData] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
          onPress={() => onCreate({ email, fiscalData, bankAccount })}
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
