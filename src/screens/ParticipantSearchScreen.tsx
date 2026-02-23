import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

import { SectionCard, SwitchRow, TextField } from '../components/Common';
import { Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem, SponsorSlot } from '../types';
import { cleanText, formatEventSchedule, toMoney } from '../utils/format';

type Props = {
  events: EventItem[];
  onBack: () => void;
  onSelectEvent: (eventId: string) => void;
  getEventPublicUrl: (event: EventItem) => string | null;
  appPublicUrl: string | null;
  sponsorSlots: SponsorSlot[];
  t: Translator;
};

export function ParticipantSearchScreen({
  events,
  onBack,
  onSelectEvent,
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
  const [organizerContact, setOrganizerContact] = useState('');

  const filtered = useMemo(() => {
    return events
      .filter((event) => event.visibility === 'public')
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

  const suggestEventToOrganizer = async () => {
    const contact = cleanText(organizerContact);
    if (!contact) {
      Alert.alert(t('missing_data_title'), t('suggest_event_invalid_contact'));
      return;
    }
    if (!appPublicUrl) {
      Alert.alert(t('missing_data_title'), t('suggest_event_missing_link'));
      return;
    }

    const eventName = cleanText(suggestedEventName) || t('suggest_event_generic_name');
    const eventLocation = cleanText(suggestedEventLocation) || t('suggest_event_generic_location');
    const subject = t('suggest_event_subject');
    const body = t('suggest_event_body', {
      event: eventName,
      location: eventLocation,
      link: appPublicUrl,
    });

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    if (isEmail) {
      const mailtoUrl = `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        body
      )}`;
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        Alert.alert(t('suggest_event_sent_title'), t('suggest_event_sent_message'));
        return;
      }
      Alert.alert(t('suggest_event_sent_title'), t('suggest_event_open_fail'));
      return;
    }

    const phone = contact.replace(/[^\d+]/g, '');
    if (!phone) {
      Alert.alert(t('missing_data_title'), t('suggest_event_invalid_contact'));
      return;
    }

    const whatsappPhone = phone.replace(/[^\d]/g, '');
    const waUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(body)}`;
    const canOpenWa = await Linking.canOpenURL(waUrl);
    if (canOpenWa) {
      await Linking.openURL(waUrl);
      Alert.alert(t('suggest_event_sent_title'), t('suggest_event_sent_message'));
      return;
    }

    const separator = Platform.OS === 'ios' ? '&' : '?';
    const smsUrl = `sms:${phone}${separator}body=${encodeURIComponent(body)}`;
    const canOpenSms = await Linking.canOpenURL(smsUrl);
    if (canOpenSms) {
      await Linking.openURL(smsUrl);
      Alert.alert(t('suggest_event_sent_title'), t('suggest_event_sent_message'));
      return;
    }

    Alert.alert(t('suggest_event_sent_title'), t('suggest_event_open_fail'));
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('participant_search')} delayMs={0}>
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

            <Text style={styles.fieldLabel}>{t('suggest_event_title')}</Text>
            <Text style={styles.helperText}>{t('suggest_event_intro')}</Text>
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
              label={t('suggest_event_contact_label')}
              value={organizerContact}
              onChangeText={setOrganizerContact}
              placeholder={t('suggest_event_contact_placeholder')}
            />
            <Pressable style={styles.secondaryButton} onPress={() => void suggestEventToOrganizer()}>
              <Text style={styles.secondaryButtonText}>{t('suggest_event_send_button')}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
            </Pressable>
          </SectionCard>
        </View>

        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('results')} delayMs={120}>
            {filtered.length === 0 ? (
              <Text style={styles.cardParagraph}>{t('no_results')}</Text>
            ) : (
              filtered.map((event) => (
                <View key={event.id} style={styles.listCard}>
                  <Text style={styles.listTitle}>{event.name}</Text>
                  <Text style={styles.listSubText}>
                    {event.location} | {formatEventSchedule(event)}
                  </Text>
                  <Text style={styles.listSubText}>
                    {event.isFree
                      ? t('free_event_label')
                      : t('entry_fee_label', { fee: toMoney(event.feeAmount) })}
                  </Text>
                  {event.localSponsor && event.isFree ? (
                    <Text style={styles.listSubText}>{event.localSponsor}</Text>
                  ) : null}
                  {(() => {
                    const eventSponsorSlots = visibleSponsorSlotsByEvent.get(event.id) ?? [];
                    return (
                      <>
                        <Text style={styles.fieldLabel}>{t('sponsor_section_title')}</Text>
                        {eventSponsorSlots.length === 0 ? (
                          <Text style={styles.helperText}>{t('sponsor_section_empty')}</Text>
                        ) : (
                          eventSponsorSlots.map((slot) => (
                            <View key={slot.id} style={styles.registrationCard}>
                              <Text style={styles.listSubText}>
                                {slot.sponsorName || slot.sponsorNameIt || slot.sponsorNameEn}
                              </Text>
                              {slot.sponsorLogoUrl ? (
                                <Image source={{ uri: slot.sponsorLogoUrl }} style={styles.sponsorLogoPreview} />
                              ) : null}
                              {slot.sponsorUrl ? (
                                <Pressable
                                  style={styles.inlineActionButton}
                                  onPress={() => {
                                    void openSponsorActivity(slot.sponsorUrl ?? '');
                                  }}
                                >
                                  <Text style={styles.inlineActionButtonText}>{t('sponsor_activity_open')}</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ))
                        )}
                      </>
                    );
                  })()}
                  {(() => {
                    const publicUrl = getEventPublicUrl(event);
                    if (!publicUrl) {
                      return null;
                    }
                    return (
                      <View style={styles.registrationCard}>
                        <Text style={styles.helperText}>{publicUrl}</Text>
                        <View style={styles.registrationCard}>
                          <QRCode value={publicUrl} size={120} />
                        </View>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            void copyEventLink(publicUrl);
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>{t('copy_event_link')}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            void shareEventLink(publicUrl);
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>{t('share_event_link')}</Text>
                        </Pressable>
                      </View>
                    );
                  })()}
                  <Pressable style={styles.primaryButtonCompact} onPress={() => onSelectEvent(event.id)}>
                    <Text style={styles.primaryButtonText}>{t('subscribe')}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );
}
