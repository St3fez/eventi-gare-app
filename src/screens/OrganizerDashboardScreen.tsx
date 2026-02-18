import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { MetricChip, SectionCard, TextField } from '../components/Common';
import { AppLanguage, Translator } from '../i18n';
import { organizerCanCreatePaidEvents, verificationStatusLabel } from '../services/fraud';
import { styles } from '../styles';
import {
  EventItem,
  OrganizerProfile,
  PaymentIntentRecord,
  RegistrationRecord,
  SponsorSlot,
} from '../types';
import { cleanText, formatDate, parseEuro, toMoney } from '../utils/format';

type Props = {
  organizer: OrganizerProfile;
  events: EventItem[];
  registrations: RegistrationRecord[];
  paymentIntents: PaymentIntentRecord[];
  sponsorSlots: SponsorSlot[];
  onBack: () => void;
  onNewEvent: () => void;
  onToggleEvent: (eventId: string) => void;
  onExportEvent: (eventId: string) => Promise<void>;
  onCreateSponsorCheckout: (payload: {
    eventId: string;
    sponsorName: string;
    sponsorNameIt?: string;
    sponsorNameEn?: string;
    sponsorUrl?: string;
    sponsorLogoUrl?: string;
    sponsorEmail?: string;
    packageDays: number;
    amount: number;
  }) => Promise<void>;
  t: Translator;
  language: AppLanguage;
};

export function OrganizerDashboardScreen({
  organizer,
  events,
  registrations,
  paymentIntents,
  sponsorSlots,
  onBack,
  onNewEvent,
  onToggleEvent,
  onExportEvent,
  onCreateSponsorCheckout,
  t,
  language,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1180;
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(events[0]?.id);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorNameIt, setSponsorNameIt] = useState('');
  const [sponsorNameEn, setSponsorNameEn] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorDays, setSponsorDays] = useState('1');
  const [sponsorAmount, setSponsorAmount] = useState('');

  useEffect(() => {
    if (!events.length) {
      setSelectedEventId(undefined);
      return;
    }
    if (!selectedEventId || !events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const eventRegistrations = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }
    return registrations
      .filter((entry) => entry.eventId === selectedEvent.id)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [registrations, selectedEvent]);

  const sponsorSlotsForEvent = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }
    return sponsorSlots
      .filter((slot) => slot.eventId === selectedEvent.id)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [selectedEvent, sponsorSlots]);

  const allEventIds = new Set(events.map((entry) => entry.id));
  const organizerRegistrations = registrations.filter((entry) => allEventIds.has(entry.eventId));
  const grossRevenue = organizerRegistrations.reduce((sum, entry) => sum + entry.paymentAmount, 0);
  const totalCommission = organizerRegistrations.reduce((sum, entry) => sum + entry.commissionAmount, 0);
  const canCreatePaidEvents = organizerCanCreatePaidEvents(organizer);

  const paymentIntentMap = useMemo(
    () => new Map(paymentIntents.map((intent) => [intent.id, intent])),
    [paymentIntents]
  );

  const sponsorStatusLabel = (status: SponsorSlot['status']) => {
    switch (status) {
      case 'pending_payment':
        return t('sponsor_status_pending_payment');
      case 'active':
        return t('sponsor_status_active');
      case 'expired':
        return t('sponsor_status_expired');
      case 'cancelled':
        return t('sponsor_status_cancelled');
      case 'payment_failed':
        return t('sponsor_status_payment_failed');
      case 'refunded':
        return t('sponsor_status_refunded');
      default:
        return status;
    }
  };

  const submitSponsorCheckout = () => {
    if (!selectedEvent) {
      Alert.alert(t('missing_data_title'), t('select_event_for_list'));
      return;
    }

    if (!cleanText(sponsorName)) {
      Alert.alert(t('missing_data_title'), t('sponsor_name_required'));
      return;
    }

    const parsedDays = Number.parseInt(sponsorDays, 10);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      Alert.alert(t('missing_data_title'), t('sponsor_days_invalid'));
      return;
    }

    const parsedAmount = parseEuro(sponsorAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('missing_data_title'), t('sponsor_amount_invalid'));
      return;
    }

    void onCreateSponsorCheckout({
      eventId: selectedEvent.id,
      sponsorName,
      sponsorNameIt,
      sponsorNameEn,
      sponsorUrl,
      sponsorLogoUrl,
      sponsorEmail,
      packageDays: parsedDays,
      amount: parsedAmount,
    }).then(() => {
      setSponsorName('');
      setSponsorNameIt('');
      setSponsorNameEn('');
      setSponsorEmail('');
      setSponsorUrl('');
      setSponsorLogoUrl('');
      setSponsorDays('1');
      setSponsorAmount('');
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('organizer_dashboard')} delayMs={0}>
            <Text style={styles.cardParagraph}>{t('account_label', { email: organizer.email })}</Text>
            <Text style={styles.cardParagraph}>
              {t('antifraud_status', {
                status: verificationStatusLabel(organizer.verificationStatus, language),
                payout: organizer.payoutEnabled ? t('payout_enabled') : t('payout_blocked'),
              })}
            </Text>
            <Text style={styles.helperText}>{t('risk_score', { score: organizer.riskScore })}</Text>
            {organizer.riskFlags.length > 0 ? (
              <Text style={styles.helperText}>
                {t('risk_flags', { flags: organizer.riskFlags.join(' | ') })}
              </Text>
            ) : null}
            {!canCreatePaidEvents ? (
              <Text style={styles.helperText}>{t('paid_disabled')}</Text>
            ) : null}

            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('created_events')} value={String(events.length)} />
              <MetricChip label={t('registered_users')} value={String(organizerRegistrations.length)} />
            </View>
            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('gross_revenue')} value={toMoney(grossRevenue)} />
              <MetricChip label={t('commissions_3')} value={toMoney(totalCommission)} />
            </View>

            <Pressable style={styles.primaryButton} onPress={onNewEvent}>
              <Text style={styles.primaryButtonText}>{t('create_new_event')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
            </Pressable>
          </SectionCard>

          <SectionCard title={t('your_events')} delayMs={90}>
            {events.length === 0 ? (
              <Text style={styles.cardParagraph}>{t('no_events')}</Text>
            ) : (
              events
                .sort((first, second) => first.date.localeCompare(second.date))
                .map((event) => {
                  const eventCount = registrations.filter((entry) => entry.eventId === event.id).length;
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.listCard,
                        selectedEventId === event.id ? styles.listCardSelected : undefined,
                      ]}
                    >
                      <Pressable onPress={() => setSelectedEventId(event.id)}>
                        <Text style={styles.listTitle}>{event.name}</Text>
                        <Text style={styles.listSubText}>
                          {event.location} | {formatDate(event.date)} |{' '}
                          {event.isFree
                            ? t('event_free')
                            : t('event_fee', { fee: toMoney(event.feeAmount) })}
                        </Text>
                        <Text style={styles.listSubText}>
                          {t('subscribers_count', { count: eventCount })}
                        </Text>
                        <Text style={styles.listSubText}>
                          {event.active ? t('event_status_active') : t('event_status_inactive')}
                        </Text>
                      </Pressable>

                      <View style={styles.inlineActionRow}>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => onToggleEvent(event.id)}
                        >
                          <Text style={styles.inlineActionButtonText}>
                            {event.active ? t('deactivate') : t('activate')}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onExportEvent(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('export_csv')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
            )}
          </SectionCard>
        </View>

        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('sponsor_paid_section')} delayMs={180}>
            <Text style={styles.cardParagraph}>{t('sponsor_paid_intro')}</Text>
            {selectedEvent ? (
              <Text style={styles.helperText}>
                {t('sponsor_selected_event', { event: selectedEvent.name })}
              </Text>
            ) : (
              <Text style={styles.helperText}>{t('select_event_for_list')}</Text>
            )}

            <TextField
              label={t('sponsor_name_required')}
              value={sponsorName}
              onChangeText={setSponsorName}
            />
            <TextField
              label={t('sponsor_name_it_optional')}
              value={sponsorNameIt}
              onChangeText={setSponsorNameIt}
            />
            <TextField
              label={t('sponsor_name_en_optional')}
              value={sponsorNameEn}
              onChangeText={setSponsorNameEn}
            />
            <TextField
              label={t('sponsor_days_label')}
              value={sponsorDays}
              onChangeText={setSponsorDays}
              keyboardType='decimal-pad'
            />
            <TextField
              label={t('sponsor_amount_label')}
              value={sponsorAmount}
              onChangeText={setSponsorAmount}
              keyboardType='decimal-pad'
            />
            <TextField
              label={t('sponsor_email_optional')}
              value={sponsorEmail}
              onChangeText={setSponsorEmail}
              keyboardType='email-address'
            />
            <TextField
              label={t('sponsor_url_optional')}
              value={sponsorUrl}
              onChangeText={setSponsorUrl}
              placeholder='https://...'
            />
            <TextField
              label={t('sponsor_logo_optional')}
              value={sponsorLogoUrl}
              onChangeText={setSponsorLogoUrl}
              placeholder='https://...'
            />

            <Pressable style={styles.primaryButton} onPress={submitSponsorCheckout}>
              <Text style={styles.primaryButtonText}>{t('sponsor_generate_checkout')}</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>{t('sponsor_slots_for_event')}</Text>
            {sponsorSlotsForEvent.length === 0 ? (
              <Text style={styles.helperText}>{t('sponsor_no_slots')}</Text>
            ) : (
              sponsorSlotsForEvent.map((slot) => (
                <View key={slot.id} style={styles.registrationCard}>
                  <Text style={styles.listTitle}>
                    {language === 'it' ? slot.sponsorNameIt : slot.sponsorNameEn}
                  </Text>
                  <Text style={styles.listSubText}>
                    {toMoney(slot.amount)} | {slot.packageDays}d
                  </Text>
                  <Text style={styles.listSubText}>
                    {t('sponsor_slot_status', {
                      status: sponsorStatusLabel(slot.status),
                      active: slot.active ? 'true' : 'false',
                    })}
                  </Text>
                  <Text style={styles.listSubText}>
                    {t('sponsor_slot_period', {
                      from: formatDate(slot.startsAt.slice(0, 10)),
                      to: formatDate(slot.endsAt.slice(0, 10)),
                    })}
                  </Text>
                  {slot.stripePaymentLinkUrl ? (
                    <Text style={styles.listSubText}>
                      {t('sponsor_slot_checkout_link', { url: slot.stripePaymentLinkUrl })}
                    </Text>
                  ) : null}
                  {slot.contractTerms.it ? (
                    <Text style={styles.helperText}>
                      {t('sponsor_slot_contract_it', { text: slot.contractTerms.it })}
                    </Text>
                  ) : null}
                  {slot.contractTerms.en ? (
                    <Text style={styles.helperText}>
                      {t('sponsor_slot_contract_en', { text: slot.contractTerms.en })}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </SectionCard>
        </View>
      </View>

      <SectionCard title={t('realtime_list')} delayMs={270}>
        {!selectedEvent ? (
          <Text style={styles.cardParagraph}>{t('select_event_for_list')}</Text>
        ) : eventRegistrations.length === 0 ? (
          <Text style={styles.cardParagraph}>
            {t('no_registrations_for_event', { event: selectedEvent.name })}
          </Text>
        ) : (
          eventRegistrations.map((entry) => {
            const intent = entry.paymentIntentId ? paymentIntentMap.get(entry.paymentIntentId) : undefined;
            const numberText =
              typeof entry.assignedNumber === 'number'
                ? t('number_suffix', { number: entry.assignedNumber })
                : '';
            return (
              <View key={entry.id} style={styles.registrationCard}>
                <Text style={styles.listTitle}>{entry.fullName}</Text>
                <Text style={styles.listSubText}>{entry.email}</Text>
                <Text style={styles.listSubText}>
                  {t('code_number_line', {
                    code: entry.registrationCode,
                    number: numberText,
                  })}
                </Text>
                <Text style={styles.listSubText}>
                  {t('registration_payment_state', {
                    reg: entry.registrationStatus,
                    pay: entry.paymentStatus,
                  })}
                </Text>
                <Text style={styles.listSubText}>
                  {t('amount_commission', {
                    amount: toMoney(entry.paymentAmount),
                    commission: toMoney(entry.commissionAmount),
                  })}
                </Text>
                {entry.paymentReference ? (
                  <Text style={styles.listSubText}>
                    {t('payment_reference', { reference: entry.paymentReference })}
                  </Text>
                ) : null}
                {intent ? (
                  <Text style={styles.listSubText}>
                    {t('payment_intent_line', { id: intent.id, status: intent.status })}
                  </Text>
                ) : null}
                {entry.paymentFailedReason ? (
                  <Text style={styles.listSubText}>
                    {t('payment_error_reason', { reason: entry.paymentFailedReason })}
                  </Text>
                ) : null}
                <Text style={styles.listSubText}>
                  {t('registration_date', { date: formatDate(entry.createdAt.slice(0, 10)) })}
                </Text>
              </View>
            );
          })
        )}
      </SectionCard>
    </ScrollView>
  );
}
