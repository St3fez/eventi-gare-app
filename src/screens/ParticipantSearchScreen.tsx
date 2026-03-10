import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { MetricChip, SectionCard, StatusBadge, SwitchRow, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, SponsorSlot } from '../types';
import {
  compareParticipantEventsForSearch,
  getParticipantEventAvailability,
} from '../utils/participantUx';
import {
  cleanText,
  formatDate,
  formatEventSchedule,
  isValidEmailAddress,
  isImageDataUrl,
  toMoney,
} from '../utils/format';

type Props = {
  events: EventItem[];
  onBack: () => void;
  onSelectEvent: (eventId: string) => void;
  editableEventIds?: string[];
  getEventPublicUrl: (event: EventItem) => string | null;
  appPublicUrl: string | null;
  sponsorSlots: SponsorSlot[];
  t: Translator;
};

export function ParticipantSearchScreen({
  events,
  onBack,
  onSelectEvent,
  editableEventIds = [],
  getEventPublicUrl,
  appPublicUrl,
  sponsorSlots,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1080;
  const [nameQuery, setNameQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [suggestedEventName, setSuggestedEventName] = useState('');
  const [suggestedEventLocation, setSuggestedEventLocation] = useState('');
  const [organizerEmailContact, setOrganizerEmailContact] = useState('');
  const [organizerWhatsappContact, setOrganizerWhatsappContact] = useState('');
  const hasActiveFilters = Boolean(
    cleanText(nameQuery) || cleanText(locationQuery) || !activeOnly
  );
  const editableEventIdSet = useMemo(() => new Set(editableEventIds), [editableEventIds]);

  const filtered = useMemo(() => {
    const normalizedNameQuery = cleanText(nameQuery).toLowerCase();
    const normalizedLocationQuery = cleanText(locationQuery).toLowerCase();
    return events
      .filter((event) => cleanText(event.visibility) === 'public')
      .filter((event) => (activeOnly ? Boolean(event.active) : true))
      .filter((event) =>
        normalizedNameQuery
          ? cleanText(event.name).toLowerCase().includes(normalizedNameQuery)
          : true
      )
      .filter((event) =>
        normalizedLocationQuery
          ? cleanText(event.location).toLowerCase().includes(normalizedLocationQuery)
          : true
      )
      .sort((first, second) => compareParticipantEventsForSearch(first, second));
  }, [activeOnly, events, locationQuery, nameQuery]);

  const visibleSponsorSlotsByEvent = useMemo(() => {
    const now = Date.now();
    const grouped = new Map<string, SponsorSlot[]>();
    sponsorSlots
      .filter((slot) => slot.active && new Date(slot.endsAt).getTime() > now)
      .forEach((slot) => {
        const current = grouped.get(slot.eventId) ?? [];
        current.push(slot);
        grouped.set(slot.eventId, current);
      });
    return grouped;
  }, [sponsorSlots]);

  const summaryMetrics = useMemo(() => {
    const metrics = {
      open: 0,
      upcoming: 0,
      free: 0,
      paid: 0,
    };

    filtered.forEach((event) => {
      const availability = getParticipantEventAvailability(event);
      if (availability === 'registration_open') {
        metrics.open += 1;
      } else if (availability === 'registration_upcoming') {
        metrics.upcoming += 1;
      }

      if (event.isFree) {
        metrics.free += 1;
      } else {
        metrics.paid += 1;
      }
    });

    return metrics;
  }, [filtered]);

  const normalizeExternalUrl = (input: string): string => {
    const value = cleanText(input);
    if (!value) {
      return '';
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return `https://${value}`;
  };

  const openSponsorActivity = async (url: string) => {
    const normalized = normalizeExternalUrl(url);
    if (!normalized) {
      return;
    }
    const canOpen = await Linking.canOpenURL(normalized);
    if (!canOpen) {
      Alert.alert(t('sponsor_activity_open_fail_title'), t('sponsor_activity_open_fail_message'));
      return;
    }
    await Linking.openURL(normalized);
  };

  const copyEventLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert(t('event_link_copied_title'), t('event_link_copied_message'));
  };

  const shareEventLink = async (url: string) => {
    await Share.share({
      message: url,
      url,
    });
  };

  const resetFilters = () => {
    setNameQuery('');
    setLocationQuery('');
    setActiveOnly(true);
  };

  const buildSuggestionPayload = () => {
    if (!appPublicUrl) {
      Alert.alert(t('missing_data_title'), t('suggest_event_missing_link'));
      return null;
    }

    const eventName = cleanText(suggestedEventName) || t('suggest_event_generic_name');
    const eventLocation = cleanText(suggestedEventLocation) || t('suggest_event_generic_location');
    const subject = t('suggest_event_subject');
    const body = t('suggest_webapp_body', {
      event: eventName,
      location: eventLocation,
      link: appPublicUrl,
    });
    return {
      subject,
      body,
    };
  };

  const suggestEventViaEmail = async () => {
    const payload = buildSuggestionPayload();
    if (!payload) {
      return;
    }

    const contact = cleanText(organizerEmailContact).toLowerCase();
    if (!isValidEmailAddress(contact)) {
      Alert.alert(t('missing_data_title'), t('suggest_event_invalid_email'));
      return;
    }

    const mailtoUrl = `mailto:${contact}?subject=${encodeURIComponent(
      payload.subject
    )}&body=${encodeURIComponent(payload.body)}`;
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (!canOpen) {
      Alert.alert(t('suggest_event_sent_title'), t('suggest_event_open_fail'));
      return;
    }

    await Linking.openURL(mailtoUrl);
    Alert.alert(t('suggest_event_sent_title'), t('suggest_event_sent_message'));
  };

  const suggestEventViaWhatsapp = async () => {
    const payload = buildSuggestionPayload();
    if (!payload) {
      return;
    }

    const contact = cleanText(organizerWhatsappContact);
    const whatsappPhone = contact.replace(/[^\d]/g, '');
    if (whatsappPhone.length < 8) {
      Alert.alert(t('missing_data_title'), t('suggest_event_invalid_whatsapp'));
      return;
    }

    const waUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(payload.body)}`;
    const canOpenWa = await Linking.canOpenURL(waUrl);
    if (canOpenWa) {
      await Linking.openURL(waUrl);
      Alert.alert(t('suggest_event_sent_title'), t('suggest_event_sent_message'));
      return;
    }

    Alert.alert(t('suggest_event_sent_title'), t('suggest_event_open_fail'));
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps='handled'
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('participant_search')} delayMs={0}>
            <View style={styles.heroPanel}>
              <Text style={styles.heroEyebrow}>{t('participant_search_summary_title')}</Text>
              <Text style={styles.emphasisParagraph}>{t('participant_search_intro')}</Text>
              <Text style={styles.helperText}>
                {t('search_results_count', { count: filtered.length })}
              </Text>
              <View style={styles.inlineMetricRow}>
                <MetricChip
                  label={t('participant_search_open_now')}
                  value={String(summaryMetrics.open)}
                />
                <MetricChip
                  label={t('participant_search_upcoming')}
                  value={String(summaryMetrics.upcoming)}
                />
                <MetricChip
                  label={t('participant_search_free')}
                  value={String(summaryMetrics.free)}
                />
                <MetricChip
                  label={t('participant_search_paid')}
                  value={String(summaryMetrics.paid)}
                />
              </View>
            </View>

            <View style={styles.formSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>{t('participant_search_filters_title')}</Text>
                {hasActiveFilters ? (
                  <Pressable style={styles.inlineActionButton} onPress={resetFilters}>
                    <Text style={styles.inlineActionButtonText}>{t('clear_filters')}</Text>
                  </Pressable>
                ) : (
                  <StatusBadge label={t('search_results_count', { count: filtered.length })} />
                )}
              </View>
              <Text style={styles.helperText}>{t('participant_search_filters_hint')}</Text>
              <TextField
                label={t('search_name')}
                value={nameQuery}
                onChangeText={setNameQuery}
                placeholder={t('search_name_placeholder')}
                autoCorrect={false}
                returnKeyType='search'
              />
              <TextField
                label={t('search_location')}
                value={locationQuery}
                onChangeText={setLocationQuery}
                placeholder={t('search_location_placeholder')}
                autoCorrect={false}
                returnKeyType='search'
              />
              <SwitchRow
                label={t('active_search_only')}
                value={activeOnly}
                onValueChange={setActiveOnly}
              />
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('participant_search_next_steps_title')}</Text>
              <View style={styles.flowCard}>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>1</Text>
                  <Text style={styles.flowStepText}>{t('participant_search_next_steps_1')}</Text>
                </View>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>2</Text>
                  <Text style={styles.flowStepText}>{t('participant_search_next_steps_2')}</Text>
                </View>
                <View style={styles.flowStepRow}>
                  <Text style={styles.flowStepIndex}>3</Text>
                  <Text style={styles.flowStepText}>{t('participant_search_next_steps_3')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.formSectionCard}>
              <Text style={styles.sectionHeaderTitle}>{t('participant_search_share_title')}</Text>
              <Text style={styles.helperText}>{t('suggest_event_intro')}</Text>
              <Text style={styles.helperText}>
                {appPublicUrl
                  ? t('suggest_event_link_preview', { link: appPublicUrl })
                  : t('suggest_event_missing_link')}
              </Text>
              {appPublicUrl ? (
                <>
                  <Text style={styles.fieldLabel}>{t('official_app_qr_title')}</Text>
                  <View style={styles.qrWrap}>
                    <View style={styles.qrCard}>
                      <QRCode value={appPublicUrl} size={120} />
                    </View>
                  </View>
                </>
              ) : null}
              <Text style={styles.helperText}>{t('suggest_event_channel_hint')}</Text>
              <TextField
                label={t('suggest_event_name_label')}
                value={suggestedEventName}
                onChangeText={setSuggestedEventName}
              />
              <TextField
                label={t('suggest_event_location_label')}
                value={suggestedEventLocation}
                onChangeText={setSuggestedEventLocation}
              />
              <TextField
                label={t('suggest_event_email_label')}
                value={organizerEmailContact}
                onChangeText={setOrganizerEmailContact}
                placeholder={t('suggest_event_email_placeholder')}
                keyboardType='email-address'
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='email'
                textContentType='emailAddress'
                inputMode='email'
              />
              <TextField
                label={t('suggest_event_whatsapp_label')}
                value={organizerWhatsappContact}
                onChangeText={setOrganizerWhatsappContact}
                placeholder={t('suggest_event_whatsapp_placeholder')}
                keyboardType='phone-pad'
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='tel'
                textContentType='telephoneNumber'
                inputMode='tel'
              />
              <View style={styles.suggestionButtonRow}>
                <Pressable
                  style={[styles.secondaryButton, styles.suggestionButton]}
                  onPress={() => void suggestEventViaEmail()}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t('suggest_event_send_email_button')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.suggestionButton]}
                  onPress={() => void suggestEventViaWhatsapp()}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t('suggest_event_send_whatsapp_button')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
            </Pressable>
          </SectionCard>
        </View>

        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('results')} delayMs={120}>
            <Text style={styles.helperText}>{t('participant_search_results_hint')}</Text>
            {filtered.length === 0 ? (
              <View style={[styles.noticeCard, styles.noticeCardInfo]}>
                <Text style={styles.noticeTitle}>{t('no_results')}</Text>
                <Text style={styles.noticeText}>{t('participant_search_empty_hint')}</Text>
              </View>
            ) : (
              filtered.map((event) => {
                const eventId = cleanText(event.id);
                if (!eventId) {
                  return null;
                }

                const eventName = cleanText(event.name);
                const eventLocation = cleanText(event.location);
                const eventLogoUrl = cleanText(event.logoUrl ?? '');
                const localSponsor = cleanText(event.localSponsor ?? '');
                const eventSponsorSlots = visibleSponsorSlotsByEvent.get(eventId) ?? [];
                const availability = getParticipantEventAvailability(event);
                const availabilityTone =
                  availability === 'registration_open'
                    ? 'success'
                    : availability === 'registration_upcoming'
                      ? 'warning'
                      : 'neutral';
                const availabilityLabel =
                  availability === 'registration_open'
                    ? t('badge_registration_open')
                    : availability === 'registration_upcoming'
                      ? t('badge_registration_upcoming')
                      : t('badge_registration_closed');
                const canStartRegistration =
                  availability === 'registration_open' || editableEventIdSet.has(eventId);
                const authLabel =
                  event.participantAuthMode === 'email'
                    ? t('participant_auth_mode_email')
                    : event.participantAuthMode === 'social_verified'
                      ? t('participant_auth_mode_social')
                      : event.participantAuthMode === 'flexible'
                        ? t('participant_auth_mode_flexible')
                        : t('participant_auth_mode_anonymous');

                return (
                  <View key={eventId} style={styles.listCard}>
                    <View style={styles.statusBadgeRow}>
                      <StatusBadge label={availabilityLabel} tone={availabilityTone} />
                      <StatusBadge
                        label={
                          event.isFree
                            ? t('free_event_label')
                            : t('entry_fee_label', { fee: toMoney(event.feeAmount) })
                        }
                        tone={event.isFree ? 'success' : 'warning'}
                      />
                      <StatusBadge label={authLabel} />
                      <StatusBadge
                        label={
                          event.participantPhoneRequired
                            ? t('badge_phone_short_required')
                            : t('badge_phone_short_optional')
                        }
                      />
                      {eventSponsorSlots.length > 0 ? (
                        <StatusBadge label={t('badge_sponsors_active')} tone='success' />
                      ) : null}
                    </View>
                    <Text style={styles.listTitle}>{eventName}</Text>
                    {eventLogoUrl ? (
                      <Image source={{ uri: eventLogoUrl }} style={styles.sponsorLogoPreview} />
                    ) : null}
                    <Text style={styles.listSubText}>
                      {eventLocation} | {formatEventSchedule(event)}
                    </Text>
                    <View style={styles.miniMetricsGrid}>
                      <View style={[styles.miniMetricCard, styles.miniMetricCardDense]}>
                        <Text style={[styles.miniMetricValue, styles.miniMetricValueCompact]}>
                          {formatDate(event.date)}
                        </Text>
                        <Text style={styles.miniMetricLabel}>
                          {t('participant_search_metric_date')}
                        </Text>
                      </View>
                      <View style={[styles.miniMetricCard, styles.miniMetricCardDense]}>
                        <Text style={[styles.miniMetricValue, styles.miniMetricValueCompact]}>
                          {formatDate(event.registrationCloseDate || event.endDate || event.date)}
                        </Text>
                        <Text style={styles.miniMetricLabel}>
                          {t('participant_search_metric_deadline')}
                        </Text>
                      </View>
                      <View style={[styles.miniMetricCard, styles.miniMetricCardDense]}>
                        <Text style={[styles.miniMetricValue, styles.miniMetricValueCompact]}>
                          {authLabel}
                        </Text>
                        <Text style={styles.miniMetricLabel}>
                          {t('participant_search_metric_access')}
                        </Text>
                      </View>
                      <View style={[styles.miniMetricCard, styles.miniMetricCardDense]}>
                        <Text style={[styles.miniMetricValue, styles.miniMetricValueCompact]}>
                          {editableEventIdSet.has(eventId)
                            ? t('update_registration_data')
                            : canStartRegistration
                              ? t('subscribe')
                              : availabilityLabel}
                        </Text>
                        <Text style={styles.miniMetricLabel}>
                          {t('participant_search_metric_action')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.listSubText}>
                      {t('registration_window_line', {
                        from: formatDate(event.registrationOpenDate),
                        to: formatDate(event.registrationCloseDate || event.endDate || event.date),
                      })}
                    </Text>
                    <View style={[styles.noticeCard, styles.noticeCardInfo]}>
                      <Text style={styles.noticeTitle}>{t('participant_search_card_hint_title')}</Text>
                      <Text style={styles.noticeText}>
                        {availability === 'registration_open'
                          ? t('participant_search_card_hint_open')
                          : availability === 'registration_upcoming'
                            ? t('participant_search_card_hint_upcoming')
                            : t('participant_search_card_hint_closed')}
                      </Text>
                    </View>
                    {event.isFree && localSponsor ? (
                      isImageDataUrl(localSponsor) ? (
                        <Image source={{ uri: localSponsor }} style={styles.sponsorLogoPreview} />
                      ) : (
                        <Text style={styles.listSubText}>{localSponsor}</Text>
                      )
                    ) : null}
                    <Text style={styles.fieldLabel}>{t('sponsor_section_title')}</Text>
                    {eventSponsorSlots.length === 0 ? (
                      <Text style={styles.helperText}>{t('sponsor_section_empty')}</Text>
                    ) : (
                      eventSponsorSlots.map((slot) => {
                        const sponsorName = cleanText(
                          slot.sponsorName || slot.sponsorNameIt || slot.sponsorNameEn
                        );
                        const sponsorLogoUrl = cleanText(slot.sponsorLogoUrl ?? '');
                        const sponsorUrl = cleanText(slot.sponsorUrl ?? '');

                        return (
                          <View key={slot.id} style={styles.registrationCard}>
                            <Text style={styles.listSubText}>{sponsorName}</Text>
                            {sponsorLogoUrl ? (
                              <Image
                                source={{ uri: sponsorLogoUrl }}
                                style={styles.sponsorLogoPreview}
                              />
                            ) : null}
                            {sponsorUrl ? (
                              <Pressable
                                style={styles.inlineActionButton}
                                onPress={() => {
                                  void openSponsorActivity(sponsorUrl);
                                }}
                              >
                                <Text style={styles.inlineActionButtonText}>
                                  {t('sponsor_activity_open')}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                    {(() => {
                      const publicUrl = cleanText(getEventPublicUrl(event));
                      if (!publicUrl) {
                        return null;
                      }
                      return (
                        <View style={styles.registrationCard}>
                          <Text style={styles.helperText}>{publicUrl}</Text>
                          <View style={styles.qrWrap}>
                            <View style={styles.qrCard}>
                              <QRCode value={publicUrl} size={120} />
                            </View>
                          </View>
                          <View style={styles.compactActionRow}>
                            <Pressable
                              style={styles.secondaryButton}
                              onPress={() => {
                                void copyEventLink(publicUrl);
                              }}
                            >
                              <Text style={styles.secondaryButtonText}>
                                {t('copy_event_link')}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.secondaryButton}
                              onPress={() => {
                                void shareEventLink(publicUrl);
                              }}
                            >
                              <Text style={styles.secondaryButtonText}>
                                {t('share_event_link')}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })()}
                    <Pressable
                      style={[
                        styles.primaryButtonCompact,
                        !canStartRegistration ? styles.primaryButtonDisabled : undefined,
                      ]}
                      onPress={() => onSelectEvent(eventId)}
                      disabled={!canStartRegistration}
                    >
                      <Text style={styles.primaryButtonText}>
                        {editableEventIdSet.has(eventId)
                          ? t('update_registration_data')
                          : canStartRegistration
                            ? t('subscribe')
                            : availabilityLabel}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
