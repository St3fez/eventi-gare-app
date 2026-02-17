import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, Text, View } from 'react-native';

import {
  COMMISSION_RATE,
  DEFAULT_PRIVACY_TEXT,
  PAYMENT_SESSION_MINUTES,
  createDefaultData,
} from './src/constants';
import { FallbackScreen, FreeEventBanner } from './src/components/Common';
import { FreeInterstitialModal } from './src/components/FreeInterstitialModal';
import { LegalModal } from './src/components/LegalModal';
import { ProcessingInterstitialModal } from './src/components/ProcessingInterstitialModal';
import { AppLanguage, createTranslator } from './src/i18n';
import { sendConfirmationEmail } from './src/services/email';
import { exportEventRegistrationsCsv } from './src/services/exportCsv';
import { organizerCanCreatePaidEvents, scoreOrganizerRisk } from './src/services/fraud';
import {
  applyPaymentWebhook,
  expirePendingPaymentSessions,
  isPaymentSessionExpired,
} from './src/services/paymentStateMachine';
import { loadAppData, saveAppData } from './src/services/storage';
import {
  ensureSupabaseUser,
  insertEventInSupabase,
  upsertOrganizerInSupabase,
  upsertRegistrationInSupabase,
} from './src/services/supabaseData';
import {
  createSponsorCheckout,
  listSponsorSlotsFromSupabase,
  SponsorSlotRow,
} from './src/services/sponsorSupabase';
import { OrganizerCreateEventScreen } from './src/screens/OrganizerCreateEventScreen';
import { OrganizerDashboardScreen } from './src/screens/OrganizerDashboardScreen';
import { OrganizerProfileScreen } from './src/screens/OrganizerProfileScreen';
import { ParticipantPaymentScreen } from './src/screens/ParticipantPaymentScreen';
import { ParticipantRegistrationScreen } from './src/screens/ParticipantRegistrationScreen';
import { ParticipantSearchScreen } from './src/screens/ParticipantSearchScreen';
import { RoleSelectionScreen } from './src/screens/RoleSelectionScreen';
import { styles } from './src/styles';
import {
  AppData,
  EventItem,
  FreeInterstitial,
  OrganizerProfile,
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
  randomId,
  toIsoDate,
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

function App() {
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
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const loaded = await loadAppData(createDefaultData());
      const expiredHandled = expirePendingPaymentSessions(loaded);
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
    if (!isReady) {
      return;
    }
    void saveAppData(appData);
  }, [appData, isReady]);

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

  const organizerForScreen = useMemo(() => {
    if (screen.name !== 'organizerCreate' && screen.name !== 'organizerDashboard') {
      return undefined;
    }
    return appData.organizers.find((organizer) => organizer.id === screen.organizerId);
  }, [appData.organizers, screen]);

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

  const monetizationBannerText = useMemo(() => {
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
      return t('banner_sponsor_prefix', { sponsor: localizedName || slotCandidate.sponsorName });
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
      return t('banner_sponsor_prefix', { sponsor: fallbackSponsor });
    }

    return t('banner_ad_default');
  }, [
    appData.events,
    appData.sponsorSlots,
    language,
    participantEventForPayment,
    participantEventForRegister,
    screen,
    t,
  ]);

  const withExpiredSessionsHandled = (source: AppData): AppData => {
    const next = expirePendingPaymentSessions(source);
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
    for (let secondsRemaining = 5; secondsRemaining >= 1; secondsRemaining -= 1) {
      setProcessingInterstitial({
        secondsRemaining,
        sponsor,
      });
      await wait(1000);
    }
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
  }) => {
    const email = cleanText(payload.email).toLowerCase();
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
      fiscalData: cleanText(payload.fiscalData ?? ''),
      bankAccount: cleanText(payload.bankAccount ?? ''),
      verificationStatus: 'pending_review',
      payoutEnabled: false,
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
      name: string;
      location: string;
      date: string;
      isFree: boolean;
      feeAmount: number;
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

    if (!payload.isFree && payload.feeAmount <= 0) {
      Alert.alert(t('fee_missing_title'), t('fee_missing_message'));
      return;
    }

    if (!payload.isFree && !organizerCanCreatePaidEvents(organizer)) {
      Alert.alert(t('payments_disabled_title'), t('payments_disabled_message'));
      return;
    }

    const event: EventItem = {
      id: randomId('evt'),
      organizerId,
      name,
      location,
      date: toIsoDate(payload.date),
      isFree: payload.isFree,
      feeAmount: payload.isFree ? 0 : payload.feeAmount,
      privacyText: cleanText(payload.privacyText) || DEFAULT_PRIVACY_TEXT,
      logoUrl: cleanText(payload.logoUrl ?? ''),
      localSponsor: cleanText(payload.localSponsor ?? ''),
      assignNumbers: payload.assignNumbers,
      active: true,
      createdAt: new Date().toISOString(),
    };

    let organizerRemoteId = organizer.remoteId;
    if (!organizerRemoteId) {
      const organizerSync = await upsertOrganizerInSupabase(organizer);
      if (organizerSync.ok) {
        organizerRemoteId = organizerSync.data.id;
        patchOrganizerRemoteId(organizer.id, organizerRemoteId);
        if (organizer.email !== organizerSync.data.email) {
          patchOrganizerEmail(organizer.id, organizerSync.data.email);
        }
      }
    }

    let eventToStore = event;
    let syncNote = t('event_sync_local');
    if (organizerRemoteId) {
      const eventSync = await insertEventInSupabase(event, organizerRemoteId);
      if (eventSync.ok) {
        eventToStore = {
          ...event,
          remoteId: eventSync.data.id,
        };
        syncNote = t('event_sync_ok');
      } else {
        syncNote = t('event_sync_fail', { reason: eventSync.reason });
      }
    } else {
      syncNote = t('event_sync_org_missing');
    }

    setAppData((current) => ({ ...current, events: [eventToStore, ...current.events] }));
    Alert.alert(t('event_created_title'), t('event_created_message', { name: event.name, note: syncNote }));
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

  const toggleEventActive = (eventId: string) => {
    setAppData((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === eventId ? { ...event, active: !event.active } : event
      ),
    }));
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

    await showRegistrationCountdown(event);

    try {
      const now = new Date().toISOString();
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

      Alert.alert(
        t('registration_completed_title'),
        t('registration_completed_message', {
          code: registration.registrationCode,
          number: numberLine,
          email: emailText,
          sync: syncText,
        })
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

    const organizer = sourceData.organizers.find((entry) => entry.id === event.organizerId);
    if (!organizer || !organizerCanCreatePaidEvents(organizer)) {
      Alert.alert(t('payment_not_available_title'), t('payment_not_available_message'));
      return;
    }

    const normalizedEmail = cleanText(draft.email).toLowerCase();
    const existingPending = sourceData.registrations.find(
      (entry) =>
        entry.eventId === eventId &&
        entry.email === normalizedEmail &&
        entry.registrationStatus === 'pending_payment' &&
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
      const registrationId = randomId('reg');
      const paymentIntentId = randomId('pi');
      const expiresAt = addMinutesIso(PAYMENT_SESSION_MINUTES);

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
        assignedNumber: undefined,
        registrationCode: buildRegistrationCode(event.name),
        registrationStatus: 'pending_payment',
        paymentIntentId,
        paymentStatus: 'pending',
        paymentAmount: event.feeAmount,
        paymentMethod: undefined,
        paymentReference: undefined,
        paymentSessionExpiresAt: expiresAt,
        paymentCapturedAt: undefined,
        paymentFailedReason: undefined,
        refundedAt: undefined,
        commissionAmount: Number.parseFloat((event.feeAmount * COMMISSION_RATE).toFixed(2)),
        createdAt: now,
        updatedAt: now,
      };

      const paymentIntent: PaymentIntentRecord = {
        id: paymentIntentId,
        registrationId,
        eventId,
        organizerId: event.organizerId,
        provider: 'manual_demo',
        currency: 'EUR',
        amount: event.feeAmount,
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

    if (registration.registrationStatus !== 'pending_payment') {
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

    const baseWebhookPayload = {
      webhookEventId: randomId('wh'),
      paymentIntentId: paymentIntent.id,
      provider: paymentIntent.provider,
      providerPaymentIntentId: `pi_demo_${Date.now()}`,
      paymentReference: cleanText(payment.reference || `TX-${Date.now().toString().slice(-8)}`),
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
            cleanText(payment.reference) || entry.paymentReference || `TX-${Date.now().toString().slice(-8)}`,
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
      t('payment_confirmed_message', {
        code: updatedRegistration.registrationCode,
        number:
          typeof updatedRegistration.assignedNumber === 'number'
            ? t('number_assigned_line', { number: updatedRegistration.assignedNumber })
            : '',
        email: emailText,
        sync: syncText,
      })
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

    if (registration.registrationStatus !== 'pending_payment') {
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

  const renderScreen = () => {
    switch (screen.name) {
      case 'role':
        return (
          <RoleSelectionScreen
            eventCount={appData.events.length}
            registrationCount={appData.registrations.length}
            onOrganizer={() => setScreen({ name: 'organizerProfile' })}
            onParticipant={() => setScreen({ name: 'participantSearch' })}
            onOpenLegal={() => setShowLegalModal(true)}
            language={language}
            onLanguageChange={setLanguage}
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
            onToggleEvent={toggleEventActive}
            onExportEvent={exportEventCsv}
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

      case 'participantSearch':
        return (
          <ParticipantSearchScreen
            events={appData.events}
            onBack={() => setScreen({ name: 'role' })}
            onSelectEvent={(eventId) => setScreen({ name: 'participantRegister', eventId })}
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
      <LinearGradient colors={['#04192E', '#0A3354', '#116D77']} style={styles.gradient}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appTitle}>{t('app_name')}</Text>
            <Text style={styles.appSubtitle}>{t('app_subtitle')}</Text>
          </View>
        </View>

        <View style={styles.screenWrapper}>{renderScreen()}</View>
        {shouldShowMonetizationBanner ? <FreeEventBanner text={monetizationBannerText} /> : null}
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
