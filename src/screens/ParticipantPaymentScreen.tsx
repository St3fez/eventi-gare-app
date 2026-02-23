import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, PaymentInput, RegistrationRecord } from '../types';
import { cleanText, formatDate, formatEventSchedule, toMoney } from '../utils/format';

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
  const [method, setMethod] = useState<'stripe' | 'cash'>('stripe');
  const [payerName, setPayerName] = useState(registration.fullName);
  const [reference, setReference] = useState('');
  const cashDeadline = event.cashPaymentDeadline
    ? formatDate(event.cashPaymentDeadline)
    : formatDate(event.registrationCloseDate);
  const cashInstructions = cleanText(event.cashPaymentInstructions ?? '');

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

    if (method === 'cash' && !event.cashPaymentEnabled) {
      Alert.alert(t('missing_data_title'), t('cash_payment_not_enabled_message'));
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
      <SectionCard title={t('payment_title')} delayMs={0}>
        <Text style={styles.listTitle}>{event.name}</Text>
        <Text style={styles.listSubText}>{t('date_label', { value: formatEventSchedule(event) })}</Text>
        <Text style={styles.listSubText}>{t('amount_label', { value: toMoney(registration.paymentAmount) })}</Text>
        {registration.groupParticipantsCount > 1 ? (
          <Text style={styles.listSubText}>
            {t('group_participants_line', { count: registration.groupParticipantsCount })}
          </Text>
        ) : null}
        <Text style={styles.listSubText}>
          {t('registration_code_label', { value: registration.registrationCode })}
        </Text>
        <Text style={styles.listSubText}>
          {t('registration_status_label', { value: registration.registrationStatus })}
        </Text>
        <Text style={styles.listSubText}>{t('payment_session_expiry', { value: sessionLabel })}</Text>
        <Text style={styles.helperText}>
          {method === 'stripe' ? t('payment_webhook_helper') : t('cash_payment_flow_helper')}
        </Text>
        <Text style={styles.helperText}>{t('payment_fiscal_compliance_notice')}</Text>

        <Text style={styles.fieldLabel}>{t('payment_method')}</Text>
        <View style={styles.methodRow}>
          {[
            { value: 'stripe' as const, label: t('method_stripe') },
            ...(event.cashPaymentEnabled
              ? [{ value: 'cash' as const, label: t('method_cash') }]
              : []),
          ].map((entry) => (
            <Pressable
              key={entry.value}
              style={[styles.methodChip, method === entry.value ? styles.methodChipActive : undefined]}
              onPress={() => setMethod(entry.value)}
            >
              <Text
                style={[
                  styles.methodChipText,
                  method === entry.value ? styles.methodChipTextActive : undefined,
                ]}
              >
                {entry.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {method === 'cash' && event.cashPaymentEnabled ? (
          <View style={styles.registrationCard}>
            <Text style={styles.listSubText}>
              {t('cash_payment_deadline_line', { value: cashDeadline })}
            </Text>
            <Text style={styles.helperText}>
              {cashInstructions || t('cash_payment_missing_instructions')}
            </Text>
          </View>
        ) : null}

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
