import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, PaymentInput, RegistrationRecord } from '../types';
import { cleanText, formatDate, toMoney } from '../utils/format';

type Props = {
  event: EventItem;
  registration: RegistrationRecord;
  onBack: () => void;
  onConfirm: (payment: PaymentInput) => Promise<void>;
  onCancel: () => void;
  t: Translator;
};

export function ParticipantPaymentScreen({
  event,
  registration,
  onBack,
  onConfirm,
  onCancel,
  t,
}: Props) {
  const [method, setMethod] = useState(t('method_card'));
  const [payerName, setPayerName] = useState(registration.fullName);
  const [reference, setReference] = useState('');

  const sessionLabel = useMemo(() => {
    if (!registration.paymentSessionExpiresAt) {
      return 'N/D';
    }
    const date = new Date(registration.paymentSessionExpiresAt);
    if (Number.isNaN(date.getTime())) {
      return registration.paymentSessionExpiresAt;
    }
    return `${formatDate(registration.paymentSessionExpiresAt.slice(0, 10))} ${date
      .toTimeString()
      .slice(0, 5)}`;
  }, [registration.paymentSessionExpiresAt]);

  const submit = () => {
    if (!cleanText(payerName)) {
      Alert.alert(t('missing_payer_name_title'), t('missing_payer_name_message'));
      return;
    }

    void onConfirm({
      method,
      payerName,
      reference,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('payment_title')}>
        <Text style={styles.listTitle}>{event.name}</Text>
        <Text style={styles.listSubText}>{t('amount_label', { value: toMoney(event.feeAmount) })}</Text>
        <Text style={styles.listSubText}>
          {t('registration_code_label', { value: registration.registrationCode })}
        </Text>
        <Text style={styles.listSubText}>
          {t('registration_status_label', { value: registration.registrationStatus })}
        </Text>
        <Text style={styles.listSubText}>{t('payment_session_expiry', { value: sessionLabel })}</Text>
        <Text style={styles.helperText}>{t('payment_webhook_helper')}</Text>

        <Text style={styles.fieldLabel}>{t('payment_method')}</Text>
        <View style={styles.methodRow}>
          {[t('method_card'), t('method_bank'), t('method_cash'), t('method_other')].map((entry) => (
            <Pressable
              key={entry}
              style={[styles.methodChip, method === entry ? styles.methodChipActive : undefined]}
              onPress={() => setMethod(entry)}
            >
              <Text
                style={[
                  styles.methodChipText,
                  method === entry ? styles.methodChipTextActive : undefined,
                ]}
              >
                {entry}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField label={t('payer_name')} value={payerName} onChangeText={setPayerName} />
        <TextField
          label={t('payment_reference_optional')}
          value={reference}
          onChangeText={setReference}
          placeholder={t('payment_reference_placeholder')}
        />

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>{t('confirm_payment')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_event_detail')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>{t('cancel_pending_registration')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
