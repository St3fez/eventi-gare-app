import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { MetricChip, SectionCard, StatusBadge, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, PaymentInput, RegistrationRecord } from '../types';
import { requestHumanConfirmation } from '../utils/confirm';
import { cleanText, formatDate, formatEventSchedule, toMoney } from '../utils/format';
import {
  getParticipantPaymentSessionState,
  getPreferredParticipantPaymentMethod,
} from '../utils/participantUx';

type Props = {
  event: EventItem;
  registration: RegistrationRecord;
  onBack: () => void;
  onEditRegistration: () => void;
  onConfirm: (payment: PaymentInput) => Promise<void>;
  onCancel: () => void;
  t: Translator;
};

export function ParticipantPaymentScreen({
  event,
  registration,
  onBack,
  onEditRegistration,
  onConfirm,
  onCancel,
  t,
}: Props) {
  const [method, setMethod] = useState<'stripe' | 'cash'>(() =>
    getPreferredParticipantPaymentMethod({
      cashPaymentEnabled: event.cashPaymentEnabled,
      registrationStatus: registration.registrationStatus,
      paymentMethod: registration.paymentMethod,
    })
  );
  const [payerName, setPayerName] = useState(registration.fullName);
  const [reference, setReference] = useState(registration.paymentReference ?? '');
  const cashDeadline = event.cashPaymentDeadline
    ? formatDate(event.cashPaymentDeadline)
    : formatDate(event.registrationCloseDate);
  const cashInstructions = cleanText(event.cashPaymentInstructions ?? '');
  const paymentSessionState = useMemo(
    () => getParticipantPaymentSessionState(registration.paymentSessionExpiresAt),
    [registration.paymentSessionExpiresAt]
  );

  useEffect(() => {
    setMethod(
      getPreferredParticipantPaymentMethod({
        cashPaymentEnabled: event.cashPaymentEnabled,
        registrationStatus: registration.registrationStatus,
        paymentMethod: registration.paymentMethod,
      })
    );
    setPayerName(registration.fullName);
    setReference(registration.paymentReference ?? '');
  }, [
    event.cashPaymentEnabled,
    registration.fullName,
    registration.paymentMethod,
    registration.paymentReference,
    registration.registrationStatus,
  ]);
  const registrationStatusLabel = useMemo(() => {
    switch (registration.registrationStatus) {
      case 'pending_payment':
        return t('registration_status_pending_payment');
      case 'pending_cash':
        return t('registration_status_pending_cash');
      case 'paid':
        return t('registration_status_paid');
      case 'payment_failed':
        return t('registration_status_payment_failed');
      case 'cancelled':
        return t('registration_status_cancelled');
      case 'refunded':
        return t('registration_status_refunded');
      default:
        return registration.registrationStatus;
    }
  }, [registration.registrationStatus, t]);
  const paymentStatusLabel = useMemo(() => {
    switch (registration.paymentStatus) {
      case 'not_required':
        return t('payment_status_not_required');
      case 'pending':
        return t('payment_status_pending');
      case 'requires_action':
        return t('payment_status_requires_action');
      case 'authorized':
        return t('payment_status_authorized');
      case 'captured':
        return t('payment_status_captured');
      case 'failed':
        return t('payment_status_failed');
      case 'expired':
        return t('payment_status_expired');
      case 'refunded':
        return t('payment_status_refunded');
      case 'cancelled':
        return t('payment_status_cancelled');
      default:
        return registration.paymentStatus;
    }
  }, [registration.paymentStatus, t]);

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

  const selectedMethodLabel = method === 'stripe' ? t('method_stripe') : t('method_cash');
  const primaryActionLabel =
    method === 'stripe'
      ? t('payment_open_checkout_button')
      : t('payment_request_cash_button');
  const statusTone =
    registration.registrationStatus === 'paid'
      ? 'success'
      : registration.registrationStatus === 'payment_failed' ||
          registration.registrationStatus === 'cancelled'
        ? 'warning'
        : 'neutral';
  const paymentTone =
    registration.paymentStatus === 'captured'
      ? 'success'
      : registration.paymentStatus === 'failed' ||
          registration.paymentStatus === 'expired' ||
          registration.paymentStatus === 'cancelled'
        ? 'warning'
        : 'neutral';
  const paymentSessionNotice =
    paymentSessionState === 'expired'
      ? {
          style: styles.noticeCardWarning,
          message: t('payment_session_expired_notice'),
        }
      : paymentSessionState === 'expiring'
        ? {
            style: styles.noticeCardWarning,
            message: t('payment_session_expiring_notice', { value: sessionLabel }),
          }
        : paymentSessionState === 'active'
          ? {
              style: styles.noticeCardInfo,
              message: t('payment_session_active_notice', { value: sessionLabel }),
            }
          : null;

  const submit = async () => {
    if (!cleanText(payerName)) {
      Alert.alert(t('missing_payer_name_title'), t('missing_payer_name_message'));
      return;
    }

    if (method === 'cash' && !event.cashPaymentEnabled) {
      Alert.alert(t('missing_data_title'), t('cash_payment_not_enabled_message'));
      return;
    }

    const confirmed = await requestHumanConfirmation({
      title:
        method === 'stripe'
          ? t('payment_checkout_confirm_title')
          : t('payment_cash_confirm_title'),
      message:
        method === 'stripe'
          ? t('payment_checkout_confirm_message', {
              event: event.name,
              amount: toMoney(registration.paymentAmount),
            })
          : t('payment_cash_confirm_message', {
              event: event.name,
              deadline: cashDeadline,
            }),
      confirmLabel: primaryActionLabel,
      cancelLabel: t('close'),
    });
    if (!confirmed) {
      return;
    }

    void onConfirm({
      method,
      payerName,
      reference,
    });
  };

  const confirmEditRegistration = async () => {
    const confirmed = await requestHumanConfirmation({
      title: t('payment_edit_confirm_title'),
      message: t('payment_edit_confirm_message'),
      confirmLabel: t('edit_pending_registration'),
      cancelLabel: t('close'),
    });
    if (!confirmed) {
      return;
    }
    onEditRegistration();
  };

  const confirmCancelRegistration = async () => {
    const confirmed = await requestHumanConfirmation({
      title: t('registration_cancel_confirm_title'),
      message: t('registration_cancel_confirm_message', {
        event: event.name,
      }),
      confirmLabel: t('cancel_pending_registration'),
      cancelLabel: t('close'),
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    onCancel();
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('payment_title')} delayMs={0}>
        <View style={styles.heroPanel}>
          <Text style={styles.heroEyebrow}>{t('payment_title')}</Text>
          <Text style={styles.emphasisParagraph}>{event.name}</Text>
          <View style={styles.statusBadgeRow}>
            <StatusBadge label={registrationStatusLabel} tone={statusTone} />
            <StatusBadge label={paymentStatusLabel} tone={paymentTone} />
            <StatusBadge label={selectedMethodLabel} />
          </View>
          <View style={styles.inlineMetricRow}>
            <MetricChip
              label={t('payment_amount_metric')}
              value={toMoney(registration.paymentAmount)}
            />
            <MetricChip
              label={t('registration_participants_metric')}
              value={String(Math.max(1, registration.groupParticipantsCount))}
            />
            <MetricChip label={t('payment_session_short_label')} value={sessionLabel} />
          </View>
          <Text style={styles.listSubText}>
            {t('date_label', { value: formatEventSchedule(event) })}
          </Text>
          <Text style={styles.listSubText}>
            {t('registration_code_label', { value: registration.registrationCode })}
          </Text>
          <Text style={styles.helperText}>
            {method === 'stripe'
              ? t('payment_checkout_flow_hint')
              : t('cash_payment_flow_helper')}
          </Text>
          <Text style={styles.helperText}>{t('payment_fiscal_compliance_notice')}</Text>
          {paymentSessionNotice ? (
            <View style={[styles.noticeCard, paymentSessionNotice.style]}>
              <Text style={styles.noticeTitle}>{t('payment_session_status_title')}</Text>
              <Text style={styles.noticeText}>{paymentSessionNotice.message}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>{t('payment_method')}</Text>
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
          <View style={[styles.noticeCard, styles.noticeCardInfo]}>
            <Text style={styles.noticeTitle}>{t('payment_next_step_title')}</Text>
            <Text style={styles.noticeText}>
              {method === 'stripe'
                ? t('payment_webhook_helper')
                : t('cash_payment_flow_helper')}
            </Text>
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
        </View>

        <View style={styles.formSectionCard}>
          <Text style={styles.sectionHeaderTitle}>{t('payment_payer_section_title')}</Text>
          <TextField
            label={t('payer_name')}
            value={payerName}
            onChangeText={setPayerName}
            autoComplete='name'
            textContentType='name'
            returnKeyType='next'
          />
          <TextField
            label={t('payment_reference_optional')}
            value={reference}
            onChangeText={setReference}
            placeholder={t('payment_reference_placeholder')}
            autoCapitalize='characters'
            autoCorrect={false}
            returnKeyType='done'
          />
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            void submit();
          }}
        >
          <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_event_detail')}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void confirmEditRegistration();
          }}
        >
          <Text style={styles.secondaryButtonText}>{t('edit_pending_registration')}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void confirmCancelRegistration();
          }}
        >
          <Text style={styles.secondaryButtonText}>{t('cancel_pending_registration')}</Text>
        </Pressable>
      </SectionCard>
    </ScrollView>
  );
}
