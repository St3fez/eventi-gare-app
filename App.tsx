import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  ADMIN_CONTACT_EMAIL,
  ADMOB_ENABLED,
  COMMISSION_RATE,
  DEFAULT_PRIVACY_TEXT,
  EVENT_WEB_BASE_URL,
  IS_DEMO_CHANNEL,
  ORGANIZER_SECURITY_ENFORCED,
  ORGANIZER_TEST_MODE,
  PAID_FEATURE_UNLOCK_CONTACT,
  PAYMENT_SESSION_MINUTES,
  SPONSOR_MODULE_ACTIVATION_EUR,
  STRIPE_PROVIDER_FEE_FIXED,
  STRIPE_PROVIDER_FEE_RATE,
  createDefaultData,
} from './src/constants';
import { AdMobBanner } from './src/components/AdMobBanner';
import { FallbackScreen, FreeEventBanner } from './src/components/Common';
import { FreeInterstitialModal } from './src/components/FreeInterstitialModal';
import { LegalModal } from './src/components/LegalModal';
import { ProcessingInterstitialModal } from './src/components/ProcessingInterstitialModal';
import { AppLanguage, createTranslator } from './src/i18n';
import { sendConfirmationEmail } from './src/services/email';
import { exportEventRegistrationsCsv } from './src/services/exportCsv';
import { exportEventRegistrationsPdf } from './src/services/exportPdf';
import {
  organizerCanUsePaidSection,
  scoreOrganizerRisk,
} from './src/services/fraud';
import { sendOrganizerComplianceEmail } from './src/services/organizerComplianceEmail';
import { createParticipantCheckout } from './src/services/participantCheckout';
import { initAdMob, loadInterstitialAd, showInterstitialAd } from './src/services/admob';
import {
  completeOAuthFromUrl,
  getOrganizerSecurityStatus,
  OrganizerSecurityStatus,
  signInWithEmail,
  signUpWithEmail,
  startOrganizerOAuth,
} from './src/services/authSupabase';
import {
  applyPaymentWebhook,
  expirePendingPaymentSessions,
  isPaymentSessionExpired,
} from './src/services/paymentStateMachine';
import { loadAppData, saveAppData } from './src/services/storage';
import {
  ensureSupabaseUser,
  insertEventInSupabase,
  updateEventInSupabase,
  upsertOrganizerInSupabase,
  upsertRegistrationInSupabase,
} from './src/services/supabaseData';
import {
  createSponsorCheckout,
  createSponsorModuleCheckout,
  listSponsorSlotsFromSupabase,
  SponsorSlotRow,
} from './src/services/sponsorSupabase';
import {
  startStripeConnectOnboarding,
  syncStripeConnectStatus,
} from './src/services/stripeConnect';
import { OrganizerCreateEventScreen } from './src/screens/OrganizerCreateEventScreen';
import { OrganizerDashboardScreen } from './src/screens/OrganizerDashboardScreen';
import { OrganizerAuthScreen } from './src/screens/OrganizerAuthScreen';
import { OrganizerProfileScreen } from './src/screens/OrganizerProfileScreen';
import { ParticipantAuthScreen } from './src/screens/ParticipantAuthScreen';
import { ParticipantPaymentScreen } from './src/screens/ParticipantPaymentScreen';
import { ParticipantRegistrationScreen } from './src/screens/ParticipantRegistrationScreen';
import { ParticipantSearchScreen } from './src/screens/ParticipantSearchScreen';
import { RoleSelectionScreen } from './src/screens/RoleSelectionScreen';
import { styles } from './src/styles';
import {
  AppData,
  EventPaymentChannel,
  EventItem,
  FreeInterstitial,
  OrganizerProfile,
  OrganizerComplianceAttachment,
  PaymentInput,
  PaymentIntentRecord,
  RegistrationDraft,
  RegistrationRecord,
  ScreenState,
  SponsorSlot,
} from './src/types';
import {
  addMinutesIso,
  buildRegistrationCode,
  cleanText,
  formatDate,
  normalizeComparableText,
  randomId,
  toMoney,
  toIsoDate,
  toIsoTime,
} from './src/utils/format';

const mapSponsorRowToSlot = (row: SponsorSlotRow, source: AppData): SponsorSlot => {
  const event = source.events.find((entry) => entry.remoteId === row.event_id);
  const organizer = source.organizers.find((entry) => entry.remoteId === row.organizer_id);

  return {
    id: row.id,
    eventId: event?.id ?? row.event_id,
    eventRemoteId: row.event_id,
    organizerId: organizer?.id ?? row.organizer_id,
    organizerRemoteId: row.organizer_id,
    sponsorName: row.sponsor_name,
    sponsorNameIt: row.sponsor_name_it,
    sponsorNameEn: row.sponsor_name_en,
    sponsorUrl: row.sponsor_url ?? undefined,
    sponsorLogoUrl: row.sponsor_logo_url ?? undefined,
    packageDays: row.package_days,
    amount: Number(row.amount),
    currency: row.currency,
    contractTerms: {
      it: row.contract_terms?.it ?? '',
      en: row.contract_terms?.en ?? '',
    },
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
    stripePaymentLinkUrl: row.stripe_payment_link_url ?? undefined,
    payerEmail: row.payer_email ?? undefined,
    status: row.status,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    paidAt: row.paid_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const isSponsorSlotVisible = (slot: SponsorSlot): boolean => {
  if (!slot.active) {
    return false;
  }
  const expiry = new Date(slot.endsAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
};

const roundMoney = (value: number): number => Number.parseFloat(value.toFixed(2));

const getProviderFeeConfig = () => {
  return {
    rate: STRIPE_PROVIDER_FEE_RATE,
    fixed: STRIPE_PROVIDER_FEE_FIXED,
  };
};

const computeEventFeePreview = (params: {
  baseFeeAmount: number;
  isFree: boolean;
  feePolicy: 'organizer_absorbs_fees' | 'participant_pays_fees';
  paymentChannel: EventPaymentChannel;
}) => {
  if (params.isFree) {
    return {
      chargedToParticipant: 0,
      commissionAmount: 0,
      providerFeeAmount: 0,
      organizerNetAmount: 0,
      providerFeeRate: getProviderFeeConfig().rate,
      providerFeeFixed: getProviderFeeConfig().fixed,
    };
  }

  const providerConfig = getProviderFeeConfig();
  const commissionAmount = roundMoney(params.baseFeeAmount * COMMISSION_RATE);
  const providerFeeAmount = roundMoney(
    params.baseFeeAmount * providerConfig.rate + providerConfig.fixed
  );

  if (params.feePolicy === 'participant_pays_fees') {
    return {
      chargedToParticipant: roundMoney(
        params.baseFeeAmount + commissionAmount + providerFeeAmount
      ),
      commissionAmount,
      providerFeeAmount,
      organizerNetAmount: roundMoney(params.baseFeeAmount),
      providerFeeRate: providerConfig.rate,
      providerFeeFixed: providerConfig.fixed,
    };
  }

  return {
    chargedToParticipant: roundMoney(params.baseFeeAmount),
    commissionAmount,
    providerFeeAmount,
    organizerNetAmount: roundMoney(
      Math.max(0, params.baseFeeAmount - commissionAmount - providerFeeAmount)
    ),
    providerFeeRate: providerConfig.rate,
    providerFeeFixed: providerConfig.fixed,
  };
};

const isRegistrationWindowOpen = (event: EventItem): boolean => {
  if (event.isFree && !event.active) {
    return false;
  }

  if (!event.registrationsOpen) {
    return false;
  }

  if (event.closedAt) {
    return false;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const opensAt = event.registrationOpenDate || todayIso;
  const closesAt = event.registrationCloseDate || event.endDate || event.date;
  if (todayIso < opensAt) {
    return false;
  }
  if (todayIso > closesAt) {
    return false;
  }
  return event.active && event.visibility === 'public';
};

const REGISTRATION_RETENTION_DAYS = 90;

const purgeExpiredRegistrationsByPolicy = (source: AppData): AppData => {
  const cutoff = Date.now() - REGISTRATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const nextRegistrations = source.registrations.filter((entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(createdAt)) {
      return true;
    }
    return createdAt >= cutoff;
  });

  if (nextRegistrations.length === source.registrations.length) {
    return source;
  }

  const validRegistrationIds = new Set(nextRegistrations.map((entry) => entry.id));
  const nextPaymentIntents = source.paymentIntents.filter((entry) =>
    validRegistrationIds.has(entry.registrationId)
  );

  return {
    ...source,
    registrations: nextRegistrations,
    paymentIntents: nextPaymentIntents,
  };
};

const getEventPublicBaseUrl = (): string | null => {
  if (cleanText(EVENT_WEB_BASE_URL ?? '')) {
    return cleanText(EVENT_WEB_BASE_URL ?? '').replace(/\/+$/, '');
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return null;
};

const buildEventDuplicateKey = (name: string, location: string, date: string): string =>
  `${normalizeComparableText(name)}|${normalizeComparableText(location)}|${toIsoDate(date)}`;

const addYearsIso = (isoDate: string, years: number): string => {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  parsed.setFullYear(parsed.getFullYear() + years);
  return parsed.toISOString().slice(0, 10);
};

function App() {
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1024;
  const [appData, setAppData] = useState<AppData>(createDefaultData);
  const [language, setLanguage] = useState<AppLanguage>('it');
  const [screen, setScreen] = useState<ScreenState>({ name: 'role' });
  const [isReady, setIsReady] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [freeInterstitial, setFreeInterstitial] = useState<FreeInterstitial | null>(null);
  const [processingInterstitial, setProcessingInterstitial] = useState<{
    secondsRemaining: number;
    sponsor?: string;
  } | null>(null);
  const [organizerSecurity, setOrganizerSecurity] = useState<OrganizerSecurityStatus | null>(
    null
  );
  const [handledSharedEventRef, setHandledSharedEventRef] = useState<string | null>(null);
  const t = useMemo(() => createTranslator(language), [language]);
  const appSubtitle = IS_DEMO_CHANNEL ? t('app_subtitle_demo') : t('app_subtitle');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const loaded = await loadAppData(createDefaultData());
      const retentionHandled = purgeExpiredRegistrationsByPolicy(loaded);
      const expiredHandled = expirePendingPaymentSessions(retentionHandled);
      if (mounted) {
        setAppData(expiredHandled);
        setIsReady(true);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const bootAuth = async () => {
      const auth = await ensureSupabaseUser();
      if (!auth.ok) {
        Alert.alert(t('supabase_auth_title'), auth.reason);
      }
    };
    void bootAuth();
  }, [t]);

  useEffect(() => {
    if (!ADMOB_ENABLED) {
      return;
    }
    void initAdMob().then(() => {
      loadInterstitialAd();
    });
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    void saveAppData(appData);
  }, [appData, isReady]);

  useEffect(() => {
    if (!isReady || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const sharedRef = cleanText(params.get('eventRef') ?? '');
    if (!sharedRef || handledSharedEventRef === sharedRef) {
      return;
    }

    const sharedEvent = appData.events.find(
      (entry) => entry.id === sharedRef || entry.remoteId === sharedRef
    );
    setHandledSharedEventRef(sharedRef);

    if (!sharedEvent || sharedEvent.visibility !== 'public' || !sharedEvent.active) {
      return;
    }

    setScreen({ name: 'participantRegister', eventId: sharedEvent.id });
  }, [appData.events, handledSharedEventRef, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const sponsorResult = await listSponsorSlotsFromSupabase();
      if (!sponsorResult.ok || cancelled) {
        return;
      }

      setAppData((current) => {
        const mapped = sponsorResult.data.map((entry) => mapSponsorRowToSlot(entry, current));
        const currentSerialized = JSON.stringify(current.sponsorSlots);
        const nextSerialized = JSON.stringify(mapped);
        if (currentSerialized === nextSerialized) {
          return current;
        }
        return {
          ...current,
          sponsorSlots: mapped,
        };
      });
    };

    void refresh();
    const intervalId = setInterval(() => {
      void refresh();
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isReady]);

  const refreshOrganizerSecurityState = async (showMissingAlert = false): Promise<boolean> => {
    if (!ORGANIZER_SECURITY_ENFORCED) {
      return true;
    }

    const status = await getOrganizerSecurityStatus();
    if (!status.ok) {
      setOrganizerSecurity(null);
      if (showMissingAlert) {
        Alert.alert(t('organizer_security_required_title'), status.reason);
      }
      return false;
    }
    setOrganizerSecurity(status.data);
    if (showMissingAlert && !status.data.securityReady) {
      Alert.alert(t('organizer_security_required_title'), t('organizer_security_required_message'));
      return false;
    }
    return status.data.securityReady;
  };

  useEffect(() => {
    if (screen.name !== 'organizerAuth') {
      return;
    }
    void refreshOrganizerSecurityState();
  }, [screen.name]);

  useEffect(() => {
    const handleOAuthUrl = async (url: string) => {
      const completed = await completeOAuthFromUrl(url);
      if (!completed.ok) {
        return;
      }
      if (!completed.data) {
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, '', cleanUrl);
      }
      await refreshOrganizerSecurityState();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void handleOAuthUrl(window.location.href);
    }

    const listener = Linking.addEventListener('url', ({ url }) => {
      void handleOAuthUrl(url);
    });

    return () => {
      listener.remove();
    };
  }, []);

  const organizerForScreen = useMemo(() => {
    if (screen.name !== 'organizerCreate' && screen.name !== 'organizerDashboard') {
      return undefined;
    }
    return appData.organizers.find((organizer) => organizer.id === screen.organizerId);
  }, [appData.organizers, screen]);

  const editingEventForScreen = useMemo(() => {
    if (screen.name !== 'organizerCreate' || !screen.eventId) {
      return undefined;
    }
    return appData.events.find(
      (event) => event.id === screen.eventId && event.organizerId === screen.organizerId
    );
  }, [appData.events, screen]);

  const participantEventForRegister = useMemo(() => {
    if (screen.name !== 'participantRegister') {
      return undefined;
    }
    return appData.events.find((event) => event.id === screen.eventId);
  }, [appData.events, screen]);

  const participantRegistrationForPayment = useMemo(() => {
    if (screen.name !== 'participantPayment') {
      return undefined;
    }
    return appData.registrations.find((entry) => entry.id === screen.registrationId);
  }, [appData.registrations, screen]);

  const participantEventForPayment = useMemo(() => {
    if (!participantRegistrationForPayment) {
      return undefined;
    }
    return appData.events.find((event) => event.id === participantRegistrationForPayment.eventId);
  }, [appData.events, participantRegistrationForPayment]);

  const shouldShowMonetizationBanner = screen.name !== 'role';

  const monetizationBanner = useMemo(() => {
    const activeSponsorSlots = appData.sponsorSlots.filter((slot) => isSponsorSlotVisible(slot));

    let eventIdForSlot: string | undefined;
    if (screen.name === 'participantRegister') {
      eventIdForSlot = participantEventForRegister?.id;
    } else if (screen.name === 'participantPayment') {
      eventIdForSlot = participantEventForPayment?.id;
    } else if (screen.name === 'organizerDashboard') {
      eventIdForSlot = appData.events.find((event) => event.organizerId === screen.organizerId)?.id;
    }

    const slotCandidate =
      (eventIdForSlot
        ? activeSponsorSlots.find((slot) => slot.eventId === eventIdForSlot)
        : undefined) ?? activeSponsorSlots[0];

    if (slotCandidate) {
      const localizedName =
        language === 'it'
          ? cleanText(slotCandidate.sponsorNameIt || slotCandidate.sponsorName)
          : cleanText(slotCandidate.sponsorNameEn || slotCandidate.sponsorName);
      const sponsorName = localizedName || slotCandidate.sponsorName;
      return {
        sponsorName,
        text: t('banner_sponsor_prefix', { sponsor: sponsorName }),
      };
    }

    const fallbackSponsors: Array<string | undefined> = [];
    if (screen.name === 'participantRegister') {
      fallbackSponsors.push(participantEventForRegister?.localSponsor);
    } else if (screen.name === 'participantPayment') {
      fallbackSponsors.push(participantEventForPayment?.localSponsor);
    } else if (screen.name === 'participantSearch') {
      fallbackSponsors.push(appData.events.find((event) => event.active && event.localSponsor)?.localSponsor);
    } else if (screen.name === 'organizerDashboard') {
      fallbackSponsors.push(
        appData.events.find((event) => event.organizerId === screen.organizerId && event.localSponsor)
          ?.localSponsor
      );
    } else if (screen.name === 'organizerCreate' || screen.name === 'organizerProfile') {
      fallbackSponsors.push(appData.events.find((event) => event.active && event.localSponsor)?.localSponsor);
    }

    const fallbackSponsor = fallbackSponsors.find((entry) => cleanText(entry ?? ''));
    if (fallbackSponsor) {
      return {
        sponsorName: fallbackSponsor,
        text: t('banner_sponsor_prefix', { sponsor: fallbackSponsor }),
      };
    }

    return {
      sponsorName: '',
      text: t('banner_ad_default'),
    };
  }, [
    appData.events,
    appData.sponsorSlots,
    language,
    participantEventForPayment,
    participantEventForRegister,
    screen,
    t,
  ]);
  const shouldUseAdMobBanner =
    shouldShowMonetizationBanner &&
    ADMOB_ENABLED &&
    !monetizationBanner.sponsorName &&
    Platform.OS !== 'web';

  const withExpiredSessionsHandled = (source: AppData): AppData => {
    const retentionHandled = purgeExpiredRegistrationsByPolicy(source);
    const next = expirePendingPaymentSessions(retentionHandled);
    if (next !== source) {
      setAppData(next);
    }
    return next;
  };

  const getNextAssignedNumber = (source: AppData, eventId: string): number => {
    return (
      source.registrations
        .filter((entry) => entry.eventId === eventId && typeof entry.assignedNumber === 'number')
        .reduce((max, entry) => Math.max(max, entry.assignedNumber ?? 0), 0) + 1
    );
  };

  const ensureDraftConsents = (draft: RegistrationDraft): boolean => {
    if (!draft.privacyConsent || !draft.retentionConsent) {
      Alert.alert(t('required_consents_title'), t('required_consents_message'));
      return false;
    }
    return true;
  };

  const ensureParticipantAuthForEvent = async (
    _event: EventItem,
    _draft: RegistrationDraft
  ): Promise<boolean> => {
    if (ORGANIZER_TEST_MODE) {
      return true;
    }

    const auth = await ensureSupabaseUser({
      allowAnonymous: true,
    });

    if (!auth.ok) {
      Alert.alert(t('participant_auth_required_title'), auth.reason);
      return false;
    }

    return true;
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms);
    });

  const showRegistrationCountdown = async (event: EventItem) => {
    const slot = appData.sponsorSlots.find(
      (entry) => entry.eventId === event.id && isSponsorSlotVisible(entry)
    );
    const slotLabel = slot
      ? cleanText(language === 'it' ? slot.sponsorNameIt : slot.sponsorNameEn)
      : '';
    const sponsor = slotLabel || cleanText(event.localSponsor ?? '') || undefined;
    loadInterstitialAd();
    for (let secondsRemaining = 5; secondsRemaining >= 1; secondsRemaining -= 1) {
      setProcessingInterstitial({
        secondsRemaining,
        sponsor,
      });
      await wait(1000);
    }
    setProcessingInterstitial(null);
    await showInterstitialAd();
  };

  const signInOrganizerWithOAuth = async (provider: 'google' | 'apple') => {
    const result = await startOrganizerOAuth(provider);
    if (!result.ok) {
      Alert.alert(t('organizer_security_action_fail_title'), result.reason);
      return;
    }
    if (Platform.OS !== 'web') {
      Alert.alert(
        t('organizer_security_action_fail_title'),
        t('organizer_security_browser_opened')
      );
    }
  };

  const loginOrganizerWithEmail = async (
    email: string,
    password: string,
    mode: 'signin' | 'signup'
  ) => {
    const normalizedEmail = cleanText(email).toLowerCase();
    if (!normalizedEmail.includes('@')) {
      Alert.alert(t('invalid_email_title'), t('invalid_email_message'));
      return;
    }

    if (!cleanText(password)) {
      Alert.alert(t('missing_data_title'), t('organizer_security_missing_password'));
      return;
    }

    const action =
      mode === 'signup'
        ? await signUpWithEmail(normalizedEmail, password)
        : await signInWithEmail(normalizedEmail, password);

    if (action.error) {
      Alert.alert(t('organizer_security_action_fail_title'), action.error.message);
      return;
    }

    await refreshOrganizerSecurityState();
    Alert.alert(
      t('organizer_security_action_fail_title'),
      mode === 'signup'
        ? t('organizer_security_email_signup_ok')
        : t('organizer_security_email_login_ok')
    );
  };

  const patchOrganizerRemoteId = (organizerId: string, remoteId: string) => {
    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((entry) =>
        entry.id === organizerId ? { ...entry, remoteId } : entry
      ),
    }));
  };

  const patchOrganizerEmail = (organizerId: string, email: string) => {
    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((entry) =>
        entry.id === organizerId ? { ...entry, email } : entry
      ),
    }));
  };

  const patchEventRemoteId = (eventId: string, remoteId: string) => {
    setAppData((current) => ({
      ...current,
      events: current.events.map((entry) => (entry.id === eventId ? { ...entry, remoteId } : entry)),
    }));
  };

  const patchRegistrationRemoteId = (registrationId: string, remoteId: string) => {
    setAppData((current) => ({
      ...current,
      registrations: current.registrations.map((entry) =>
        entry.id === registrationId ? { ...entry, remoteId } : entry
      ),
    }));
  };

  const buildPublicEventUrl = (event: EventItem): string | null => {
    const base = getEventPublicBaseUrl();
    if (!base) {
      return null;
    }
    const reference = event.remoteId || event.id;
    return `${base}/?eventRef=${encodeURIComponent(reference)}`;
  };

  const buildPublicAppUrl = (): string | null => {
    const base = getEventPublicBaseUrl();
    if (!base) {
      return null;
    }
    return `${base}/`;
  };

  const syncEventRecord = async (sourceData: AppData, event: EventItem) => {
    const organizer = sourceData.organizers.find((entry) => entry.id === event.organizerId);
    if (!organizer) {
      return {
        ok: false as const,
        reason: t('organizer_not_found_message'),
      };
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        return {
          ok: false as const,
          reason: organizerSync.reason,
        };
      }
      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    if (event.remoteId) {
      const updateResult = await updateEventInSupabase(event, organizerRemoteId, event.remoteId);
      return updateResult.ok
        ? { ok: true as const, data: { id: updateResult.data.id } }
        : { ok: false as const, reason: updateResult.reason };
    }

    const insertResult = await insertEventInSupabase(event, organizerRemoteId);
    if (!insertResult.ok) {
      return {
        ok: false as const,
        reason: insertResult.reason,
      };
    }
    patchEventRemoteId(event.id, insertResult.data.id);
    return {
      ok: true as const,
      data: { id: insertResult.data.id },
    };
  };

  const syncRegistrationRecord = async (sourceData: AppData, registration: RegistrationRecord) => {
    const event = sourceData.events.find((entry) => entry.id === registration.eventId);
    const organizer = sourceData.organizers.find((entry) => entry.id === registration.organizerId);

    if (!event || !organizer) {
      return {
        ok: false as const,
        reason: t('sync_event_or_organizer_missing'),
      };
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        return {
          ok: false as const,
          reason: organizerSync.reason,
        };
      }
      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    let eventRemoteId = event.remoteId;
    if (!eventRemoteId) {
      const eventSync = await insertEventInSupabase(event, organizerRemoteId);
      if (!eventSync.ok) {
        return {
          ok: false as const,
          reason: eventSync.reason,
        };
      }
      eventRemoteId = eventSync.data.id;
      patchEventRemoteId(event.id, eventRemoteId);
    }

    const syncResult = await upsertRegistrationInSupabase({
      registration,
      organizerRemoteId,
      eventRemoteId,
    });

    if (!syncResult.ok) {
      return syncResult;
    }

    patchRegistrationRemoteId(registration.id, syncResult.data.id);
    return syncResult;
  };

  const createOrganizer = async (payload: {
    email: string;
    fiscalData?: string;
    bankAccount?: string;
    organizationName?: string;
    organizationRole: 'presidente_fondazione' | 'segretario_associazione' | 'altro';
    organizationRoleLabel?: string;
    legalRepresentative?: string;
    officialPhone?: string;
  }) => {
    if (ORGANIZER_SECURITY_ENFORCED) {
      const security = await getOrganizerSecurityStatus();
      if (!security.ok || !security.data.securityReady) {
        Alert.alert(
          t('organizer_security_required_title'),
          security.ok ? t('organizer_security_required_message') : security.reason
        );
        setScreen({ name: 'organizerAuth' });
        return;
      }
    }
    const security = await getOrganizerSecurityStatus();
    const email = cleanText(
      security.ok && security.data.securityReady ? security.data.email : payload.email
    ).toLowerCase();
    if (!email.includes('@')) {
      Alert.alert(t('invalid_email_title'), t('invalid_email_message'));
      return;
    }

    if (appData.organizers.some((entry) => entry.email.toLowerCase() === email)) {
      Alert.alert(t('email_already_registered_title'), t('email_already_registered_message'));
      return;
    }

    const risk = scoreOrganizerRisk(payload, appData.organizers);
    const now = new Date().toISOString();

    const organizer: OrganizerProfile = {
      id: randomId('org'),
      email,
      organizationName: cleanText(payload.organizationName ?? ''),
      organizationRole: payload.organizationRole,
      organizationRoleLabel: cleanText(payload.organizationRoleLabel ?? ''),
      legalRepresentative: cleanText(payload.legalRepresentative ?? ''),
      officialPhone: cleanText(payload.officialPhone ?? ''),
      fiscalData: cleanText(payload.fiscalData ?? ''),
      bankAccount: cleanText(payload.bankAccount ?? ''),
      complianceDocuments: {
        identityDocumentUrl: '',
        organizationDocumentUrl: '',
        paymentAuthorizationDocumentUrl: '',
      },
      complianceSubmittedAt: undefined,
      verificationStatus: 'pending_review',
      payoutEnabled: false,
      paidFeatureUnlocked: ORGANIZER_TEST_MODE,
      paidFeatureUnlockRequestedAt: ORGANIZER_TEST_MODE ? now : undefined,
      paidFeatureUnlockContact: PAID_FEATURE_UNLOCK_CONTACT,
      sponsorModuleEnabled: false,
      sponsorModuleActivatedAt: undefined,
      sponsorModuleActivationAmount: SPONSOR_MODULE_ACTIVATION_EUR,
      stripeConnectAccountId: undefined,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
      stripeConnectRequirements: [],
      stripeConnectLastSyncAt: undefined,
      riskScore: risk.score,
      riskFlags: risk.flags,
      verificationChecklist: {
        emailVerified: false,
        fiscalDataVerified: false,
        ibanOwnershipVerified: false,
        identityVerified: false,
        manualReviewPassed: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    let organizerToStore = organizer;
    const syncResult = await upsertOrganizerInSupabase(organizer);

    if (syncResult.ok) {
      organizerToStore = {
        ...organizer,
        remoteId: syncResult.data.id,
        email: syncResult.data.email,
      };
    }

    setAppData((current) => ({
      ...current,
      organizers: [organizerToStore, ...current.organizers],
    }));

    const syncNote = syncResult.ok
      ? t('organizer_sync_ok')
      : t('organizer_sync_fail', { reason: syncResult.reason });

    Alert.alert(
      t('organizer_created_title'),
      t('organizer_created_message', { note: syncNote })
    );

    setScreen({ name: 'organizerCreate', organizerId: organizerToStore.id });
  };

  const createEvent = async (
    organizerId: string,
    payload: {
      eventId?: string;
      name: string;
      location: string;
      date: string;
      endDate: string;
      startTime: string;
      isFree: boolean;
      baseFeeAmount: number;
      feePolicy: 'organizer_absorbs_fees' | 'participant_pays_fees';
      paymentChannel: EventPaymentChannel;
      cashPaymentEnabled: boolean;
      cashPaymentInstructions?: string;
      cashPaymentDeadline?: string;
      registrationOpenDate: string;
      registrationCloseDate: string;
      visibility: 'public' | 'hidden';
      participantAuthMode: 'anonymous' | 'email' | 'social_verified' | 'flexible';
      participantPhoneRequired: boolean;
      privacyText: string;
      logoUrl?: string;
      localSponsor?: string;
      assignNumbers: boolean;
    }
  ) => {
    const name = cleanText(payload.name);
    const location = cleanText(payload.location);

    if (!name || !location) {
      Alert.alert(t('missing_data_title'), t('missing_data_event_message'));
      return;
    }

    const organizer = appData.organizers.find((entry) => entry.id === organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }
    const existingEvent = payload.eventId
      ? appData.events.find((entry) => entry.id === payload.eventId && entry.organizerId === organizerId)
      : undefined;
    if (payload.eventId && !existingEvent) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }
    const canCreatePaid = organizerCanUsePaidSection(organizer, ORGANIZER_TEST_MODE);

    if (!payload.isFree && payload.baseFeeAmount <= 0) {
      Alert.alert(t('fee_missing_title'), t('fee_missing_message'));
      return;
    }

    if (!payload.isFree && !cleanText(organizer.fiscalData ?? '')) {
      Alert.alert(t('missing_data_title'), t('fiscal_required_message'));
      return;
    }

    if (!payload.isFree && !canCreatePaid) {
      Alert.alert(t('payments_disabled_title'), t('payments_disabled_message'));
      return;
    }

    const eventDate = toIsoDate(payload.date);
    const eventEndDate = toIsoDate(payload.endDate);
    const eventStartTime = toIsoTime(payload.startTime);
    const registrationOpenDate = toIsoDate(payload.registrationOpenDate);
    const registrationCloseDate = toIsoDate(payload.registrationCloseDate);

    if (eventEndDate < eventDate) {
      Alert.alert(
        t('registration_window_invalid_title'),
        t('event_date_range_invalid_message')
      );
      return;
    }

    if (!eventStartTime) {
      Alert.alert(t('missing_data_title'), t('event_time_invalid_message'));
      return;
    }

    if (registrationCloseDate < registrationOpenDate) {
      Alert.alert(
        t('registration_window_invalid_title'),
        t('registration_window_invalid_message')
      );
      return;
    }

    if (registrationCloseDate > eventEndDate) {
      Alert.alert(
        t('registration_window_invalid_title'),
        t('registration_window_after_event_message')
      );
      return;
    }

    const cashPaymentDeadline = payload.cashPaymentEnabled
      ? toIsoDate(payload.cashPaymentDeadline ?? '')
      : undefined;
    const cashPaymentInstructions = cleanText(payload.cashPaymentInstructions ?? '');

    if (!payload.isFree && payload.cashPaymentEnabled && !cashPaymentInstructions) {
      Alert.alert(t('missing_data_title'), t('cash_payment_instructions_required'));
      return;
    }

    if (!payload.isFree && payload.cashPaymentEnabled && !payload.cashPaymentDeadline) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_required'));
      return;
    }

    if (cashPaymentDeadline && cashPaymentDeadline < registrationOpenDate) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_before_open'));
      return;
    }

    if (cashPaymentDeadline && cashPaymentDeadline > eventEndDate) {
      Alert.alert(t('missing_data_title'), t('cash_payment_deadline_after_event'));
      return;
    }

    const nextEventKey = buildEventDuplicateKey(name, location, eventDate);
    const duplicateEvent = appData.events.find(
      (entry) =>
        entry.id !== existingEvent?.id &&
        buildEventDuplicateKey(entry.name, entry.location, entry.date) === nextEventKey
    );
    if (duplicateEvent) {
      Alert.alert(
        t('duplicate_event_title'),
        t('duplicate_event_message', {
          event: duplicateEvent.name,
          date: formatDate(duplicateEvent.date),
          location: duplicateEvent.location,
        })
      );
      return;
    }

    const now = new Date().toISOString();
    const visibility = payload.visibility;
    const shouldBePublic = visibility === 'public';
    const closedAt = shouldBePublic ? undefined : existingEvent?.closedAt;
    const registrationsOpen = shouldBePublic
      ? existingEvent?.registrationsOpen ?? true
      : existingEvent?.registrationsOpen ?? false;

    const feePreview = computeEventFeePreview({
      baseFeeAmount: payload.baseFeeAmount,
      isFree: payload.isFree,
      feePolicy: payload.feePolicy,
      paymentChannel: payload.paymentChannel,
    });

    const event: EventItem = {
      id: existingEvent?.id ?? randomId('evt'),
      remoteId: existingEvent?.remoteId,
      organizerId,
      name,
      location,
      date: eventDate,
      endDate: eventEndDate,
      startTime: eventStartTime,
      isFree: payload.isFree,
      feeAmount: feePreview.chargedToParticipant,
      privacyText: cleanText(payload.privacyText) || DEFAULT_PRIVACY_TEXT,
      logoUrl: cleanText(payload.logoUrl ?? ''),
      localSponsor: cleanText(payload.localSponsor ?? ''),
      assignNumbers: payload.assignNumbers,
      registrationOpenDate,
      registrationCloseDate,
      registrationsOpen,
      visibility,
      closedAt,
      definitivePublishedAt: shouldBePublic
        ? existingEvent?.definitivePublishedAt ?? now
        : existingEvent?.definitivePublishedAt,
      seasonVersion: existingEvent?.seasonVersion ?? 1,
      lastParticipantsResetAt: existingEvent?.lastParticipantsResetAt,
      participantAuthMode: payload.participantAuthMode,
      participantPhoneRequired: payload.participantPhoneRequired,
      baseFeeAmount: payload.isFree ? 0 : payload.baseFeeAmount,
      feePolicy: payload.feePolicy,
      paymentChannel: 'stripe',
      cashPaymentEnabled: !payload.isFree && payload.cashPaymentEnabled,
      cashPaymentInstructions: !payload.isFree && payload.cashPaymentEnabled
        ? cashPaymentInstructions
        : '',
      cashPaymentDeadline: !payload.isFree && payload.cashPaymentEnabled
        ? cashPaymentDeadline
        : undefined,
      developerCommissionRate: COMMISSION_RATE,
      providerFeeRate: feePreview.providerFeeRate,
      providerFeeFixed: feePreview.providerFeeFixed,
      organizerNetAmount: feePreview.organizerNetAmount,
      active: shouldBePublic && !closedAt,
      createdAt: existingEvent?.createdAt ?? now,
    };

    const nextData: AppData = {
      ...appData,
      events: existingEvent
        ? appData.events.map((entry) => (entry.id === existingEvent.id ? event : entry))
        : [event, ...appData.events],
    };
    setAppData(nextData);

    const syncResult = await syncEventRecord(nextData, event);
    const syncNote = syncResult.ok
      ? t('event_sync_ok')
      : t('event_sync_fail', { reason: syncResult.reason });

    const alertMessage = existingEvent
      ? t('event_updated_message', { name: event.name, note: syncNote })
      : t('event_created_message', { name: event.name, note: syncNote });
    Alert.alert(
      existingEvent ? t('event_updated_title') : t('event_created_title'),
      alertMessage
    );
    setScreen({ name: 'organizerDashboard', organizerId });
  };

  const createSponsorCheckoutForEvent = async (payload: {
    eventId: string;
    sponsorName: string;
    sponsorNameIt?: string;
    sponsorNameEn?: string;
    sponsorUrl?: string;
    sponsorLogoUrl?: string;
    sponsorEmail?: string;
    packageDays: number;
    amount: number;
  }) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const event = sourceData.events.find((entry) => entry.id === payload.eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    const organizer = sourceData.organizers.find((entry) => entry.id === event.organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        Alert.alert(t('sponsor_checkout_fail_title'), organizerSync.reason);
        return;
      }

      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    let eventRemoteId = event.remoteId;
    if (!eventRemoteId) {
      const eventSync = await insertEventInSupabase(event, organizerRemoteId);
      if (!eventSync.ok) {
        Alert.alert(t('sponsor_checkout_fail_title'), eventSync.reason);
        return;
      }
      eventRemoteId = eventSync.data.id;
      patchEventRemoteId(event.id, eventRemoteId);
    }

    if (!eventRemoteId) {
      Alert.alert(t('sponsor_checkout_fail_title'), t('sponsor_event_remote_missing'));
      return;
    }

    const sponsorCheckout = await createSponsorCheckout({
      eventId: eventRemoteId,
      sponsorName: payload.sponsorName,
      sponsorNameIt: payload.sponsorNameIt,
      sponsorNameEn: payload.sponsorNameEn,
      sponsorUrl: payload.sponsorUrl,
      sponsorLogoUrl: payload.sponsorLogoUrl,
      sponsorEmail: payload.sponsorEmail,
      packageDays: payload.packageDays,
      amount: payload.amount,
      currency: 'EUR',
    });

    if (!sponsorCheckout.ok) {
      Alert.alert(t('sponsor_checkout_fail_title'), sponsorCheckout.reason);
      return;
    }

    setAppData((current) => {
      const slotFromDb = mapSponsorRowToSlot(sponsorCheckout.data.sponsorSlot, current);
      const slot: SponsorSlot = {
        ...slotFromDb,
        eventId: event.id,
        eventRemoteId,
        organizerId: organizer.id,
        organizerRemoteId,
      };
      const existing = current.sponsorSlots.filter((entry) => entry.id !== slot.id);
      return {
        ...current,
        sponsorSlots: [slot, ...existing],
      };
    });

    Alert.alert(
      t('sponsor_checkout_title'),
      t('sponsor_checkout_message', {
        url: sponsorCheckout.data.checkoutUrl ?? 'N/D',
      })
    );
  };

  const updateOrganizerCompliance = async (payload: {
    organizerId: string;
    organizationName: string;
    organizationRole: 'presidente_fondazione' | 'segretario_associazione' | 'altro';
    organizationRoleLabel?: string;
    legalRepresentative: string;
    officialPhone: string;
    fiscalData: string;
    bankAccount: string;
    identityDocumentUrl: string;
    organizationDocumentUrl: string;
    paymentAuthorizationDocumentUrl: string;
    adminContactMessage?: string;
    silent?: boolean;
  }) => {
    const now = new Date().toISOString();
    const updatedOrganizer = appData.organizers.find((entry) => entry.id === payload.organizerId);
    if (!updatedOrganizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    const nextOrganizer: OrganizerProfile = {
      ...updatedOrganizer,
      organizationName: cleanText(payload.organizationName),
      organizationRole: payload.organizationRole,
      organizationRoleLabel: cleanText(payload.organizationRoleLabel ?? ''),
      legalRepresentative: cleanText(payload.legalRepresentative),
      officialPhone: cleanText(payload.officialPhone),
      fiscalData: cleanText(payload.fiscalData),
      bankAccount: cleanText(payload.bankAccount),
      complianceDocuments: {
        identityDocumentUrl: cleanText(payload.identityDocumentUrl),
        organizationDocumentUrl: cleanText(payload.organizationDocumentUrl),
        paymentAuthorizationDocumentUrl: cleanText(payload.paymentAuthorizationDocumentUrl),
        adminContactMessage: cleanText(payload.adminContactMessage ?? ''),
      },
      complianceSubmittedAt: now,
      updatedAt: now,
    };

    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((entry) =>
        entry.id === payload.organizerId ? nextOrganizer : entry
      ),
    }));

    const syncResult = await upsertOrganizerInSupabase(nextOrganizer);
    if (!syncResult.ok) {
      if (!payload.silent) {
        Alert.alert(
          t('organizer_documents_saved_title'),
          t('organizer_documents_saved_local', { reason: syncResult.reason })
        );
      }
      return;
    }

    patchOrganizerRemoteId(nextOrganizer.id, syncResult.data.id);
    if (nextOrganizer.email !== syncResult.data.email) {
      patchOrganizerEmail(nextOrganizer.id, syncResult.data.email);
    }

    if (!payload.silent) {
      Alert.alert(t('organizer_documents_saved_title'), t('organizer_documents_saved_ok'));
    }
  };

  const sendOrganizerComplianceToAdmin = async (payload: {
    organizerId: string;
    organizationName: string;
    organizationRole: 'presidente_fondazione' | 'segretario_associazione' | 'altro';
    organizationRoleLabel?: string;
    legalRepresentative: string;
    officialPhone: string;
    fiscalData: string;
    bankAccount: string;
    adminContactMessage: string;
    attachments: OrganizerComplianceAttachment[];
  }) => {
    const organizer = appData.organizers.find((entry) => entry.id === payload.organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    const identityDocument = payload.attachments.find(
      (entry) => entry.kind === 'identity_document'
    );
    const organizationDocument = payload.attachments.find(
      (entry) => entry.kind === 'organization_document'
    );
    const paymentAuthorizationDocument = payload.attachments.find(
      (entry) => entry.kind === 'payment_authorization_document'
    );

    if (!identityDocument || !organizationDocument) {
      Alert.alert(
        t('organizer_documents_saved_title'),
        t('organizer_documents_missing_for_email')
      );
      return;
    }

    await updateOrganizerCompliance({
      organizerId: payload.organizerId,
      organizationName: payload.organizationName,
      organizationRole: payload.organizationRole,
      organizationRoleLabel: payload.organizationRoleLabel,
      legalRepresentative: payload.legalRepresentative,
      officialPhone: payload.officialPhone,
      fiscalData: payload.fiscalData,
      bankAccount: payload.bankAccount,
      identityDocumentUrl: identityDocument.fileName,
      organizationDocumentUrl: organizationDocument.fileName,
      paymentAuthorizationDocumentUrl: paymentAuthorizationDocument?.fileName ?? '',
      adminContactMessage: payload.adminContactMessage,
      silent: true,
    });

    const emailResult = await sendOrganizerComplianceEmail({
      organizerEmail: organizer.email,
      organizationName: payload.organizationName,
      organizationRole: payload.organizationRole,
      organizationRoleLabel: payload.organizationRoleLabel,
      legalRepresentative: payload.legalRepresentative,
      officialPhone: payload.officialPhone,
      fiscalData: payload.fiscalData,
      bankAccount: payload.bankAccount,
      adminContactMessage: payload.adminContactMessage,
      attachments: payload.attachments,
    });

    if (!emailResult.sent) {
      Alert.alert(
        t('organizer_documents_email_title'),
        t('organizer_documents_email_fail', {
          detail: emailResult.detail ?? `HTTP ${emailResult.statusCode ?? 'N/D'}`,
        })
      );
      return;
    }

    const modeLabel =
      emailResult.mode === 'simulated'
        ? t('organizer_documents_email_mode_simulated')
        : t('organizer_documents_email_mode_sent');
    Alert.alert(
      t('organizer_documents_email_title'),
      t('organizer_documents_email_ok', {
        email: ADMIN_CONTACT_EMAIL,
        mode: modeLabel,
      })
    );
  };

  const requestPaidFeatureUnlock = async (organizerId: string) => {
    const organizer = appData.organizers.find((entry) => entry.id === organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    const now = new Date().toISOString();
    const updatedOrganizer: OrganizerProfile = {
      ...organizer,
      paidFeatureUnlockRequestedAt: now,
      paidFeatureUnlockContact: PAID_FEATURE_UNLOCK_CONTACT,
      updatedAt: now,
    };

    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((entry) =>
        entry.id === organizerId ? updatedOrganizer : entry
      ),
    }));

    const syncResult = await upsertOrganizerInSupabase(updatedOrganizer);
    const syncText = syncResult.ok
      ? t('organizer_sync_ok')
      : t('organizer_sync_fail', { reason: syncResult.reason });

    Alert.alert(
      t('request_paid_unlock_title'),
      t('request_paid_unlock_message', {
        contact: PAID_FEATURE_UNLOCK_CONTACT,
        sync: syncText,
      })
    );
  };

  const activateSponsorModuleForOrganizer = async (organizerId: string) => {
    const organizer = appData.organizers.find((entry) => entry.id === organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    if (organizer.sponsorModuleEnabled) {
      Alert.alert(
        t('sponsor_module_already_active_title'),
        t('sponsor_module_already_active_message')
      );
      return;
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        Alert.alert(t('sponsor_module_checkout_fail_title'), organizerSync.reason);
        return;
      }

      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    if (!organizerRemoteId) {
      Alert.alert(t('sponsor_module_checkout_fail_title'), t('organizer_not_found_message'));
      return;
    }

    const checkout = await createSponsorModuleCheckout({
      organizerId: organizerRemoteId,
    });

    if (!checkout.ok) {
      Alert.alert(t('sponsor_module_checkout_fail_title'), checkout.reason);
      return;
    }

    if (checkout.data.state === 'already_active') {
      Alert.alert(
        t('sponsor_module_already_active_title'),
        t('sponsor_module_already_active_message')
      );
      return;
    }

    if (!checkout.data.checkoutUrl) {
      Alert.alert(
        t('sponsor_module_checkout_fail_title'),
        t('sponsor_module_checkout_url_missing')
      );
      return;
    }

    let opened = false;
    try {
      const canOpen = await Linking.canOpenURL(checkout.data.checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkout.data.checkoutUrl);
        opened = true;
      }
    } catch {
      opened = false;
    }

    Alert.alert(
      t('sponsor_module_checkout_opened_title'),
      t('sponsor_module_checkout_opened_message', {
        url: checkout.data.checkoutUrl,
        openResult: opened
          ? t('sponsor_module_checkout_opened_ok')
          : t('sponsor_module_checkout_opened_manual'),
      })
    );
  };

  const applyStripeConnectState = (
    organizerId: string,
    state: {
      accountId?: string;
      chargesEnabled?: boolean;
      payoutsEnabled?: boolean;
      detailsSubmitted?: boolean;
      requirements?: string[];
      status: 'not_connected' | 'onboarding' | 'ready';
    }
  ) => {
    const now = new Date().toISOString();
    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((entry) => {
        if (entry.id !== organizerId) {
          return entry;
        }
        if (state.status === 'not_connected') {
          return {
            ...entry,
            stripeConnectAccountId: undefined,
            stripeConnectChargesEnabled: false,
            stripeConnectPayoutsEnabled: false,
            stripeConnectDetailsSubmitted: false,
            stripeConnectRequirements: state.requirements ?? [],
            stripeConnectLastSyncAt: now,
            payoutEnabled: false,
            updatedAt: now,
          };
        }
        const chargesEnabled = Boolean(state.chargesEnabled);
        const payoutsEnabled = Boolean(state.payoutsEnabled);
        return {
          ...entry,
          stripeConnectAccountId: state.accountId ?? entry.stripeConnectAccountId,
          stripeConnectChargesEnabled: chargesEnabled,
          stripeConnectPayoutsEnabled: payoutsEnabled,
          stripeConnectDetailsSubmitted: Boolean(state.detailsSubmitted),
          stripeConnectRequirements: state.requirements ?? entry.stripeConnectRequirements ?? [],
          stripeConnectLastSyncAt: now,
          payoutEnabled: chargesEnabled && payoutsEnabled,
          updatedAt: now,
        };
      }),
    }));
  };

  const startStripeConnectForOrganizer = async (organizerId: string) => {
    const organizer = appData.organizers.find((entry) => entry.id === organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    const securityReady = await refreshOrganizerSecurityState(true);
    if (!securityReady) {
      return;
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        Alert.alert(t('stripe_connect_error_title'), organizerSync.reason);
        return;
      }

      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    if (!organizerRemoteId) {
      Alert.alert(t('stripe_connect_error_title'), t('organizer_not_found_message'));
      return;
    }

    const connect = await startStripeConnectOnboarding({
      organizerId: organizerRemoteId,
    });

    if (!connect.ok) {
      Alert.alert(t('stripe_connect_error_title'), connect.reason);
      return;
    }

    applyStripeConnectState(organizer.id, {
      accountId: connect.data.accountId,
      chargesEnabled: connect.data.chargesEnabled,
      payoutsEnabled: connect.data.payoutsEnabled,
      detailsSubmitted: connect.data.detailsSubmitted,
      requirements: connect.data.requirements,
      status: connect.data.state,
    });

    if (connect.data.state === 'ready' && !connect.data.onboardingUrl) {
      Alert.alert(t('stripe_connect_ready_title'), t('stripe_connect_ready_message'));
      return;
    }

    if (!connect.data.onboardingUrl) {
      Alert.alert(t('stripe_connect_error_title'), t('stripe_connect_url_missing'));
      return;
    }

    let opened = false;
    try {
      const canOpen = await Linking.canOpenURL(connect.data.onboardingUrl);
      if (canOpen) {
        await Linking.openURL(connect.data.onboardingUrl);
        opened = true;
      }
    } catch {
      opened = false;
    }

    Alert.alert(
      t('stripe_connect_onboarding_opened_title'),
      t('stripe_connect_onboarding_opened_message', {
        url: connect.data.onboardingUrl,
        openResult: opened
          ? t('stripe_connect_onboarding_opened_ok')
          : t('stripe_connect_onboarding_opened_manual'),
      })
    );
  };

  const syncStripeConnectForOrganizer = async (organizerId: string, showAlert = true) => {
    const organizer = appData.organizers.find((entry) => entry.id === organizerId);
    if (!organizer) {
      Alert.alert(t('organizer_not_found_title'), t('organizer_not_found_message'));
      return;
    }

    const securityReady = await refreshOrganizerSecurityState(true);
    if (!securityReady) {
      return;
    }

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (!organizerSync.ok) {
        Alert.alert(t('stripe_connect_error_title'), organizerSync.reason);
        return;
      }
      organizerRemoteId = organizerSync.data.id;
      patchOrganizerRemoteId(organizer.id, organizerRemoteId);
      if (organizer.email !== organizerSync.data.email) {
        patchOrganizerEmail(organizer.id, organizerSync.data.email);
      }
    }

    if (!organizerRemoteId) {
      Alert.alert(t('stripe_connect_error_title'), t('organizer_not_found_message'));
      return;
    }

    const syncResult = await syncStripeConnectStatus({
      organizerId: organizerRemoteId,
    });

    if (!syncResult.ok) {
      Alert.alert(t('stripe_connect_error_title'), syncResult.reason);
      return;
    }

    applyStripeConnectState(organizer.id, {
      accountId: syncResult.data.accountId,
      chargesEnabled: syncResult.data.chargesEnabled,
      payoutsEnabled: syncResult.data.payoutsEnabled,
      detailsSubmitted: syncResult.data.detailsSubmitted,
      requirements: syncResult.data.requirements,
      status: syncResult.data.state,
    });

    if (showAlert) {
      Alert.alert(
        t('stripe_connect_sync_title'),
        t('stripe_connect_sync_message', {
          status:
            syncResult.data.state === 'ready'
              ? t('stripe_connect_status_ready')
              : syncResult.data.state === 'onboarding'
                ? t('stripe_connect_status_pending')
                : t('stripe_connect_status_not_connected'),
        })
      );
    }
  };

  const toggleEventActive = async (eventId: string) => {
    const sourceData = appData;
    const targetEvent = sourceData.events.find((entry) => entry.id === eventId);
    if (!targetEvent) {
      return;
    }

    const now = new Date().toISOString();
    const nextActive = !targetEvent.active;
    const updatedEvent: EventItem = {
      ...targetEvent,
      active: nextActive,
      visibility: nextActive ? 'public' : 'hidden',
      closedAt: nextActive ? undefined : targetEvent.closedAt ?? now,
      definitivePublishedAt: nextActive
        ? targetEvent.definitivePublishedAt ?? now
        : targetEvent.definitivePublishedAt,
      registrationsOpen: nextActive ? targetEvent.registrationsOpen : false,
    };

    const nextData: AppData = {
      ...sourceData,
      events: sourceData.events.map((entry) => (entry.id === eventId ? updatedEvent : entry)),
    };
    setAppData(nextData);
    const syncResult = await syncEventRecord(nextData, updatedEvent);
    if (!syncResult.ok) {
      Alert.alert(t('sync_not_completed_title'), syncResult.reason);
    }
  };

  const toggleEventRegistrations = async (eventId: string) => {
    const sourceData = appData;
    const targetEvent = sourceData.events.find((entry) => entry.id === eventId);
    if (!targetEvent) {
      return;
    }

    const updatedEvent: EventItem = {
      ...targetEvent,
      registrationsOpen: !targetEvent.registrationsOpen,
    };

    const nextData: AppData = {
      ...sourceData,
      events: sourceData.events.map((entry) => (entry.id === eventId ? updatedEvent : entry)),
    };
    setAppData(nextData);
    const syncResult = await syncEventRecord(nextData, updatedEvent);
    if (!syncResult.ok) {
      Alert.alert(t('sync_not_completed_title'), syncResult.reason);
    }
  };

  const closeEventCompletely = async (eventId: string) => {
    const sourceData = appData;
    const targetEvent = sourceData.events.find((entry) => entry.id === eventId);
    if (!targetEvent) {
      return;
    }

    const now = new Date().toISOString();
    const updatedEvent: EventItem = {
      ...targetEvent,
      active: false,
      visibility: 'hidden',
      registrationsOpen: false,
      closedAt: now,
    };

    const nextData: AppData = {
      ...sourceData,
      events: sourceData.events.map((entry) => (entry.id === eventId ? updatedEvent : entry)),
    };
    setAppData(nextData);
    const syncResult = await syncEventRecord(nextData, updatedEvent);
    if (!syncResult.ok) {
      Alert.alert(t('sync_not_completed_title'), syncResult.reason);
      return;
    }
    Alert.alert(t('event_closed_title'), t('event_closed_message'));
  };

  const reopenEventForNewSeason = async (eventId: string) => {
    const sourceData = appData;
    const targetEvent = sourceData.events.find((entry) => entry.id === eventId);
    if (!targetEvent) {
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const resetAt = new Date().toISOString();
    const targetEndDate = targetEvent.endDate || targetEvent.date;
    const nextEventDate =
      targetEvent.date < todayIso ? addYearsIso(targetEvent.date || todayIso, 1) : targetEvent.date;
    const candidateNextEventEndDate =
      targetEndDate < todayIso ? addYearsIso(targetEndDate || nextEventDate, 1) : targetEndDate;
    const nextEventEndDate =
      candidateNextEventEndDate < nextEventDate ? nextEventDate : candidateNextEventEndDate;
    const nextRegistrationCloseDate =
      targetEvent.registrationCloseDate < todayIso
        ? nextEventEndDate
        : targetEvent.registrationCloseDate > nextEventEndDate
          ? nextEventEndDate
          : targetEvent.registrationCloseDate;

    const updatedEvent: EventItem = {
      ...targetEvent,
      date: nextEventDate,
      endDate: nextEventEndDate,
      registrationOpenDate: todayIso,
      registrationCloseDate: nextRegistrationCloseDate,
      registrationsOpen: true,
      active: false,
      visibility: 'hidden',
      closedAt: undefined,
      definitivePublishedAt: undefined,
      seasonVersion: (targetEvent.seasonVersion || 1) + 1,
      lastParticipantsResetAt: resetAt,
    };

    const nextData: AppData = {
      ...sourceData,
      events: sourceData.events.map((entry) => (entry.id === eventId ? updatedEvent : entry)),
      registrations: sourceData.registrations.filter((entry) => entry.eventId !== eventId),
      paymentIntents: sourceData.paymentIntents.filter((entry) => entry.eventId !== eventId),
    };
    setAppData(nextData);

    const syncResult = await syncEventRecord(nextData, updatedEvent);
    if (!syncResult.ok) {
      Alert.alert(t('sync_not_completed_title'), syncResult.reason);
      return;
    }

    Alert.alert(t('event_reopened_title'), t('event_reopened_message'));
    setScreen({
      name: 'organizerCreate',
      organizerId: targetEvent.organizerId,
      eventId: targetEvent.id,
    });
  };

  const exportEventCsv = async (eventId: string) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const event = sourceData.events.find((entry) => entry.id === eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    const eventRegistrations = sourceData.registrations.filter((entry) => entry.eventId === event.id);
    const eventPaymentIntents = sourceData.paymentIntents.filter((entry) => entry.eventId === event.id);

    const result = await exportEventRegistrationsCsv(event, eventRegistrations, eventPaymentIntents);
    if (!result.ok) {
      Alert.alert(t('export_not_available_title'), result.reason);
      return;
    }

    if (result.uri) {
      Alert.alert(t('file_generated_title'), t('file_generated_message', { uri: result.uri }));
    }
  };

  const exportEventPdf = async (eventId: string) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const event = sourceData.events.find((entry) => entry.id === eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    const eventRegistrations = sourceData.registrations.filter((entry) => entry.eventId === event.id);
    const eventPaymentIntents = sourceData.paymentIntents.filter((entry) => entry.eventId === event.id);

    const result = await exportEventRegistrationsPdf(event, eventRegistrations, eventPaymentIntents);
    if (!result.ok) {
      Alert.alert(t('export_not_available_title'), result.reason);
      return;
    }

    if (result.uri) {
      Alert.alert(t('file_generated_title'), t('file_generated_message', { uri: result.uri }));
    }
  };

  const completeFreeRegistration = async (eventId: string, draft: RegistrationDraft) => {
    if (!ensureDraftConsents(draft)) {
      return;
    }

    const sourceData = withExpiredSessionsHandled(appData);
    const event = sourceData.events.find((entry) => entry.id === eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    if (!isRegistrationWindowOpen(event)) {
      Alert.alert(
        t('registration_window_closed_title'),
        t('registration_window_closed_message', {
          from: formatDate(event.registrationOpenDate),
          to: formatDate(event.registrationCloseDate),
        })
      );
      return;
    }

    const participantAuthAllowed = await ensureParticipantAuthForEvent(event, draft);
    if (!participantAuthAllowed) {
      return;
    }

    await showRegistrationCountdown(event);

    try {
      const now = new Date().toISOString();
      const groupParticipantsCount = Math.max(1, draft.groupParticipantsCount || 1);
      const registration: RegistrationRecord = {
        id: randomId('reg'),
        eventId,
        organizerId: event.organizerId,
        fullName: cleanText(draft.fullName),
        email: cleanText(draft.email).toLowerCase(),
        phone: cleanText(draft.phone),
        city: cleanText(draft.city),
        birthDate: cleanText(draft.birthDate),
        privacyConsent: draft.privacyConsent,
        retentionConsent: draft.retentionConsent,
        groupParticipantsCount,
        assignedNumber: event.assignNumbers ? getNextAssignedNumber(sourceData, eventId) : undefined,
        registrationCode: buildRegistrationCode(event.name),
        registrationStatus: 'paid',
        paymentIntentId: undefined,
        paymentStatus: 'not_required',
        paymentAmount: 0,
        paymentMethod: undefined,
        paymentReference: undefined,
        paymentSessionExpiresAt: undefined,
        paymentCapturedAt: now,
        paymentFailedReason: undefined,
        refundedAt: undefined,
        commissionAmount: 0,
        createdAt: now,
        updatedAt: now,
      };

      const nextData: AppData = {
        ...sourceData,
        registrations: [registration, ...sourceData.registrations],
      };

      setAppData(nextData);

      const syncResult = await syncRegistrationRecord(nextData, registration);

      const emailResult = await sendConfirmationEmail({
        participantEmail: registration.email,
        participantName: registration.fullName,
        eventName: event.name,
        amount: registration.paymentAmount,
        registrationCode: registration.registrationCode,
        assignedNumber: registration.assignedNumber,
        groupParticipantsCount: registration.groupParticipantsCount,
      });

      setFreeInterstitial({
        eventName: event.name,
        registrationCode: registration.registrationCode,
        sponsor: event.localSponsor,
      });

      const emailText = !emailResult.sent
        ? t('email_failed', {
            detail: emailResult.detail ?? `HTTP ${emailResult.statusCode ?? 'N/D'}`,
          })
        : emailResult.mode === 'simulated'
          ? t('email_simulated')
          : t('email_sent');
      const syncText = syncResult.ok
        ? t('sync_ok_registration')
        : t('sync_local_registration', { reason: syncResult.reason });

      const numberLine =
        typeof registration.assignedNumber === 'number'
          ? t('number_assigned_line', { number: registration.assignedNumber })
          : '';
      const groupLine =
        registration.groupParticipantsCount > 1
          ? `\n${t('group_participants_line', { count: registration.groupParticipantsCount })}`
          : '';

      Alert.alert(
        t('registration_completed_title'),
        `${t('registration_completed_message', {
          code: registration.registrationCode,
          number: numberLine,
          email: emailText,
          sync: syncText,
        })}${groupLine}`
      );

      setScreen({ name: 'participantSearch' });
    } finally {
      setProcessingInterstitial(null);
    }
  };

  const openPaidRegistration = async (eventId: string, draft: RegistrationDraft) => {
    if (!ensureDraftConsents(draft)) {
      return;
    }

    const sourceData = withExpiredSessionsHandled(appData);
    const event = sourceData.events.find((entry) => entry.id === eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    if (!isRegistrationWindowOpen(event)) {
      Alert.alert(
        t('registration_window_closed_title'),
        t('registration_window_closed_message', {
          from: formatDate(event.registrationOpenDate),
          to: formatDate(event.registrationCloseDate),
        })
      );
      return;
    }

    const participantAuthAllowed = await ensureParticipantAuthForEvent(event, draft);
    if (!participantAuthAllowed) {
      return;
    }

    const organizer = sourceData.organizers.find((entry) => entry.id === event.organizerId);
    if (!organizer || !organizerCanUsePaidSection(organizer, ORGANIZER_TEST_MODE)) {
      Alert.alert(t('payment_not_available_title'), t('payment_not_available_message'));
      return;
    }

    const normalizedEmail = cleanText(draft.email).toLowerCase();
    const existingPending = sourceData.registrations.find(
      (entry) =>
        entry.eventId === eventId &&
        entry.email === normalizedEmail &&
        (entry.registrationStatus === 'pending_payment' ||
          entry.registrationStatus === 'pending_cash') &&
        !isPaymentSessionExpired(entry.paymentSessionExpiresAt)
    );

    if (existingPending) {
      Alert.alert(
        t('existing_pending_title'),
        t('existing_pending_message')
      );
      setScreen({ name: 'participantPayment', registrationId: existingPending.id });
      return;
    }

    await showRegistrationCountdown(event);

    try {
      const now = new Date().toISOString();
      const groupParticipantsCount = Math.max(1, draft.groupParticipantsCount || 1);
      const registrationId = randomId('reg');
      const paymentIntentId = randomId('pi');
      const expiresAt = addMinutesIso(PAYMENT_SESSION_MINUTES);
      const paymentAmount = Number.parseFloat((event.feeAmount * groupParticipantsCount).toFixed(2));
      const commissionAmount = Number.parseFloat(
        (event.baseFeeAmount * groupParticipantsCount * COMMISSION_RATE).toFixed(2)
      );

      const registration: RegistrationRecord = {
        id: registrationId,
        eventId,
        organizerId: event.organizerId,
        fullName: cleanText(draft.fullName),
        email: normalizedEmail,
        phone: cleanText(draft.phone),
        city: cleanText(draft.city),
        birthDate: cleanText(draft.birthDate),
        privacyConsent: draft.privacyConsent,
        retentionConsent: draft.retentionConsent,
        groupParticipantsCount,
        assignedNumber: undefined,
        registrationCode: buildRegistrationCode(event.name),
        registrationStatus: 'pending_payment',
        paymentIntentId,
        paymentStatus: 'pending',
        paymentAmount,
        paymentMethod: undefined,
        paymentReference: undefined,
        paymentSessionExpiresAt: expiresAt,
        paymentCapturedAt: undefined,
        paymentFailedReason: undefined,
        refundedAt: undefined,
        commissionAmount,
        createdAt: now,
        updatedAt: now,
      };

      const paymentIntent: PaymentIntentRecord = {
        id: paymentIntentId,
        registrationId,
        eventId,
        organizerId: event.organizerId,
        provider: 'stripe',
        currency: 'EUR',
        amount: paymentAmount,
        status: 'pending',
        idempotencyKey: randomId('idem'),
        providerPaymentIntentId: undefined,
        webhookEventId: undefined,
        failureReason: undefined,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };

      const nextData: AppData = {
        ...sourceData,
        registrations: [registration, ...sourceData.registrations],
        paymentIntents: [paymentIntent, ...sourceData.paymentIntents],
      };

      setAppData(nextData);
      const syncResult = await syncRegistrationRecord(nextData, registration);
      if (!syncResult.ok) {
        Alert.alert(
          t('sync_not_completed_title'),
          t('sync_not_completed_message', { reason: syncResult.reason })
        );
      }
      setScreen({ name: 'participantPayment', registrationId });
    } finally {
      setProcessingInterstitial(null);
    }
  };

  const confirmPaidRegistration = async (registrationId: string, payment: PaymentInput) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const registration = sourceData.registrations.find((entry) => entry.id === registrationId);
    if (!registration) {
      Alert.alert(t('session_not_found_title'), t('session_not_found_message'));
      return;
    }

    if (registration.registrationStatus === 'paid') {
      Alert.alert(t('payment_already_confirmed_title'), t('payment_already_confirmed_message'));
      setScreen({ name: 'participantSearch' });
      return;
    }

    if (
      registration.registrationStatus !== 'pending_payment' &&
      registration.registrationStatus !== 'pending_cash'
    ) {
      Alert.alert(t('invalid_state_title'), t('invalid_state_message', { status: registration.registrationStatus }));
      setScreen({ name: 'participantSearch' });
      return;
    }

    if (!registration.paymentIntentId) {
      Alert.alert(t('payment_error_title'), t('payment_intent_missing_message'));
      return;
    }

    const paymentIntent = sourceData.paymentIntents.find(
      (entry) => entry.id === registration.paymentIntentId
    );

    if (!paymentIntent) {
      Alert.alert(t('payment_error_title'), t('payment_intent_not_found_message'));
      return;
    }

    const event = sourceData.events.find((entry) => entry.id === registration.eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    if (payment.method === 'cash') {
      if (!event.cashPaymentEnabled) {
        Alert.alert(t('missing_data_title'), t('cash_payment_not_enabled_message'));
        return;
      }

      const deadlineDate = event.cashPaymentDeadline ?? event.registrationCloseDate;
      const cashSessionExpiresAt = `${deadlineDate}T23:59:59.999Z`;
      if (new Date(cashSessionExpiresAt).getTime() < Date.now()) {
        Alert.alert(t('missing_data_title'), t('cash_payment_deadline_expired'));
        return;
      }

      const now = new Date().toISOString();
      const nextData: AppData = {
        ...sourceData,
        registrations: sourceData.registrations.map((entry) =>
          entry.id === registrationId
            ? {
                ...entry,
                registrationStatus: 'pending_cash',
                paymentStatus: 'requires_action',
                paymentMethod: 'cash',
                paymentReference:
                  cleanText(payment.reference) ||
                  entry.paymentReference ||
                  `CASH-${Date.now().toString().slice(-8)}`,
                paymentSessionExpiresAt: cashSessionExpiresAt,
                paymentFailedReason: undefined,
                updatedAt: now,
              }
            : entry
        ),
        paymentIntents: sourceData.paymentIntents.map((entry) =>
          entry.id === paymentIntent.id
            ? {
                ...entry,
                provider: 'manual_demo',
                status: 'requires_action',
                expiresAt: cashSessionExpiresAt,
                failureReason: undefined,
                updatedAt: now,
              }
            : entry
        ),
      };

      setAppData(nextData);
      const updatedRegistration = nextData.registrations.find((entry) => entry.id === registrationId);
      const syncResult = updatedRegistration
        ? await syncRegistrationRecord(nextData, updatedRegistration)
        : { ok: false as const, reason: t('update_error_message') };

      Alert.alert(
        t('cash_payment_request_title'),
        t('cash_payment_request_message', {
          deadline: formatDate(deadlineDate),
          instructions: cleanText(event.cashPaymentInstructions ?? '') || t('cash_payment_missing_instructions'),
          sync: syncResult.ok
            ? t('sync_state_ok')
            : t('sync_state_fail', { reason: syncResult.reason }),
        })
      );

      setScreen({ name: 'participantSearch' });
      return;
    }

    if (!IS_DEMO_CHANNEL) {
      let remoteRegistrationId = registration.remoteId;
      if (!remoteRegistrationId) {
        const registrationSync = await syncRegistrationRecord(sourceData, registration);
        if (!registrationSync.ok) {
          Alert.alert(
            t('sync_not_completed_title'),
            t('sync_not_completed_message', { reason: registrationSync.reason })
          );
          return;
        }
        remoteRegistrationId = registrationSync.data.id;
      }

      const checkout = await createParticipantCheckout({
        registrationRemoteId: remoteRegistrationId,
      });
      if (!checkout.ok) {
        Alert.alert(t('payment_error_title'), checkout.reason);
        return;
      }

      const remote = checkout.data;
      const now = new Date().toISOString();
      const updatedRegistration: RegistrationRecord = {
        ...registration,
        remoteId: remote.remoteRegistrationId,
        registrationStatus: remote.registrationStatus,
        paymentStatus: remote.paymentStatus,
        paymentMethod: 'stripe',
        paymentReference: remote.paymentReference ?? registration.paymentReference,
        assignedNumber: remote.assignedNumber ?? registration.assignedNumber,
        paymentSessionExpiresAt:
          remote.sessionExpiresAt ?? registration.paymentSessionExpiresAt,
        paymentCapturedAt: remote.paymentCapturedAt ?? registration.paymentCapturedAt,
        paymentFailedReason:
          remote.paymentFailedReason ??
          (remote.registrationStatus === 'payment_failed'
            ? registration.paymentFailedReason
            : undefined),
        refundedAt: remote.refundedAt ?? registration.refundedAt,
        updatedAt: now,
      };

      setAppData((current) => {
        return {
          ...current,
          registrations: current.registrations.map((entry) =>
            entry.id === registrationId ? { ...entry, ...updatedRegistration } : entry
          ),
          paymentIntents: current.paymentIntents.map((entry) =>
            entry.id === paymentIntent.id
              ? {
                  ...entry,
                  provider: 'stripe',
                  status: remote.paymentStatus,
                  providerPaymentIntentId:
                    remote.providerPaymentIntentId ?? entry.providerPaymentIntentId,
                  failureReason: remote.paymentFailedReason ?? undefined,
                  expiresAt: remote.sessionExpiresAt ?? entry.expiresAt,
                  updatedAt: now,
                }
              : entry
          ),
        };
      });

      if (remote.state === 'checkout') {
        if (!remote.checkoutUrl) {
          Alert.alert(t('payment_error_title'), t('payment_checkout_url_missing'));
          return;
        }

        let opened = false;
        try {
          const canOpen = await Linking.canOpenURL(remote.checkoutUrl);
          if (canOpen) {
            await Linking.openURL(remote.checkoutUrl);
            opened = true;
          }
        } catch {
          opened = false;
        }

        Alert.alert(
          t('payment_checkout_opened_title'),
          t('payment_checkout_opened_message', {
            url: remote.checkoutUrl,
            openResult: opened
              ? t('payment_checkout_opened_ok')
              : t('payment_checkout_opened_manual'),
          })
        );
        setScreen({ name: 'participantSearch' });
        return;
      }

      if (updatedRegistration.registrationStatus !== 'paid') {
        Alert.alert(
          t('payment_not_completed_title'),
          t('payment_not_completed_message', {
            status: updatedRegistration.registrationStatus,
            reason: updatedRegistration.paymentFailedReason ?? t('retry_payment_reason'),
            sync: t('sync_state_ok'),
          })
        );
        setScreen({ name: 'participantSearch' });
        return;
      }

      const emailResult = await sendConfirmationEmail({
        participantEmail: updatedRegistration.email,
        participantName: updatedRegistration.fullName,
        eventName: event.name,
        amount: updatedRegistration.paymentAmount,
        registrationCode: updatedRegistration.registrationCode,
        assignedNumber: updatedRegistration.assignedNumber,
        groupParticipantsCount: updatedRegistration.groupParticipantsCount,
      });

      const emailText = !emailResult.sent
        ? t('email_failed', {
            detail: emailResult.detail ?? `HTTP ${emailResult.statusCode ?? 'N/D'}`,
          })
        : emailResult.mode === 'simulated'
          ? t('email_simulated')
          : t('email_sent');

      Alert.alert(
        t('payment_confirmed_title'),
        `${t('payment_confirmed_message', {
          code: updatedRegistration.registrationCode,
          number:
            typeof updatedRegistration.assignedNumber === 'number'
              ? t('number_assigned_line', { number: updatedRegistration.assignedNumber })
              : '',
          email: emailText,
          sync: t('sync_state_ok'),
        })}${
          updatedRegistration.groupParticipantsCount > 1
            ? `\n${t('group_participants_line', {
                count: updatedRegistration.groupParticipantsCount,
              })}`
            : ''
        }`
      );
      setScreen({ name: 'participantSearch' });
      return;
    }

    const baseWebhookPayload = {
      webhookEventId: randomId('wh'),
      paymentIntentId: paymentIntent.id,
      provider: paymentIntent.provider,
      providerPaymentIntentId: `pi_demo_${Date.now()}`,
      paymentReference: cleanText(payment.reference || `STRIPE-${Date.now().toString().slice(-8)}`),
      receivedAt: new Date().toISOString(),
    };

    const webhookPayload = isPaymentSessionExpired(paymentIntent.expiresAt)
      ? {
          ...baseWebhookPayload,
          type: 'payment_intent.expired' as const,
          reason: t('payment_session_expired_reason'),
        }
      : {
          ...baseWebhookPayload,
          type: 'payment_intent.succeeded' as const,
        };

    const applied = applyPaymentWebhook(sourceData, webhookPayload, {
      assignNumber: (_, eventId) => {
        const lookupEvent = sourceData.events.find((entry) => entry.id === eventId);
        if (!lookupEvent || !lookupEvent.assignNumbers) {
          return undefined;
        }
        return getNextAssignedNumber(sourceData, eventId);
      },
    });

    if (!applied.applied) {
      Alert.alert(t('payment_webhook_not_applied_title'), applied.reason ?? t('unknown_error'));
      return;
    }

    const now = new Date().toISOString();
    const enrichedData: AppData = {
      ...applied.nextData,
      registrations: applied.nextData.registrations.map((entry) => {
        if (entry.id !== registrationId) {
          return entry;
        }
        return {
          ...entry,
          paymentMethod: payment.method,
          paymentReference:
            cleanText(payment.reference) ||
            entry.paymentReference ||
            `STRIPE-${Date.now().toString().slice(-8)}`,
          updatedAt: now,
        };
      }),
    };

    setAppData(enrichedData);

    const updatedRegistration = enrichedData.registrations.find((entry) => entry.id === registrationId);

    if (!updatedRegistration) {
      Alert.alert(t('update_error_title'), t('update_error_message'));
      return;
    }

    if (updatedRegistration.registrationStatus !== 'paid') {
      const failedSync = await syncRegistrationRecord(enrichedData, updatedRegistration);
      Alert.alert(
        t('payment_not_completed_title'),
        t('payment_not_completed_message', {
          status: updatedRegistration.registrationStatus,
          reason: updatedRegistration.paymentFailedReason ?? t('retry_payment_reason'),
          sync: failedSync.ok
            ? t('sync_state_ok')
            : t('sync_state_fail', { reason: failedSync.reason }),
        })
      );
      setScreen({ name: 'participantSearch' });
      return;
    }

    const paidSync = await syncRegistrationRecord(enrichedData, updatedRegistration);

    const emailResult = await sendConfirmationEmail({
      participantEmail: updatedRegistration.email,
      participantName: updatedRegistration.fullName,
      eventName: event.name,
      amount: updatedRegistration.paymentAmount,
      registrationCode: updatedRegistration.registrationCode,
      assignedNumber: updatedRegistration.assignedNumber,
      groupParticipantsCount: updatedRegistration.groupParticipantsCount,
    });

    const emailText = !emailResult.sent
      ? t('email_failed', {
          detail: emailResult.detail ?? `HTTP ${emailResult.statusCode ?? 'N/D'}`,
        })
      : emailResult.mode === 'simulated'
        ? t('email_simulated')
        : t('email_sent');
    const syncText = paidSync.ok
      ? t('sync_paid_ok')
      : t('sync_state_fail', { reason: paidSync.reason });

    Alert.alert(
      t('payment_confirmed_title'),
      `${t('payment_confirmed_message', {
        code: updatedRegistration.registrationCode,
        number:
          typeof updatedRegistration.assignedNumber === 'number'
            ? t('number_assigned_line', { number: updatedRegistration.assignedNumber })
            : '',
        email: emailText,
        sync: syncText,
      })}${
        updatedRegistration.groupParticipantsCount > 1
          ? `\n${t('group_participants_line', { count: updatedRegistration.groupParticipantsCount })}`
          : ''
      }`
    );

    setScreen({ name: 'participantSearch' });
  };

  const cancelPendingRegistration = async (registrationId: string) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const registration = sourceData.registrations.find((entry) => entry.id === registrationId);

    if (!registration) {
      Alert.alert(t('session_not_found_title'), t('session_not_found_message'));
      return;
    }

    if (
      registration.registrationStatus !== 'pending_payment' &&
      registration.registrationStatus !== 'pending_cash'
    ) {
      Alert.alert(t('invalid_state_title'), t('invalid_state_message', { status: registration.registrationStatus }));
      return;
    }

    const now = new Date().toISOString();

    const nextData: AppData = {
      ...sourceData,
      registrations: sourceData.registrations.map((entry) =>
        entry.id === registrationId
          ? {
              ...entry,
              registrationStatus: 'cancelled',
              paymentStatus: 'cancelled',
              paymentFailedReason: t('registration_cancelled_title'),
              updatedAt: now,
            }
          : entry
      ),
      paymentIntents: sourceData.paymentIntents.map((entry) =>
        entry.registrationId === registrationId
          ? {
              ...entry,
              status: 'cancelled',
              failureReason: t('registration_cancelled_title'),
              updatedAt: now,
            }
          : entry
      ),
    };

    setAppData(nextData);
    const updatedRegistration = nextData.registrations.find((entry) => entry.id === registrationId);
    const syncResult = updatedRegistration
      ? await syncRegistrationRecord(nextData, updatedRegistration)
      : { ok: false as const, reason: t('update_error_message') };

    Alert.alert(
      t('registration_cancelled_title'),
      t('registration_cancelled_message', {
        sync: syncResult.ok
          ? t('cancellation_sync_ok')
          : t('sync_state_fail', { reason: syncResult.reason }),
      })
    );
    setScreen({ name: 'participantSearch' });
  };

  const confirmCashRegistrationByOrganizer = async (registrationId: string) => {
    const sourceData = withExpiredSessionsHandled(appData);
    const registration = sourceData.registrations.find((entry) => entry.id === registrationId);

    if (!registration) {
      Alert.alert(t('session_not_found_title'), t('session_not_found_message'));
      return;
    }

    if (registration.registrationStatus !== 'pending_cash') {
      Alert.alert(t('invalid_state_title'), t('invalid_state_message', { status: registration.registrationStatus }));
      return;
    }

    const event = sourceData.events.find((entry) => entry.id === registration.eventId);
    if (!event) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    const now = new Date().toISOString();
    const assignedNumber =
      event.assignNumbers && typeof registration.assignedNumber !== 'number'
        ? getNextAssignedNumber(sourceData, event.id)
        : registration.assignedNumber;

    const nextData: AppData = {
      ...sourceData,
      registrations: sourceData.registrations.map((entry) =>
        entry.id === registrationId
          ? {
              ...entry,
              registrationStatus: 'paid',
              paymentStatus: 'captured',
              paymentMethod: 'cash',
              assignedNumber,
              paymentCapturedAt: now,
              paymentFailedReason: undefined,
              updatedAt: now,
            }
          : entry
      ),
      paymentIntents: sourceData.paymentIntents.map((entry) =>
        entry.registrationId === registrationId
          ? {
              ...entry,
              status: 'captured',
              providerPaymentIntentId:
                entry.providerPaymentIntentId ?? `cash_manual_${Date.now()}`,
              failureReason: undefined,
              updatedAt: now,
            }
          : entry
      ),
    };

    setAppData(nextData);
    const updatedRegistration = nextData.registrations.find((entry) => entry.id === registrationId);
    const syncResult = updatedRegistration
      ? await syncRegistrationRecord(nextData, updatedRegistration)
      : { ok: false as const, reason: t('update_error_message') };

    const emailResult = await sendConfirmationEmail({
      participantEmail: registration.email,
      participantName: registration.fullName,
      eventName: event.name,
      amount: registration.paymentAmount,
      registrationCode: registration.registrationCode,
      assignedNumber,
      groupParticipantsCount: registration.groupParticipantsCount,
    });

    const emailText = !emailResult.sent
      ? t('email_failed', {
          detail: emailResult.detail ?? `HTTP ${emailResult.statusCode ?? 'N/D'}`,
        })
      : emailResult.mode === 'simulated'
        ? t('email_simulated')
        : t('email_sent');
    const syncText = syncResult.ok
      ? t('sync_paid_ok')
      : t('sync_state_fail', { reason: syncResult.reason });

    Alert.alert(
      t('cash_payment_confirmed_title'),
      `${t('cash_payment_confirmed_message', {
        code: registration.registrationCode,
        number:
          typeof assignedNumber === 'number'
            ? t('number_assigned_line', { number: assignedNumber })
            : '',
        email: emailText,
        sync: syncText,
      })}${
        registration.groupParticipantsCount > 1
          ? `\n${t('group_participants_line', { count: registration.groupParticipantsCount })}`
          : ''
      }`
    );
  };

  const renderScreen = () => {
    switch (screen.name) {
      case 'role':
        return (
          <RoleSelectionScreen
            eventCount={appData.events.length}
            registrationCount={appData.registrations.length}
            onOrganizer={() => {
              if (ORGANIZER_SECURITY_ENFORCED) {
                setScreen({ name: 'organizerAuth' });
                return;
              }
              setScreen({ name: 'organizerProfile' });
            }}
            onParticipant={() => {
              setScreen({ name: 'participantSearch' });
            }}
            onOpenLegal={() => setShowLegalModal(true)}
            language={language}
            onLanguageChange={setLanguage}
            t={t}
          />
        );

      case 'organizerAuth':
        if (!ORGANIZER_SECURITY_ENFORCED) {
          return (
            <OrganizerProfileScreen
              organizers={appData.organizers}
              onBack={() => setScreen({ name: 'role' })}
              onCreate={createOrganizer}
              onUseExisting={(organizerId) => setScreen({ name: 'organizerDashboard', organizerId })}
              t={t}
            />
          );
        }

        return (
          <OrganizerAuthScreen
            status={organizerSecurity}
            onBack={() => setScreen({ name: 'role' })}
            onRefresh={async () => {
              await refreshOrganizerSecurityState();
            }}
            onEmailSignIn={async (email, password) => {
              await loginOrganizerWithEmail(email, password, 'signin');
            }}
            onEmailSignUp={async (email, password) => {
              await loginOrganizerWithEmail(email, password, 'signup');
            }}
            onGoogleSignIn={async () => {
              await signInOrganizerWithOAuth('google');
            }}
            onAppleSignIn={async () => {
              await signInOrganizerWithOAuth('apple');
            }}
            onContinue={() => {
              if (organizerSecurity?.securityReady) {
                setScreen({ name: 'organizerProfile' });
                return;
              }
              Alert.alert(
                t('organizer_security_required_title'),
                t('organizer_security_required_message')
              );
            }}
            t={t}
          />
        );

      case 'organizerProfile':
        return (
          <OrganizerProfileScreen
            organizers={appData.organizers}
            onBack={() => setScreen({ name: 'role' })}
            onCreate={createOrganizer}
            onUseExisting={(organizerId) => setScreen({ name: 'organizerDashboard', organizerId })}
            t={t}
          />
        );

      case 'organizerCreate':
        return organizerForScreen ? (
          <OrganizerCreateEventScreen
            organizer={organizerForScreen}
            initialEvent={editingEventForScreen}
            onBack={() => setScreen({ name: 'organizerDashboard', organizerId: organizerForScreen.id })}
            onCreate={(payload) => createEvent(organizerForScreen.id, payload)}
            t={t}
            language={language}
          />
        ) : (
          <FallbackScreen
            message={t('fallback_organizer_not_found')}
            actionLabel={t('fallback_home')}
            onAction={() => setScreen({ name: 'role' })}
          />
        );

      case 'organizerDashboard':
        return organizerForScreen ? (
          <OrganizerDashboardScreen
            organizer={organizerForScreen}
            events={appData.events.filter((event) => event.organizerId === organizerForScreen.id)}
            registrations={appData.registrations}
            paymentIntents={appData.paymentIntents}
            sponsorSlots={appData.sponsorSlots.filter(
              (slot) => slot.organizerId === organizerForScreen.id
            )}
            onBack={() => setScreen({ name: 'role' })}
            onNewEvent={() => setScreen({ name: 'organizerCreate', organizerId: organizerForScreen.id })}
            onEditEvent={(eventId) =>
              setScreen({ name: 'organizerCreate', organizerId: organizerForScreen.id, eventId })
            }
            onToggleEvent={toggleEventActive}
            onToggleEventRegistrations={toggleEventRegistrations}
            onCloseEvent={closeEventCompletely}
            onReopenEvent={reopenEventForNewSeason}
            onExportEvent={exportEventCsv}
            onExportEventPdf={exportEventPdf}
            onConfirmCashPayment={confirmCashRegistrationByOrganizer}
            getEventPublicUrl={buildPublicEventUrl}
            onUpdateCompliance={updateOrganizerCompliance}
            onSendComplianceEmail={sendOrganizerComplianceToAdmin}
            onRequestPaidUnlock={requestPaidFeatureUnlock}
            onStartStripeConnect={startStripeConnectForOrganizer}
            onSyncStripeConnect={syncStripeConnectForOrganizer}
            onActivateSponsorModule={activateSponsorModuleForOrganizer}
            onCreateSponsorCheckout={createSponsorCheckoutForEvent}
            t={t}
            language={language}
          />
        ) : (
          <FallbackScreen
            message={t('fallback_dashboard_unavailable')}
            actionLabel={t('fallback_home')}
            onAction={() => setScreen({ name: 'role' })}
          />
        );

      case 'participantAuth':
        return (
          <ParticipantAuthScreen
            onBack={() => setScreen({ name: 'role' })}
            onContinue={() => {
              setScreen({ name: 'participantSearch' });
            }}
            t={t}
          />
        );

      case 'participantSearch':
        return (
          <ParticipantSearchScreen
            events={appData.events}
            onBack={() => {
              setScreen({ name: 'role' });
            }}
            onSelectEvent={(eventId) => setScreen({ name: 'participantRegister', eventId })}
            getEventPublicUrl={buildPublicEventUrl}
            appPublicUrl={buildPublicAppUrl()}
            sponsorSlots={appData.sponsorSlots}
            t={t}
          />
        );

      case 'participantRegister':
        return participantEventForRegister ? (
          <ParticipantRegistrationScreen
            event={participantEventForRegister}
            onBack={() => setScreen({ name: 'participantSearch' })}
            onCompleteFree={(draft) => completeFreeRegistration(participantEventForRegister.id, draft)}
            onProceedPayment={(draft) => openPaidRegistration(participantEventForRegister.id, draft)}
            t={t}
          />
        ) : (
          <FallbackScreen
            message={t('fallback_event_not_found')}
            actionLabel={t('fallback_back_search')}
            onAction={() => setScreen({ name: 'participantSearch' })}
          />
        );

      case 'participantPayment':
        return participantRegistrationForPayment && participantEventForPayment ? (
          <ParticipantPaymentScreen
            event={participantEventForPayment}
            registration={participantRegistrationForPayment}
            onBack={() => setScreen({ name: 'participantRegister', eventId: participantEventForPayment.id })}
            onConfirm={(payment) => confirmPaidRegistration(participantRegistrationForPayment.id, payment)}
            onCancel={() => cancelPendingRegistration(participantRegistrationForPayment.id)}
            t={t}
          />
        ) : (
          <FallbackScreen
            message={t('fallback_payment_unavailable')}
            actionLabel={t('fallback_back_search')}
            onAction={() => setScreen({ name: 'participantSearch' })}
          />
        );

      default:
        return null;
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <StatusBar style='light' />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>{t('app_name')}</Text>
          <Text style={styles.loadingText}>{t('loading_data')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style='light' />
      <LinearGradient colors={['#03111E', '#0A2944', '#0F5D70']} style={styles.gradient}>
        <View pointerEvents='none' style={styles.backgroundDecor}>
          <View style={[styles.backgroundOrb, styles.backgroundOrbTop]} />
          <View style={[styles.backgroundOrb, styles.backgroundOrbBottom]} />
        </View>

        <View style={styles.headerShell}>
          <View style={[styles.headerRow, isDesktopLayout ? styles.headerRowDesktop : undefined]}>
            <View>
              <Text style={styles.appTitle}>{t('app_name')}</Text>
              <Text style={styles.appSubtitle}>{appSubtitle}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.screenWrapper, isDesktopLayout ? styles.screenWrapperDesktop : undefined]}>
          {renderScreen()}
        </View>
        {shouldShowMonetizationBanner ? (
          shouldUseAdMobBanner ? (
            <AdMobBanner />
          ) : (
            <FreeEventBanner text={monetizationBanner.text} />
          )
        ) : null}
      </LinearGradient>

      <LegalModal visible={showLegalModal} onClose={() => setShowLegalModal(false)} t={t} />
      <FreeInterstitialModal data={freeInterstitial} onClose={() => setFreeInterstitial(null)} t={t} />
      <ProcessingInterstitialModal
        visible={Boolean(processingInterstitial)}
        secondsRemaining={processingInterstitial?.secondsRemaining ?? 0}
        sponsor={processingInterstitial?.sponsor}
        t={t}
      />
    </SafeAreaView>
  );
}

export default App;
