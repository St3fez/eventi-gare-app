import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SectionCard, SwitchRow, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem } from '../types';
import { cleanText, formatDate, toMoney } from '../utils/format';

type Props = {
  events: EventItem[];
  onBack: () => void;
  onSelectEvent: (eventId: string) => void;
  t: Translator;
};

export function ParticipantSearchScreen({ events, onBack, onSelectEvent, t }: Props) {
  const [nameQuery, setNameQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const filtered = useMemo(() => {
    return events
      .filter((event) => (activeOnly ? event.active : true))
      .filter((event) =>
        cleanText(nameQuery)
          ? event.name.toLowerCase().includes(cleanText(nameQuery).toLowerCase())
          : true
      )
      .filter((event) =>
        cleanText(locationQuery)
          ? event.location.toLowerCase().includes(cleanText(locationQuery).toLowerCase())
          : true
      )
      .sort((first, second) => first.date.localeCompare(second.date));
  }, [activeOnly, events, locationQuery, nameQuery]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SectionCard title={t('participant_search')}>
        <Text style={styles.cardParagraph}>{t('participant_search_intro')}</Text>
        <TextField
          label={t('search_name')}
          value={nameQuery}
          onChangeText={setNameQuery}
          placeholder={t('search_name_placeholder')}
        />
        <TextField
          label={t('search_location')}
          value={locationQuery}
          onChangeText={setLocationQuery}
          placeholder={t('search_location_placeholder')}
        />
        <SwitchRow label={t('active_search_only')} value={activeOnly} onValueChange={setActiveOnly} />

        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
        </Pressable>
      </SectionCard>

      <SectionCard title={t('results')}>
        {filtered.length === 0 ? (
          <Text style={styles.cardParagraph}>{t('no_results')}</Text>
        ) : (
          filtered.map((event) => (
            <View key={event.id} style={styles.listCard}>
              <Text style={styles.listTitle}>{event.name}</Text>
              <Text style={styles.listSubText}>
                {event.location} | {formatDate(event.date)}
              </Text>
              <Text style={styles.listSubText}>
                {event.isFree
                  ? t('free_event_label')
                  : t('entry_fee_label', { fee: toMoney(event.feeAmount) })}
              </Text>
              {event.localSponsor && event.isFree ? (
                <Text style={styles.listSubText}>{event.localSponsor}</Text>
              ) : null}
              <Pressable style={styles.primaryButtonCompact} onPress={() => onSelectEvent(event.id)}>
                <Text style={styles.primaryButtonText}>{t('subscribe')}</Text>
              </Pressable>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}
