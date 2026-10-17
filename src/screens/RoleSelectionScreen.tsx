import React, { useMemo } from 'react';
import QRCode from 'react-native-qrcode-svg';
import { Platform, Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';

import { LanguageToggle } from '../components/Common';
import { EventCard, resolveParticipantEventAction } from '../components/EventCard';
import { AppLanguage, Translator } from '../i18n';
import { styles } from '../styles';
import { EventItem } from '../types';
import { filterParticipantDiscoverableEvents } from '../utils/participantUx';

const HOME_EVENT_LIMIT = 4;

type Props = {
  events: EventItem[];
  editableEventIds?: string[];
  resumablePaymentEventIds?: string[];
  onSelectEvent: (eventId: string) => void;
  onOpenSearch: () => void;
  onOrganizer: () => void;
  onOpenLegal: () => void;
  onOpenPrivacy: () => void;
  appPublicUrl: string | null;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  t: Translator;
};

export function RoleSelectionScreen({
  events,
  editableEventIds = [],
  resumablePaymentEventIds = [],
  onSelectEvent,
  onOpenSearch,
  onOrganizer,
  onOpenLegal,
  onOpenPrivacy,
  appPublicUrl,
  language,
  onLanguageChange,
  t,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 980;
  const showQr = Platform.OS === 'web' && isDesktopLayout && Boolean(appPublicUrl);

  const upcomingEvents = useMemo(() => filterParticipantDiscoverableEvents(events), [events]);
  const actionSets = useMemo(
    () => ({
      editableEventIds: new Set(editableEventIds),
      resumablePaymentEventIds: new Set(resumablePaymentEventIds),
    }),
    [editableEventIds, resumablePaymentEventIds]
  );

  const shareApp = async () => {
    if (!appPublicUrl) {
      return;
    }
    await Share.share({
      title: t('app_name'),
      message: t('home_share_text', { link: appPublicUrl }),
      url: appPublicUrl,
    });
  };

  const eventsSection = (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.cardTitle}>{t('home_upcoming_title')}</Text>
        {upcomingEvents.length > 0 ? (
          <Pressable style={styles.inlineActionButton} onPress={onOpenSearch}>
            <Text style={styles.inlineActionButtonText}>
              {t('home_upcoming_see_all', { count: upcomingEvents.length })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {upcomingEvents.length === 0 ? (
        <View style={[styles.noticeCard, styles.noticeCardInfo]}>
          <Text style={styles.noticeTitle}>{t('home_upcoming_empty_title')}</Text>
          <Text style={styles.noticeText}>{t('home_upcoming_empty_body')}</Text>
        </View>
      ) : (
        <View style={styles.sectionStack}>
          {upcomingEvents.slice(0, HOME_EVENT_LIMIT).map((event) => {
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
    </View>
  );

  const organizerSection = (
    <View style={[styles.card, styles.organizerPromoCard]}>
      <Text style={styles.heroEyebrow}>{t('home_organizer_eyebrow')}</Text>
      <Text style={styles.cardTitle}>{t('home_organizer_title')}</Text>
      <View style={styles.promoList}>
        <Text style={styles.promoListItem}>✓ {t('home_organizer_point_1')}</Text>
        <Text style={styles.promoListItem}>✓ {t('home_organizer_point_2')}</Text>
        <Text style={styles.promoListItem}>✓ {t('home_organizer_point_3')}</Text>
      </View>
      <Pressable style={styles.primaryButton} onPress={onOrganizer}>
        <Text style={styles.primaryButtonText}>{t('home_organizer_cta')}</Text>
      </Pressable>
      <Text style={styles.helperText}>{t('home_organizer_pricing_hint')}</Text>
    </View>
  );

  const shareSection = appPublicUrl ? (
    <View style={styles.card}>
      <Text style={styles.sectionHeaderTitle}>{t('home_share_title')}</Text>
      <Text style={styles.helperText}>{t('home_share_body')}</Text>
      {showQr ? (
        <View style={styles.qrWrap}>
          <View style={styles.qrCard}>
            <QRCode value={appPublicUrl} size={128} />
          </View>
        </View>
      ) : null}
      <Pressable style={styles.secondaryButton} onPress={() => void shareApp()}>
        <Text style={styles.secondaryButtonText}>{t('home_share_button')}</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps='handled'
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHero}>
        <View style={styles.homeHeroTopRow}>
          {/* The app header already shows the name everywhere except the Android home. */}
          {Platform.OS === 'android' ? (
            <Text style={styles.heroEyebrow}>{t('app_name')}</Text>
          ) : (
            <View />
          )}
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </View>
        <Text style={styles.homeHeroHeadline}>{t('home_hero_title')}</Text>
        <Text style={styles.homeHeroBody}>{t('home_hero_body')}</Text>
        <Pressable
          style={styles.searchLauncher}
          onPress={onOpenSearch}
          accessibilityRole='search'
          accessibilityLabel={t('search_unified_placeholder')}
        >
          <Text style={styles.searchLauncherIcon}>⌕</Text>
          <Text style={styles.searchLauncherText}>{t('search_unified_placeholder')}</Text>
        </Pressable>
      </View>

      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View
          style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}
        >
          {eventsSection}
        </View>
        <View
          style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}
        >
          <View style={styles.sectionStack}>
            {organizerSection}
            {shareSection}
          </View>
        </View>
      </View>

      <View style={styles.homeFooter}>
        <Pressable onPress={onOpenPrivacy} accessibilityRole='link'>
          <Text style={styles.homeFooterLink}>{t('privacy_policy_page_title')}</Text>
        </Pressable>
        <Text style={styles.homeFooterDot}>·</Text>
        <Pressable onPress={onOpenLegal} accessibilityRole='link'>
          <Text style={styles.homeFooterLink}>{t('home_footer_terms')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
