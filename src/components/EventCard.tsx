import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppLanguage, Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem } from '../types';
import { getParticipantEventAvailability } from '../utils/participantUx';
import { cleanText, formatDate, formatTime, toIsoDate, toMoney } from '../utils/format';
import { StatusBadge } from './Common';

const MONTHS: Record<AppLanguage, string[]> = {
  it: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
};

export const resolveParticipantEventAction = (
  event: EventItem,
  options: { editableEventIds: Set<string>; resumablePaymentEventIds: Set<string> },
  t: Translator
): { canRegister: boolean; actionLabel: string } => {
  const eventId = cleanText(event.id);
  if (options.resumablePaymentEventIds.has(eventId)) {
    return { canRegister: true, actionLabel: t('resume_payment_action') };
  }
  if (options.editableEventIds.has(eventId)) {
    return { canRegister: true, actionLabel: t('participant_search_continue_registration') };
  }
  return {
    canRegister: getParticipantEventAvailability(event) === 'registration_open',
    actionLabel: t('event_card_register'),
  };
};

type Props = {
  event: EventItem;
  language: AppLanguage;
  t: Translator;
  onPress: () => void;
  actionLabel?: string;
  canRegister?: boolean;
};

export function EventCard({ event, language, t, onPress, actionLabel, canRegister }: Props) {
  const startIso = toIsoDate(event.date);
  const [, monthPart, dayPart] = startIso.split('-');
  const monthLabel = MONTHS[language][Number.parseInt(monthPart, 10) - 1] ?? '';
  const endIso = cleanText(event.endDate) ? toIsoDate(event.endDate) : startIso;
  const isMultiDay = endIso > startIso;
  const time = formatTime(event.startTime);

  const availability = getParticipantEventAvailability(event);
  const registrable = canRegister ?? availability === 'registration_open';
  const availabilityBadge =
    availability === 'registration_open'
      ? { label: t('event_card_open'), tone: 'success' as const }
      : availability === 'registration_upcoming'
        ? {
            label: t('event_card_opens_on', {
              date: formatDate(toIsoDate(event.registrationOpenDate || event.date)),
            }),
            tone: 'neutral' as const,
          }
        : { label: t('event_card_closed'), tone: 'warning' as const };

  const priceLabel = event.isFree ? t('event_card_free') : toMoney(event.feeAmount);
  const whenLine = [
    isMultiDay ? `${formatDate(startIso)} – ${formatDate(endIso)}` : formatDate(startIso),
    time,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={registrable ? onPress : undefined}
      disabled={!registrable}
      accessibilityRole='button'
      accessibilityLabel={`${cleanText(event.name)}, ${whenLine}, ${cleanText(event.location)}`}
      style={({ pressed }) => [
        styles.eventCard,
        pressed ? styles.eventCardPressed : undefined,
        !registrable ? styles.eventCardMuted : undefined,
      ]}
    >
      <View style={styles.eventDateBadge}>
        <Text style={styles.eventDateDay}>{dayPart}</Text>
        <Text style={styles.eventDateMonth}>{monthLabel}</Text>
      </View>
      <View style={styles.eventCardBody}>
        <Text style={styles.eventCardTitle} numberOfLines={2}>
          {cleanText(event.name)}
        </Text>
        {cleanText(event.location) ? (
          <Text style={styles.eventCardMeta} numberOfLines={1}>
            {cleanText(event.location)}
          </Text>
        ) : null}
        <Text style={styles.eventCardMeta}>{whenLine}</Text>
        <View style={styles.eventCardFooter}>
          <View style={styles.statusBadgeRow}>
            <StatusBadge label={priceLabel} tone={event.isFree ? 'success' : 'neutral'} />
            <StatusBadge label={availabilityBadge.label} tone={availabilityBadge.tone} />
          </View>
          {registrable ? (
            <Text style={styles.eventCardAction}>{actionLabel ?? t('event_card_register')} →</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
