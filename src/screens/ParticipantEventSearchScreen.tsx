import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SegmentedControl } from '../components/Common';
import { EventCard, resolveParticipantEventAction } from '../components/EventCard';
import { AppLanguage, Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem } from '../types';
import {
  ParticipantPriceFilter,
  filterParticipantDiscoverableEvents,
} from '../utils/participantUx';

type Props = {
  events: EventItem[];
  onBack: () => void;
  onSelectEvent: (eventId: string) => void;
  editableEventIds?: string[];
  resumablePaymentEventIds?: string[];
  language: AppLanguage;
  t: Translator;
};

export function ParticipantSearchScreen({
  events,
  onBack,
  onSelectEvent,
  editableEventIds = [],
  resumablePaymentEventIds = [],
  language,
  t,
}: Props) {
  const [query, setQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<ParticipantPriceFilter>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const actionSets = useMemo(
    () => ({
      editableEventIds: new Set(editableEventIds),
      resumablePaymentEventIds: new Set(resumablePaymentEventIds),
    }),
    [editableEventIds, resumablePaymentEventIds]
  );

  const allUpcoming = useMemo(() => filterParticipantDiscoverableEvents(events), [events]);
  const filtered = useMemo(
    () => filterParticipantDiscoverableEvents(events, { query, priceFilter, openOnly }),
    [events, openOnly, priceFilter, query]
  );
  const hasActiveFilters = Boolean(query.trim()) || priceFilter !== 'all' || openOnly;

  const resetFilters = () => {
    setQuery('');
    setPriceFilter('all');
    setOpenOnly(false);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps='handled'
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitle}>{t('participant_search')}</Text>
          <Pressable style={styles.inlineActionButton} onPress={onBack}>
            <Text style={styles.inlineActionButtonText}>{t('back_home')}</Text>
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <Text style={styles.searchLauncherIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_unified_placeholder')}
            placeholderTextColor='#8AA8C0'
            autoCorrect={false}
            autoCapitalize='none'
            returnKeyType='search'
            accessibilityLabel={t('search_unified_placeholder')}
            style={styles.searchFieldInput}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole='button'
              accessibilityLabel={t('clear_filters')}
              hitSlop={10}
            >
              <Text style={styles.searchFieldClear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <SegmentedControl<ParticipantPriceFilter>
          options={[
            { value: 'all', label: t('search_filter_all') },
            { value: 'free', label: t('search_filter_free') },
            { value: 'paid', label: t('search_filter_paid') },
          ]}
          value={priceFilter}
          onChange={setPriceFilter}
        />
        <View style={styles.methodRow}>
          <Pressable
            style={[styles.methodChip, openOnly ? styles.methodChipActive : undefined]}
            onPress={() => setOpenOnly((current) => !current)}
            accessibilityRole='button'
            accessibilityState={{ selected: openOnly }}
          >
            <Text style={[styles.methodChipText, openOnly ? styles.methodChipTextActive : undefined]}>
              {t('search_filter_open_only')}
            </Text>
          </Pressable>
          {hasActiveFilters ? (
            <Pressable style={styles.methodChip} onPress={resetFilters}>
              <Text style={styles.methodChipText}>{t('clear_filters')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {allUpcoming.length === 0 ? (
        <View style={[styles.noticeCard, styles.noticeCardInfo]}>
          <Text style={styles.noticeTitle}>{t('home_upcoming_empty_title')}</Text>
          <Text style={styles.noticeText}>{t('home_upcoming_empty_body')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.noticeCard, styles.noticeCardInfo]}>
          <Text style={styles.noticeTitle}>{t('no_results')}</Text>
          <Text style={styles.noticeText}>{t('search_no_match_body')}</Text>
        </View>
      ) : (
        <View style={styles.sectionStack}>
          <Text style={styles.helperText}>
            {t('search_result_count', { count: filtered.length })}
          </Text>
          {filtered.map((event) => {
            const action = resolveParticipantEventAction(event, actionSets, t);
            return (
              <EventCard
                key={event.id}
                event={event}
                language={language}
                t={t}
                canRegister={action.canRegister}
                actionLabel={action.actionLabel}
                onPress={() => onSelectEvent(event.id)}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
