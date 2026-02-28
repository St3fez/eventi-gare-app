import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  requestEmailOtp,
  signOut,
  startOrganizerOAuth,
} from './src/services/authSupabase';
import {
  getAdminAccessByEmail,
  grantAdminUser,
  listAdminUsers,
  revokeAdminUser,
} from './src/services/adminSupabase';
import {
  applyPaymentWebhook,
  expirePendingPaymentSessions,
  isPaymentSessionExpired,
} from './src/services/paymentStateMachine';
import { loadAppData, saveAppData } from './src/services/storage';
import {
  deleteEventInSupabase,
  ensureSupabaseUser,
  insertEventInSupabase,
  listOrganizerCatalogFromSupabase,
  OrganizerCatalogEventRow,
  OrganizerCatalogOrganizerRow,
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
  AdminUser,
  AppData,
  EventPaymentChannel,
  EventItem,
  FreeInterstitial,
  GroupParticipant,
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
  isImageDataUrl,
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
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  if (cleanText(EVENT_WEB_BASE_URL ?? '')) {
    return cleanText(EVENT_WEB_BASE_URL ?? '').replace(/\/+$/, '');
  }
  return null;
};

const buildEventDuplicateKey = (name: string, location: string, date: string): string =>
  `${normalizeComparableText(name)}|${normalizeComparableText(location)}|${toIsoDate(date)}`;

const localSponsorText = (value?: string): string => {
  const normalized = cleanText(value ?? '');
  if (!normalized || isImageDataUrl(normalized)) {
    return '';
  }
  return normalized;
};

const addYearsIso = (isoDate: string, years: number): string => {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  parsed.setFullYear(parsed.getFullYear() + years);
  return parsed.toISOString().slice(0, 10);
};

const normalizeOrganizerRoleFromCatalog = (
  value: string | null | undefined,
  fallback: OrganizerProfile['organizationRole']
): OrganizerProfile['organizationRole'] => {
  if (value === 'presidente_fondazione' || value === 'segretario_associazione') {
    return value;
  }
  if (value === 'altro') {
    return value;
  }
  return fallback;
};

const normalizeVerificationStatusFromCatalog = (
  value: string | null | undefined,
  fallback: OrganizerProfile['verificationStatus']
): OrganizerProfile['verificationStatus'] => {
  if (value === 'verified' || value === 'rejected' || value === 'suspended') {
    return value;
  }
  if (value === 'pending_review') {
    return value;
  }
  return fallback;
};

const normalizeParticipantAuthModeFromCatalog = (
  value: string | null | undefined,
  fallback: EventItem['participantAuthMode']
): EventItem['participantAuthMode'] => {
  if (
    value === 'anonymous' ||
    value === 'email' ||
    value === 'social_verified' ||
    value === 'flexible'
  ) {
    return value;
  }
  return fallback;
};

const normalizeEventTimeFromCatalog = (value: string | null | undefined, fallback: string): string => {
  const text = cleanText(value ?? '');
  if (!text) {
    return fallback;
  }
  const match = /^(\d{2}:\d{2})/.exec(text);
  return match ? match[1] : fallback;
};

const mergeOrganizerCatalogFromSupabase = (
  source: AppData,
  catalog: {
    organizers: OrganizerCatalogOrganizerRow[];
    events: OrganizerCatalogEventRow[];
  }
): AppData => {
  const nextOrganizers = [...source.organizers];
  const organizerIndexByRemoteId = new Map<string, number>();
  const organizerIndexByEmail = new Map<string, number>();

  nextOrganizers.forEach((organizer, index) => {
    const remoteId = cleanText(organizer.remoteId ?? '');
    if (remoteId) {
      organizerIndexByRemoteId.set(remoteId, index);
    }
    organizerIndexByEmail.set(organizer.email.toLowerCase(), index);
  });

  for (const row of catalog.organizers) {
    const remoteId = cleanText(row.id);
    const email = cleanText(row.email).toLowerCase();
    if (!remoteId || !email) {
      continue;
    }

    const existingIndex =
      organizerIndexByRemoteId.get(remoteId) ?? organizerIndexByEmail.get(email);
    const existing = existingIndex !== undefined ? nextOrganizers[existingIndex] : undefined;

    const complianceSource =
      row.compliance_documents && typeof row.compliance_documents === 'object'
        ? row.compliance_documents
        : existing?.complianceDocuments;
    const checklistSource =
      row.verification_checklist && typeof row.verification_checklist === 'object'
        ? row.verification_checklist
        : existing?.verificationChecklist;

    const mergedOrganizer: OrganizerProfile = {
      id: existing?.id ?? randomId('org'),
      remoteId,
      userId: cleanText(row.user_id ?? '') || existing?.userId,
      email,
      organizationName: cleanText(row.organization_name ?? existing?.organizationName ?? ''),
      organizationRole: normalizeOrganizerRoleFromCatalog(
        row.organization_role,
        existing?.organizationRole ?? 'altro'
      ),
      organizationRoleLabel: cleanText(
        row.organization_role_label ?? existing?.organizationRoleLabel ?? ''
      ),
      legalRepresentative: cleanText(
        row.legal_representative ?? existing?.legalRepresentative ?? ''
      ),
      officialPhone: cleanText(row.official_phone ?? existing?.officialPhone ?? ''),
      fiscalData: cleanText(row.fiscal_data ?? existing?.fiscalData ?? ''),
      bankAccount: cleanText(row.bank_account ?? existing?.bankAccount ?? ''),
      complianceDocuments: {
        identityDocumentUrl: cleanText(
          complianceSource?.identityDocumentUrl ??
            existing?.complianceDocuments.identityDocumentUrl ??
            ''
        ),
        organizationDocumentUrl: cleanText(
          complianceSource?.organizationDocumentUrl ??
            existing?.complianceDocuments.organizationDocumentUrl ??
            ''
        ),
        paymentAuthorizationDocumentUrl: cleanText(
          complianceSource?.paymentAuthorizationDocumentUrl ??
            existing?.complianceDocuments.paymentAuthorizationDocumentUrl ??
            ''
        ),
        adminContactMessage: cleanText(
          complianceSource?.adminContactMessage ??
            existing?.complianceDocuments.adminContactMessage ??
            ''
        ),
      },
      complianceSubmittedAt: cleanText(
        row.compliance_submitted_at ?? existing?.complianceSubmittedAt ?? ''
      ) || undefined,
      verificationStatus: normalizeVerificationStatusFromCatalog(
        row.verification_status,
        existing?.verificationStatus ?? 'pending_review'
      ),
      payoutEnabled:
        typeof row.payout_enabled === 'boolean'
          ? row.payout_enabled
          : existing?.payoutEnabled ?? false,
      paidFeatureUnlocked:
        typeof row.paid_feature_unlocked === 'boolean'
          ? row.paid_feature_unlocked
          : existing?.paidFeatureUnlocked ?? false,
      paidFeatureUnlockRequestedAt:
        cleanText(
          row.paid_feature_unlock_requested_at ??
            existing?.paidFeatureUnlockRequestedAt ??
            ''
        ) || undefined,
      paidFeatureUnlockContact:
        cleanText(
          row.paid_feature_unlock_contact ?? existing?.paidFeatureUnlockContact ?? ''
        ) || PAID_FEATURE_UNLOCK_CONTACT,
      sponsorModuleEnabled:
        typeof row.sponsor_module_enabled === 'boolean'
          ? row.sponsor_module_enabled
          : existing?.sponsorModuleEnabled ?? false,
      sponsorModuleActivatedAt:
        cleanText(
          row.sponsor_module_activated_at ?? existing?.sponsorModuleActivatedAt ?? ''
        ) || undefined,
      sponsorModuleActivationAmount:
        typeof row.sponsor_module_activation_amount === 'number'
          ? row.sponsor_module_activation_amount
          : existing?.sponsorModuleActivationAmount ?? SPONSOR_MODULE_ACTIVATION_EUR,
      stripeConnectAccountId:
        cleanText(
          row.stripe_connect_account_id ?? existing?.stripeConnectAccountId ?? ''
        ) || undefined,
      stripeConnectChargesEnabled:
        typeof row.stripe_connect_charges_enabled === 'boolean'
          ? row.stripe_connect_charges_enabled
          : existing?.stripeConnectChargesEnabled ?? false,
      stripeConnectPayoutsEnabled:
        typeof row.stripe_connect_payouts_enabled === 'boolean'
          ? row.stripe_connect_payouts_enabled
          : existing?.stripeConnectPayoutsEnabled ?? false,
      stripeConnectDetailsSubmitted:
        typeof row.stripe_connect_details_submitted === 'boolean'
          ? row.stripe_connect_details_submitted
          : existing?.stripeConnectDetailsSubmitted ?? false,
      stripeConnectRequirements: existing?.stripeConnectRequirements ?? [],
      stripeConnectLastSyncAt:
        cleanText(row.stripe_connect_last_sync_at ?? existing?.stripeConnectLastSyncAt ?? '') ||
        undefined,
      riskScore:
        typeof row.risk_score === 'number' ? row.risk_score : existing?.riskScore ?? 0,
      riskFlags: Array.isArray(row.risk_flags)
        ? row.risk_flags.map((entry) => cleanText(String(entry))).filter(Boolean)
        : existing?.riskFlags ?? [],
      verificationChecklist: {
        emailVerified: Boolean(
          checklistSource?.emailVerified ??
            existing?.verificationChecklist.emailVerified
        ),
        fiscalDataVerified: Boolean(
          checklistSource?.fiscalDataVerified ??
            existing?.verificationChecklist.fiscalDataVerified
        ),
        ibanOwnershipVerified: Boolean(
          checklistSource?.ibanOwnershipVerified ??
            existing?.verificationChecklist.ibanOwnershipVerified
        ),
        identityVerified: Boolean(
          checklistSource?.identityVerified ??
            existing?.verificationChecklist.identityVerified
        ),
        manualReviewPassed: Boolean(
          checklistSource?.manualReviewPassed ??
            existing?.verificationChecklist.manualReviewPassed
        ),
      },
      createdAt: cleanText(row.created_at ?? existing?.createdAt ?? '') || new Date().toISOString(),
      updatedAt: cleanText(row.updated_at ?? existing?.updatedAt ?? '') || new Date().toISOString(),
    };

    if (existingIndex !== undefined) {
      nextOrganizers[existingIndex] = mergedOrganizer;
      organizerIndexByRemoteId.set(remoteId, existingIndex);
      organizerIndexByEmail.set(email, existingIndex);
    } else {
      nextOrganizers.push(mergedOrganizer);
      const insertedIndex = nextOrganizers.length - 1;
      organizerIndexByRemoteId.set(remoteId, insertedIndex);
      organizerIndexByEmail.set(email, insertedIndex);
    }
  }

  const localOrganizerIdByRemoteId = new Map<string, string>();
  nextOrganizers.forEach((organizer) => {
    const remoteId = cleanText(organizer.remoteId ?? '');
    if (remoteId) {
      localOrganizerIdByRemoteId.set(remoteId, organizer.id);
    }
  });

  const nextEvents = [...source.events];
  const eventIndexByRemoteId = new Map<string, number>();
  nextEvents.forEach((event, index) => {
    const remoteId = cleanText(event.remoteId ?? '');
    if (remoteId) {
      eventIndexByRemoteId.set(remoteId, index);
    }
  });

  for (const row of catalog.events) {
    const remoteId = cleanText(row.id);
    const organizerRemoteId = cleanText(row.organizer_id);
    const localOrganizerId = localOrganizerIdByRemoteId.get(organizerRemoteId);
    if (!remoteId || !localOrganizerId) {
      continue;
    }

    let existingIndex = eventIndexByRemoteId.get(remoteId);
    if (existingIndex === undefined) {
      const duplicateKey = buildEventDuplicateKey(row.name, row.location, row.event_date);
      existingIndex = nextEvents.findIndex(
        (event) =>
          event.organizerId === localOrganizerId &&
          buildEventDuplicateKey(event.name, event.location, event.date) === duplicateKey
      );
    }

    const existing = existingIndex !== undefined && existingIndex >= 0 ? nextEvents[existingIndex] : undefined;
    const eventDate = toIsoDate(row.event_date ?? '') || existing?.date || new Date().toISOString().slice(0, 10);
    const eventEndDate = toIsoDate(row.event_end_date ?? '') || existing?.endDate || eventDate;
    const createdAt = cleanText(row.created_at ?? existing?.createdAt ?? '') || new Date().toISOString();

    const mergedEvent: EventItem = {
      id: existing?.id ?? randomId('evt'),
      remoteId,
      organizerId: localOrganizerId,
      name: cleanText(row.name ?? existing?.name ?? ''),
      location: cleanText(row.location ?? existing?.location ?? ''),
      date: eventDate,
      endDate: eventEndDate,
      startTime: normalizeEventTimeFromCatalog(row.event_time, existing?.startTime ?? '09:00'),
      isFree: typeof row.is_free === 'boolean' ? row.is_free : existing?.isFree ?? true,
      feeAmount: Number(row.fee_amount ?? existing?.feeAmount ?? 0),
      privacyText: cleanText(row.privacy_text ?? existing?.privacyText ?? DEFAULT_PRIVACY_TEXT),
      logoUrl: cleanText(row.logo_url ?? existing?.logoUrl ?? ''),
      localSponsor: cleanText(row.local_sponsor ?? existing?.localSponsor ?? ''),
      assignNumbers:
        typeof row.assign_numbers === 'boolean'
          ? row.assign_numbers
          : existing?.assignNumbers ?? true,
      registrationOpenDate: existing?.registrationOpenDate ?? createdAt.slice(0, 10),
      registrationCloseDate: existing?.registrationCloseDate ?? eventEndDate,
      registrationsOpen:
        typeof row.registrations_open === 'boolean'
          ? row.registrations_open
          : existing?.registrationsOpen ?? true,
      visibility:
        existing?.visibility ??
        (Boolean(row.active) && !cleanText(row.closed_at ?? '') ? 'public' : 'hidden'),
      closedAt: cleanText(row.closed_at ?? existing?.closedAt ?? '') || undefined,
      definitivePublishedAt:
        cleanText(
          row.definitive_published_at ?? existing?.definitivePublishedAt ?? ''
        ) || undefined,
      seasonVersion:
        typeof row.season_version === 'number' ? row.season_version : existing?.seasonVersion ?? 1,
      lastParticipantsResetAt:
        cleanText(
          row.last_participants_reset_at ?? existing?.lastParticipantsResetAt ?? ''
        ) || undefined,
      baseFeeAmount: existing?.baseFeeAmount ?? Number(row.fee_amount ?? 0),
      feePolicy: existing?.feePolicy ?? (row.is_free ? 'organizer_absorbs_fees' : 'participant_pays_fees'),
      paymentChannel: existing?.paymentChannel ?? 'stripe',
      cashPaymentEnabled:
        typeof row.cash_payment_enabled === 'boolean'
          ? row.cash_payment_enabled
          : existing?.cashPaymentEnabled ?? false,
      cashPaymentInstructions: cleanText(
        row.cash_payment_instructions ?? existing?.cashPaymentInstructions ?? ''
      ),
      cashPaymentDeadline:
        cleanText(row.cash_payment_deadline ?? existing?.cashPaymentDeadline ?? '') || undefined,
      participantAuthMode: normalizeParticipantAuthModeFromCatalog(
        row.participant_auth_mode,
        existing?.participantAuthMode ?? 'anonymous'
      ),
      participantPhoneRequired:
        typeof row.participant_phone_required === 'boolean'
          ? row.participant_phone_required
          : existing?.participantPhoneRequired ?? false,
      developerCommissionRate: existing?.developerCommissionRate ?? COMMISSION_RATE,
      providerFeeRate: existing?.providerFeeRate ?? STRIPE_PROVIDER_FEE_RATE,
      providerFeeFixed: existing?.providerFeeFixed ?? STRIPE_PROVIDER_FEE_FIXED,
      organizerNetAmount: existing?.organizerNetAmount ?? Number(row.fee_amount ?? 0),
      active: typeof row.active === 'boolean' ? row.active : existing?.active ?? true,
      createdAt,
    };

    if (existingIndex !== undefined && existingIndex >= 0) {
      nextEvents[existingIndex] = mergedEvent;
      eventIndexByRemoteId.set(remoteId, existingIndex);
    } else {
      nextEvents.push(mergedEvent);
      eventIndexByRemoteId.set(remoteId, nextEvents.length - 1);
    }
  }

  return {
    ...source,
    organizers: nextOrganizers,
    events: nextEvents,
  };
};

type AuthNotice = {
  tone: 'error' | 'success' | 'info';
  title: string;
  message: string;
};

type PostRegistrationAlert = {
  title: string;
  message: string;
  nextScreen: ScreenState;
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
  const [adminAccess, setAdminAccess] = useState<{
    isAdmin: boolean;
    canManageAdmins: boolean;
  }>({
    isAdmin: false,
    canManageAdmins: false,
  });
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const [postRegistrationAlert, setPostRegistrationAlert] =
    useState<PostRegistrationAlert | null>(null);
  const [handledSharedEventRef, setHandledSharedEventRef] = useState<string | null>(null);
  const t = useMemo(() => createTranslator(language), [language]);
  const appSubtitle = IS_DEMO_CHANNEL ? t('app_subtitle_demo') : t('app_subtitle');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    document.title = t('app_name');
  }, [language, t]);

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
    if (ORGANIZER_SECURITY_ENFORCED) {
      return;
    }
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

    const sharedEvent = appData.events.find((entry) => {
      const remoteId = cleanText(entry.remoteId ?? '');
      if (remoteId && remoteId === sharedRef) {
        return true;
      }
      if (IS_DEMO_CHANNEL && entry.id === sharedRef) {
        return true;
      }
      return false;
    });
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

  useEffect(() => {
    if (!isReady || !ORGANIZER_SECURITY_ENFORCED) {
      return;
    }
    if (!organizerSecurity?.securityReady) {
      return;
    }

    let cancelled = false;

    const refreshCatalog = async () => {
      const catalogResult = await listOrganizerCatalogFromSupabase();
      if (!catalogResult.ok || cancelled) {
        return;
      }

      setAppData((current) => mergeOrganizerCatalogFromSupabase(current, catalogResult.data));
    };

    void refreshCatalog();

    return () => {
      cancelled = true;
    };
  }, [
    adminAccess.isAdmin,
    isReady,
    organizerSecurity?.email,
    organizerSecurity?.securityReady,
    organizerSecurity?.userId,
  ]);

  const refreshAdminAccess = useCallback(
    async (email?: string) => {
      const normalizedEmail = cleanText(email ?? '').toLowerCase();
      if (!normalizedEmail) {
        setAdminAccess({
          isAdmin: false,
          canManageAdmins: false,
        });
        setAdminUsers([]);
        return;
      }

      const accessResult = await getAdminAccessByEmail(normalizedEmail);
      if (!accessResult.ok) {
        setAdminAccess({
          isAdmin: false,
          canManageAdmins: false,
        });
        setAdminUsers([]);
        return;
      }

      setAdminAccess(accessResult.data);

      if (!accessResult.data.isAdmin) {
        setAdminUsers([]);
        return;
      }

      const adminsResult = await listAdminUsers();
      if (!adminsResult.ok) {
        setAdminUsers([]);
        return;
      }

      setAdminUsers(adminsResult.data);
    },
    []
  );

  const refreshAdminUsers = useCallback(
    async (showAlert = false): Promise<boolean> => {
      if (!adminAccess.isAdmin) {
        return false;
      }

      const result = await listAdminUsers();
      if (!result.ok) {
        if (showAlert) {
          Alert.alert(t('admin_action_title'), t('admin_action_error', { reason: result.reason }));
        }
        return false;
      }

      setAdminUsers(result.data);
      return true;
    },
    [adminAccess.isAdmin, t]
  );

  const refreshOrganizerSecurityState = async (showMissingAlert = false): Promise<boolean> => {
    if (!ORGANIZER_SECURITY_ENFORCED) {
      return true;
    }

    const status = await getOrganizerSecurityStatus();
    if (!status.ok) {
      setOrganizerSecurity(null);
      setAdminAccess({
        isAdmin: false,
        canManageAdmins: false,
      });
      setAdminUsers([]);
      if (showMissingAlert) {
        Alert.alert(t('organizer_security_required_title'), status.reason);
      }
      return false;
    }
    setOrganizerSecurity(status.data);
    void refreshAdminAccess(status.data.email);
    if (showMissingAlert && !status.data.securityReady) {
      Alert.alert(t('organizer_security_required_title'), t('organizer_security_required_message'));
      return false;
    }
    return status.data.securityReady;
  };

  const ensureOrganizerSecurityForProtectedAction = async (): Promise<boolean> => {
    if (!ORGANIZER_SECURITY_ENFORCED) {
      return true;
    }
    if (organizerSecurity?.securityReady) {
      return true;
    }
    return refreshOrganizerSecurityState(true);
  };

  const openOrganizerWorkspace = useCallback(
    async (status?: OrganizerSecurityStatus | null) => {
      if (!ORGANIZER_SECURITY_ENFORCED) {
        setScreen({ name: 'organizerProfile' });
        return;
      }

      const currentStatus = status ?? organizerSecurity;
      if (!currentStatus?.securityReady) {
        setScreen({ name: 'organizerProfile' });
        return;
      }

      const currentUserId = cleanText(currentStatus.userId ?? '');
      const currentEmail = cleanText(currentStatus.email ?? '').toLowerCase();

      if (currentEmail) {
        const adminResult = await getAdminAccessByEmail(currentEmail);
        if (adminResult.ok && adminResult.data.isAdmin) {
          setAdminAccess(adminResult.data);
          const adminsResult = await listAdminUsers();
          if (adminsResult.ok) {
            setAdminUsers(adminsResult.data);
          }
          setScreen({ name: 'organizerProfile' });
          return;
        }
      }

      const matchedOrganizer = appData.organizers.find((organizer) => {
        if (currentUserId && organizer.userId && organizer.userId === currentUserId) {
          return true;
        }
        if (currentEmail && organizer.email.toLowerCase() === currentEmail) {
          return true;
        }
        return false;
      });

      if (!matchedOrganizer) {
        setScreen({ name: 'organizerProfile' });
        return;
      }

      if (currentUserId && !matchedOrganizer.userId && currentEmail) {
        setAppData((current) => ({
          ...current,
          organizers: current.organizers.map((organizer) =>
            organizer.id === matchedOrganizer.id ? { ...organizer, userId: currentUserId } : organizer
          ),
        }));
      }

      setScreen({ name: 'organizerDashboard', organizerId: matchedOrganizer.id });
    },
    [appData.organizers, organizerSecurity]
  );

  useEffect(() => {
    if (screen.name !== 'organizerAuth') {
      setAuthNotice(null);
    }
    if (
      screen.name === 'organizerAuth' ||
      screen.name === 'organizerProfile' ||
      screen.name === 'organizerCreate' ||
      screen.name === 'organizerDashboard'
    ) {
      void refreshOrganizerSecurityState();
    }
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
      const securityReady = await refreshOrganizerSecurityState();
      if (securityReady) {
        const latestSecurity = await getOrganizerSecurityStatus();
        if (latestSecurity.ok) {
          setOrganizerSecurity(latestSecurity.data);
          await openOrganizerWorkspace(latestSecurity.data);
          return;
        }
        await openOrganizerWorkspace();
      }
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

  const activeOrganizerUserId = ORGANIZER_SECURITY_ENFORCED
    ? organizerSecurity?.userId ?? null
    : null;
  const activeOrganizerEmail = ORGANIZER_SECURITY_ENFORCED
    ? cleanText(organizerSecurity?.email ?? '').toLowerCase()
    : '';

  const grantPlatformAdmin = useCallback(
    async (email: string, canManageAdmins: boolean): Promise<void> => {
      if (!adminAccess.canManageAdmins) {
        Alert.alert(t('admin_action_title'), t('admin_action_not_allowed'));
        return;
      }

      const normalizedEmail = cleanText(email).toLowerCase();
      const result = await grantAdminUser({
        email: normalizedEmail,
        canManageAdmins,
      });
      if (!result.ok) {
        Alert.alert(t('admin_action_title'), t('admin_action_error', { reason: result.reason }));
        return;
      }

      await refreshAdminUsers(false);
      if (activeOrganizerEmail) {
        await refreshAdminAccess(activeOrganizerEmail);
      }

      Alert.alert(t('admin_action_title'), t('admin_grant_success', { email: result.data.email }));
    },
    [activeOrganizerEmail, adminAccess.canManageAdmins, refreshAdminAccess, refreshAdminUsers, t]
  );

  const revokePlatformAdmin = useCallback(
    async (email: string): Promise<void> => {
      if (!adminAccess.canManageAdmins) {
        Alert.alert(t('admin_action_title'), t('admin_action_not_allowed'));
        return;
      }

      const normalizedEmail = cleanText(email).toLowerCase();
      if (activeOrganizerEmail && normalizedEmail === activeOrganizerEmail) {
        Alert.alert(t('admin_action_title'), t('admin_self_revoke_blocked'));
        return;
      }

      const result = await revokeAdminUser(normalizedEmail);
      if (!result.ok) {
        Alert.alert(t('admin_action_title'), t('admin_action_error', { reason: result.reason }));
        return;
      }

      await refreshAdminUsers(false);
      if (activeOrganizerEmail) {
        await refreshAdminAccess(activeOrganizerEmail);
      }

      Alert.alert(t('admin_action_title'), t('admin_revoke_success', { email: result.data.email }));
    },
    [activeOrganizerEmail, adminAccess.canManageAdmins, refreshAdminAccess, refreshAdminUsers, t]
  );

  const organizerMatchesSession = useCallback(
    (organizer: OrganizerProfile): boolean => {
      if (adminAccess.isAdmin) {
        return true;
      }
      if (!ORGANIZER_SECURITY_ENFORCED) {
        return true;
      }
      if (!activeOrganizerUserId) {
        if (activeOrganizerEmail) {
          return organizer.email.toLowerCase() === activeOrganizerEmail;
        }
        return false;
      }
      if (organizer.userId) {
        return organizer.userId === activeOrganizerUserId;
      }
      if (activeOrganizerEmail) {
        return organizer.email.toLowerCase() === activeOrganizerEmail;
      }
      return false;
    },
    [activeOrganizerEmail, activeOrganizerUserId, adminAccess.isAdmin]
  );

  const organizersForProfile = useMemo(() => {
    if (!ORGANIZER_SECURITY_ENFORCED) {
      return appData.organizers;
    }
    if (!activeOrganizerUserId && !activeOrganizerEmail) {
      return [];
    }
    return appData.organizers.filter(organizerMatchesSession);
  }, [activeOrganizerEmail, activeOrganizerUserId, appData.organizers, organizerMatchesSession]);

  useEffect(() => {
    if (!ORGANIZER_SECURITY_ENFORCED) {
      return;
    }
    if (!activeOrganizerUserId || !activeOrganizerEmail) {
      return;
    }
    const hasLegacy = appData.organizers.some(
      (organizer) =>
        !organizer.userId && organizer.email.toLowerCase() === activeOrganizerEmail
    );
    if (!hasLegacy) {
      return;
    }
    setAppData((current) => ({
      ...current,
      organizers: current.organizers.map((organizer) =>
        !organizer.userId && organizer.email.toLowerCase() === activeOrganizerEmail
          ? { ...organizer, userId: activeOrganizerUserId }
          : organizer
      ),
    }));
  }, [activeOrganizerEmail, activeOrganizerUserId, appData.organizers]);

  const organizerForScreen = useMemo(() => {
    if (screen.name !== 'organizerCreate' && screen.name !== 'organizerDashboard') {
      return undefined;
    }
    const organizer = appData.organizers.find((entry) => entry.id === screen.organizerId);
    if (!organizer) {
      return undefined;
    }
    if (!organizerMatchesSession(organizer)) {
      return undefined;
    }
    return organizer;
  }, [appData.organizers, organizerMatchesSession, screen]);

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

  const participantRegistrationForEdit = useMemo(() => {
    if (screen.name !== 'participantRegister' || !screen.registrationId) {
      return undefined;
    }
    return appData.registrations.find(
      (entry) => entry.id === screen.registrationId && entry.eventId === screen.eventId
    );
  }, [appData.registrations, screen]);

  const participantDraftForEdit = useMemo((): RegistrationDraft | undefined => {
    if (!participantRegistrationForEdit) {
      return undefined;
    }
    const groupCount = Math.max(1, participantRegistrationForEdit.groupParticipantsCount || 1);
    const normalizedGroup = (Array.isArray(participantRegistrationForEdit.groupParticipants)
      ? participantRegistrationForEdit.groupParticipants
      : []
    )
      .slice(0, groupCount)
      .map((entry) => cleanText(entry.fullName));
    if (!normalizedGroup.length) {
      normalizedGroup.push(cleanText(participantRegistrationForEdit.fullName));
    }
    normalizedGroup[0] =
      cleanText(participantRegistrationForEdit.fullName) || normalizedGroup[0] || '';
    while (normalizedGroup.length < groupCount) {
      normalizedGroup.push('');
    }
    return {
      fullName: participantRegistrationForEdit.fullName,
      email: participantRegistrationForEdit.email,
      phone: participantRegistrationForEdit.phone ?? '',
      city: participantRegistrationForEdit.city ?? '',
      birthDate: participantRegistrationForEdit.birthDate ?? '',
      groupParticipantsCount: groupCount,
      participantMessage: cleanText(participantRegistrationForEdit.participantMessage ?? ''),
      groupParticipants: normalizedGroup,
      privacyConsent: participantRegistrationForEdit.privacyConsent,
      retentionConsent: participantRegistrationForEdit.retentionConsent,
    };
  }, [participantRegistrationForEdit]);

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
      fallbackSponsors.push(localSponsorText(participantEventForRegister?.localSponsor));
    } else if (screen.name === 'participantPayment') {
      fallbackSponsors.push(localSponsorText(participantEventForPayment?.localSponsor));
    } else if (screen.name === 'participantSearch') {
      fallbackSponsors.push(
        localSponsorText(appData.events.find((event) => event.active && event.localSponsor)?.localSponsor)
      );
    } else if (screen.name === 'organizerDashboard') {
      fallbackSponsors.push(
        localSponsorText(
          appData.events.find((event) => event.organizerId === screen.organizerId && event.localSponsor)
            ?.localSponsor
        )
      );
    } else if (screen.name === 'organizerCreate' || screen.name === 'organizerProfile') {
      fallbackSponsors.push(
        localSponsorText(appData.events.find((event) => event.active && event.localSponsor)?.localSponsor)
      );
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

  const normalizeDraftGroupParticipants = (draft: RegistrationDraft): GroupParticipant[] => {
    const count = Math.max(1, draft.groupParticipantsCount || 1);
    const leadName = cleanText(draft.fullName);
    const sourceNames = Array.isArray(draft.groupParticipants) ? draft.groupParticipants : [];
    const normalizedNames = sourceNames.slice(0, count).map((value) => cleanText(value));
    if (!normalizedNames.length) {
      normalizedNames.push(leadName);
    }
    normalizedNames[0] = leadName || normalizedNames[0] || '';
    while (normalizedNames.length < count) {
      normalizedNames.push('');
    }
    return normalizedNames.slice(0, count).map((fullName) => ({
      fullName,
    }));
  };

  const normalizeRegistrationGroupParticipants = (
    registration: RegistrationRecord
  ): GroupParticipant[] => {
    const count = Math.max(1, registration.groupParticipantsCount || 1);
    const leadName = cleanText(registration.fullName);
    const source = Array.isArray(registration.groupParticipants) ? registration.groupParticipants : [];
    const normalized: GroupParticipant[] = source
      .slice(0, count)
      .map((entry) => ({
        fullName: cleanText(entry.fullName),
        assignedNumber:
          typeof entry.assignedNumber === 'number' ? entry.assignedNumber : undefined,
      }));

    if (!normalized.length) {
      normalized.push({
        fullName: leadName,
        assignedNumber: registration.assignedNumber,
      });
    }

    normalized[0] = {
      ...normalized[0],
      fullName: leadName || normalized[0].fullName || '',
      assignedNumber:
        typeof normalized[0].assignedNumber === 'number'
          ? normalized[0].assignedNumber
          : registration.assignedNumber,
    };

    while (normalized.length < count) {
      normalized.push({
        fullName: '',
      });
    }

    return normalized.slice(0, count);
  };

  const getRegistrationAssignedNumbers = (registration: RegistrationRecord): number[] => {
    const numbers: number[] = [];
    if (typeof registration.assignedNumber === 'number') {
      numbers.push(registration.assignedNumber);
    }
    for (const participant of registration.groupParticipants ?? []) {
      if (typeof participant.assignedNumber === 'number') {
        numbers.push(participant.assignedNumber);
      }
    }
    return numbers;
  };

  const getNextAssignedNumber = (
    source: AppData,
    eventId: string,
    excludeRegistrationId?: string
  ): number => {
    let maxAssigned = 0;
    source.registrations.forEach((entry) => {
      if (entry.eventId !== eventId) {
        return;
      }
      if (excludeRegistrationId && entry.id === excludeRegistrationId) {
        return;
      }
      getRegistrationAssignedNumbers(entry).forEach((assignedNumber) => {
        maxAssigned = Math.max(maxAssigned, assignedNumber);
      });
    });
    return maxAssigned + 1;
  };

  const withGroupAssignedNumbers = (
    source: AppData,
    event: EventItem,
    registration: RegistrationRecord
  ): RegistrationRecord => {
    const participants = normalizeRegistrationGroupParticipants(registration);
    if (!event.assignNumbers) {
      return {
        ...registration,
        assignedNumber: undefined,
        groupParticipants: participants.map((participant) => ({
          fullName: participant.fullName,
        })),
      };
    }

    let nextNumber = getNextAssignedNumber(source, event.id, registration.id);
    const numberedParticipants = participants.map((participant, index) => {
      if (typeof participant.assignedNumber === 'number') {
        nextNumber = Math.max(nextNumber, participant.assignedNumber + 1);
        return participant;
      }
      if (index === 0 && typeof registration.assignedNumber === 'number') {
        nextNumber = Math.max(nextNumber, registration.assignedNumber + 1);
        return {
          ...participant,
          assignedNumber: registration.assignedNumber,
        };
      }
      const assignedNumber = nextNumber;
      nextNumber += 1;
      return {
        ...participant,
        assignedNumber,
      };
    });

    return {
      ...registration,
      assignedNumber: numberedParticipants[0]?.assignedNumber,
      groupParticipants: numberedParticipants,
    };
  };

  const getDraftParticipantNames = (draft: RegistrationDraft): string[] => {
    return normalizeDraftGroupParticipants(draft)
      .map((participant) => normalizeComparableText(participant.fullName))
      .filter(Boolean);
  };

  const getRegistrationParticipantNames = (registration: RegistrationRecord): string[] => {
    const normalized = normalizeRegistrationGroupParticipants(registration)
      .map((participant) => normalizeComparableText(participant.fullName))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  };

  const findDuplicateParticipantName = (params: {
    source: AppData;
    eventId: string;
    draft: RegistrationDraft;
    excludeRegistrationId?: string;
  }): string | null => {
    const draftNames = getDraftParticipantNames(params.draft);
    if (!draftNames.length) {
      return null;
    }

    const seenInDraft = new Set<string>();
    for (const name of draftNames) {
      if (seenInDraft.has(name)) {
        return name;
      }
      seenInDraft.add(name);
    }

    const existingNames = new Set<string>();
    params.source.registrations.forEach((entry) => {
      if (entry.eventId !== params.eventId) {
        return;
      }
      if (params.excludeRegistrationId && entry.id === params.excludeRegistrationId) {
        return;
      }
      if (
        entry.registrationStatus === 'cancelled' ||
        entry.registrationStatus === 'payment_failed' ||
        entry.registrationStatus === 'refunded'
      ) {
        return;
      }
      getRegistrationParticipantNames(entry).forEach((name) => {
        existingNames.add(name);
      });
    });

    for (const name of draftNames) {
      if (existingNames.has(name)) {
        return name;
      }
    }

    return null;
  };

  const ensureDraftConsents = (draft: RegistrationDraft): boolean => {
    if (!draft.privacyConsent || !draft.retentionConsent) {
      showAppAlert(t('required_consents_title'), t('required_consents_message'));
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
      showAppAlert(t('participant_auth_required_title'), auth.reason);
      return false;
    }

    return true;
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms);
    });

  const showRegistrationCountdown = async (event: EventItem) => {
    if (!ADMOB_ENABLED || Platform.OS === 'web') {
      return;
    }
    const slot = appData.sponsorSlots.find(
      (entry) => entry.eventId === event.id && isSponsorSlotVisible(entry)
    );
    const slotLabel = slot
      ? cleanText(language === 'it' ? slot.sponsorNameIt : slot.sponsorNameEn)
      : '';
    const sponsor = slotLabel || localSponsorText(event.localSponsor) || undefined;
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

  const signInOrganizerWithOAuth = async (provider: 'google') => {
    const result = await startOrganizerOAuth(provider);
    if (!result.ok) {
      showAuthAlert(t('organizer_security_action_fail_title'), result.reason);
      return;
    }
    if (Platform.OS !== 'web') {
      showAuthAlert(
        t('organizer_security_action_fail_title'),
        t('organizer_security_browser_opened')
      );
    }
  };

  const showAppAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const showAuthAlert = (title: string, message: string, tone: AuthNotice['tone'] = 'error') => {
    setAuthNotice({ tone, title, message });
    if (Platform.OS !== 'web') {
      Alert.alert(title, message);
    }
  };

  const requestOrganizerMagicLink = async (email: string) => {
    const normalizedEmail = cleanText(email).toLowerCase();
    if (!normalizedEmail.includes('@')) {
      showAuthAlert(t('invalid_email_title'), t('invalid_email_message'));
      return;
    }

    let action;
    try {
      action = await requestEmailOtp(normalizedEmail, true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Errore imprevisto durante invio Magic Link.';
      showAuthAlert(t('organizer_security_action_fail_title'), message);
      return;
    }

    if (action.error) {
      showAuthAlert(t('organizer_security_action_fail_title'), action.error.message);
      return;
    }

    showAuthAlert(
      t('organizer_security_action_fail_title'),
      t('organizer_security_otp_sent'),
      'success'
    );
  };

  const signOutOrganizerAccount = async () => {
    const result = await signOut();
    if (result.error) {
      showAuthAlert(t('organizer_security_action_fail_title'), result.error.message);
      return;
    }

    setOrganizerSecurity(null);
    setAdminAccess({
      isAdmin: false,
      canManageAdmins: false,
    });
    setAdminUsers([]);
    showAuthAlert(
      t('organizer_security_action_fail_title'),
      t('organizer_security_signed_out'),
      'info'
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
    const remoteReference = cleanText(event.remoteId ?? '');
    if (!IS_DEMO_CHANNEL && !remoteReference) {
      return null;
    }
    const reference = remoteReference || event.id;
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

    const organizerRemoteId = cleanText(organizer.remoteId ?? '');
    if (!organizerRemoteId) {
      return {
        ok: false as const,
        reason: t('event_sync_org_missing'),
      };
    }

    const eventRemoteId = cleanText(event.remoteId ?? '');
    if (!eventRemoteId) {
      return {
        ok: false as const,
        reason: t('event_sync_org_missing'),
      };
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
    let security = await getOrganizerSecurityStatus();
    if (!security.ok && organizerSecurity?.securityReady) {
      security = {
        ok: true,
        data: organizerSecurity,
      };
    }
    if (ORGANIZER_SECURITY_ENFORCED) {
      if (!security.ok || !security.data.securityReady) {
        Alert.alert(
          t('organizer_security_required_title'),
          security.ok ? t('organizer_security_required_message') : security.reason
        );
        setScreen({ name: 'organizerAuth' });
        return;
      }
    }
    if (security.ok) {
      setOrganizerSecurity(security.data);
    }
    const email = cleanText(
      security.ok && security.data.securityReady ? security.data.email : payload.email
    ).toLowerCase();
    const ownerUserId = security.ok ? security.data.userId : undefined;
    if (!email.includes('@')) {
      Alert.alert(t('invalid_email_title'), t('invalid_email_message'));
      return;
    }

    const existingOrganizerByEmail = appData.organizers.find(
      (entry) => entry.email.toLowerCase() === email
    );
    if (existingOrganizerByEmail) {
      const sameSessionOwner =
        !ownerUserId ||
        !existingOrganizerByEmail.userId ||
        existingOrganizerByEmail.userId === ownerUserId;

      if (sameSessionOwner) {
        const nowIso = new Date().toISOString();
        const organizerForSync: OrganizerProfile = {
          ...existingOrganizerByEmail,
          userId: ownerUserId ?? existingOrganizerByEmail.userId,
          email,
          updatedAt: nowIso,
        };

        const shouldSyncExisting =
          !organizerForSync.remoteId ||
          organizerForSync.email !== existingOrganizerByEmail.email ||
          organizerForSync.userId !== existingOrganizerByEmail.userId;

        if (shouldSyncExisting) {
          const organizerSync = await upsertOrganizerInSupabase(organizerForSync);
          if (!organizerSync.ok) {
            Alert.alert(t('sync_not_completed_title'), organizerSync.reason);
            return;
          }

          setAppData((current) => ({
            ...current,
            organizers: current.organizers.map((entry) =>
              entry.id === existingOrganizerByEmail.id
                ? {
                    ...entry,
                    userId: organizerForSync.userId,
                    email: organizerSync.data.email,
                    remoteId: organizerSync.data.id,
                    updatedAt: nowIso,
                  }
                : entry
            ),
          }));
        } else if (ownerUserId && !existingOrganizerByEmail.userId) {
          setAppData((current) => ({
            ...current,
            organizers: current.organizers.map((entry) =>
              entry.id === existingOrganizerByEmail.id
                ? { ...entry, userId: ownerUserId, updatedAt: nowIso }
                : entry
            ),
          }));
        }

        setScreen({ name: 'organizerDashboard', organizerId: existingOrganizerByEmail.id });
        return;
      }

      Alert.alert(t('email_already_registered_title'), t('email_already_registered_message'));
      return;
    }

    const risk = scoreOrganizerRisk(payload, appData.organizers);
    const now = new Date().toISOString();

    const organizer: OrganizerProfile = {
      id: randomId('org'),
      userId: ownerUserId,
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

    const syncResult = await upsertOrganizerInSupabase(organizer);
    if (!syncResult.ok) {
      Alert.alert(t('sync_not_completed_title'), syncResult.reason);
      return;
    }

    const organizerToStore: OrganizerProfile = {
      ...organizer,
      remoteId: syncResult.data.id,
      email: syncResult.data.email,
    };

    setAppData((current) => ({
      ...current,
      organizers: [organizerToStore, ...current.organizers],
    }));

    Alert.alert(
      t('organizer_created_title'),
      t('organizer_created_message', { note: t('organizer_sync_ok') })
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
    const securityReady = await ensureOrganizerSecurityForProtectedAction();
    if (!securityReady) {
      return;
    }

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
    const securityReady = await ensureOrganizerSecurityForProtectedAction();
    if (!securityReady) {
      return;
    }

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
    const securityReady = await ensureOrganizerSecurityForProtectedAction();
    if (!securityReady) {
      return;
    }

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

  const deleteEventPermanently = async (eventId: string) => {
    const sourceData = appData;
    const targetEvent = sourceData.events.find((entry) => entry.id === eventId);
    if (!targetEvent) {
      Alert.alert(t('event_not_found_title'), t('event_not_found_message'));
      return;
    }

    if (!adminAccess.isAdmin) {
      showAppAlert(t('admin_action_title'), t('event_delete_forever_admin_only'));
      return;
    }

    const registrationIds = new Set(
      sourceData.registrations
        .filter((entry) => entry.eventId === eventId)
        .map((entry) => entry.id)
    );
    const eventRemoteId = cleanText(targetEvent.remoteId ?? '');

    const nextData: AppData = {
      ...sourceData,
      events: sourceData.events.filter((entry) => entry.id !== eventId),
      registrations: sourceData.registrations.filter((entry) => entry.eventId !== eventId),
      paymentIntents: sourceData.paymentIntents.filter(
        (entry) => entry.eventId !== eventId && !registrationIds.has(entry.registrationId)
      ),
      sponsorSlots: sourceData.sponsorSlots.filter((entry) => {
        if (entry.eventId === eventId) {
          return false;
        }
        if (eventRemoteId && entry.eventRemoteId === eventRemoteId) {
          return false;
        }
        return true;
      }),
    };

    setAppData(nextData);

    if (eventRemoteId) {
      const deleteResult = await deleteEventInSupabase(eventRemoteId);
      if (!deleteResult.ok) {
        setAppData(sourceData);
        showAppAlert(
          t('sync_not_completed_title'),
          t('event_delete_forever_fail', {
            reason: deleteResult.reason,
          })
        );
        return;
      }
    }

    showAppAlert(t('event_delete_forever_confirm_title'), t('event_delete_forever_success'));
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

    if (!IS_DEMO_CHANNEL && !cleanText(event.remoteId ?? '')) {
      showAppAlert(t('sync_not_completed_title'), t('event_sync_org_missing'));
      return;
    }

    const normalizedEmail = cleanText(draft.email).toLowerCase();
    const existingFreeRegistration = sourceData.registrations.find(
      (entry) =>
        entry.eventId === eventId &&
        entry.email === normalizedEmail &&
        entry.paymentAmount === 0 &&
        (entry.registrationStatus === 'paid' ||
          entry.registrationStatus === 'pending_payment' ||
          entry.registrationStatus === 'pending_cash')
    );
    const duplicateName = findDuplicateParticipantName({
      source: sourceData,
      eventId,
      draft,
      excludeRegistrationId: existingFreeRegistration?.id,
    });
    if (duplicateName) {
      Alert.alert(
        t('participant_already_registered_title'),
        t('participant_already_registered_message')
      );
      return;
    }

    await showRegistrationCountdown(event);

    try {
      const now = new Date().toISOString();
      const groupParticipantsCount = Math.max(1, draft.groupParticipantsCount || 1);
      const draftGroupParticipants = normalizeDraftGroupParticipants(draft);
      const baseRegistration: RegistrationRecord = {
        id: randomId('reg'),
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
        participantMessage: cleanText(draft.participantMessage),
        groupParticipants: draftGroupParticipants,
        assignedNumber: undefined,
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

      const registration = withGroupAssignedNumbers(
        sourceData,
        event,
        existingFreeRegistration
          ? {
              ...existingFreeRegistration,
              ...baseRegistration,
              id: existingFreeRegistration.id,
              remoteId: existingFreeRegistration.remoteId,
              registrationCode: existingFreeRegistration.registrationCode,
              paymentIntentId: existingFreeRegistration.paymentIntentId,
              createdAt: existingFreeRegistration.createdAt,
            }
          : baseRegistration
      );

      const nextData: AppData = {
        ...sourceData,
        registrations: existingFreeRegistration
          ? sourceData.registrations.map((entry) =>
              entry.id === existingFreeRegistration.id ? registration : entry
            )
          : [registration, ...sourceData.registrations],
      };

      setAppData(nextData);

      const syncResult = await syncRegistrationRecord(nextData, registration);
      if (!syncResult.ok && !IS_DEMO_CHANNEL) {
        setAppData(sourceData);
        showAppAlert(
          t('sync_not_completed_title'),
          t('sync_not_completed_message', { reason: syncResult.reason })
        );
        return;
      }

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
        sponsor: localSponsorText(event.localSponsor) || undefined,
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

      setPostRegistrationAlert({
        title: t('registration_completed_title'),
        message: `${t('registration_completed_message', {
          code: registration.registrationCode,
          number: numberLine,
          email: emailText,
          sync: syncText,
        })}${groupLine}`,
        nextScreen: { name: 'participantSearch' },
      });
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

    if (!IS_DEMO_CHANNEL && !cleanText(event.remoteId ?? '')) {
      showAppAlert(t('sync_not_completed_title'), t('event_sync_org_missing'));
      return;
    }

    const normalizedEmail = cleanText(draft.email).toLowerCase();
    const draftGroupParticipants = normalizeDraftGroupParticipants(draft);
    const editingRegistrationId =
      screen.name === 'participantRegister' ? screen.registrationId : undefined;
    const pendingFromEdit = editingRegistrationId
      ? sourceData.registrations.find(
          (entry) =>
            entry.id === editingRegistrationId &&
            entry.eventId === eventId &&
            (entry.registrationStatus === 'pending_payment' ||
              entry.registrationStatus === 'pending_cash') &&
            !isPaymentSessionExpired(entry.paymentSessionExpiresAt)
        )
      : undefined;

    if (editingRegistrationId && !pendingFromEdit) {
      Alert.alert(t('session_not_found_title'), t('session_not_found_message'));
      setScreen({ name: 'participantSearch' });
      return;
    }

    const existingPending =
      pendingFromEdit ??
      sourceData.registrations.find(
        (entry) =>
          entry.eventId === eventId &&
          entry.email === normalizedEmail &&
          (entry.registrationStatus === 'pending_payment' ||
            entry.registrationStatus === 'pending_cash') &&
          !isPaymentSessionExpired(entry.paymentSessionExpiresAt)
      );
    const existingPaidByEmail = pendingFromEdit
      ? undefined
      : sourceData.registrations
          .filter(
            (entry) =>
              entry.eventId === eventId &&
              entry.email === normalizedEmail &&
              entry.registrationStatus === 'paid'
          )
          .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];

    const duplicateName = findDuplicateParticipantName({
      source: sourceData,
      eventId,
      draft,
      excludeRegistrationId:
        pendingFromEdit?.id ?? existingPending?.id ?? existingPaidByEmail?.id,
    });
    if (duplicateName) {
      Alert.alert(
        t('participant_already_registered_title'),
        t('participant_already_registered_message')
      );
      return;
    }

    if (existingPaidByEmail) {
      const now = new Date().toISOString();
      const updatedPaidRegistration = withGroupAssignedNumbers(sourceData, event, {
        ...existingPaidByEmail,
        fullName: cleanText(draft.fullName),
        email: normalizedEmail,
        phone: cleanText(draft.phone),
        city: cleanText(draft.city),
        birthDate: cleanText(draft.birthDate),
        privacyConsent: draft.privacyConsent,
        retentionConsent: draft.retentionConsent,
        groupParticipantsCount: Math.max(1, draft.groupParticipantsCount || 1),
        participantMessage: cleanText(draft.participantMessage),
        groupParticipants: draftGroupParticipants,
        updatedAt: now,
      });

      const nextData: AppData = {
        ...sourceData,
        registrations: sourceData.registrations.map((entry) =>
          entry.id === existingPaidByEmail.id ? updatedPaidRegistration : entry
        ),
      };

      setAppData(nextData);
      const syncResult = await syncRegistrationRecord(nextData, updatedPaidRegistration);
      Alert.alert(
        t('registration_updated_title'),
        t('registration_updated_message', {
          sync: syncResult.ok
            ? t('sync_state_ok')
            : t('sync_state_fail', { reason: syncResult.reason }),
        })
      );
      setScreen({ name: 'participantSearch' });
      return;
    }

    await showRegistrationCountdown(event);

    try {
      const now = new Date().toISOString();
      const groupParticipantsCount = Math.max(1, draft.groupParticipantsCount || 1);
      const expiresAt = addMinutesIso(PAYMENT_SESSION_MINUTES);
      const paymentAmount = Number.parseFloat((event.feeAmount * groupParticipantsCount).toFixed(2));
      const commissionAmount = Number.parseFloat(
        (event.baseFeeAmount * groupParticipantsCount * COMMISSION_RATE).toFixed(2)
      );
      const registrationId = existingPending?.id ?? randomId('reg');
      const existingIntent = existingPending?.paymentIntentId
        ? sourceData.paymentIntents.find((entry) => entry.id === existingPending.paymentIntentId)
        : undefined;
      const paymentIntentId = existingIntent?.id ?? randomId('pi');

      const registration: RegistrationRecord = {
        id: registrationId,
        remoteId: existingPending?.remoteId,
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
        participantMessage: cleanText(draft.participantMessage),
        groupParticipants: draftGroupParticipants,
        assignedNumber: undefined,
        registrationCode: existingPending?.registrationCode ?? buildRegistrationCode(event.name),
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
        createdAt: existingPending?.createdAt ?? now,
        updatedAt: now,
      };

      const paymentIntent: PaymentIntentRecord = existingIntent
        ? {
            ...existingIntent,
            registrationId,
            eventId,
            organizerId: event.organizerId,
            provider: 'stripe',
            amount: paymentAmount,
            status: 'pending',
            failureReason: undefined,
            expiresAt,
            updatedAt: now,
          }
        : {
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
        registrations: existingPending
          ? sourceData.registrations.map((entry) =>
              entry.id === existingPending.id ? registration : entry
            )
          : [registration, ...sourceData.registrations],
        paymentIntents: existingIntent
          ? sourceData.paymentIntents.map((entry) =>
              entry.id === existingIntent.id ? paymentIntent : entry
            )
          : [paymentIntent, ...sourceData.paymentIntents],
      };

      setAppData(nextData);
      const syncResult = await syncRegistrationRecord(nextData, registration);
      if (!syncResult.ok) {
        showAppAlert(
          t('sync_not_completed_title'),
          t('sync_not_completed_message', { reason: syncResult.reason })
        );
        if (!IS_DEMO_CHANNEL) {
          setAppData(sourceData);
          return;
        }
      }
      setScreen({ name: 'participantPayment', registrationId: registration.id });
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
      const baseUpdatedRegistration: RegistrationRecord = {
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
      const updatedRegistration =
        remote.registrationStatus === 'paid'
          ? withGroupAssignedNumbers(sourceData, event, baseUpdatedRegistration)
          : baseUpdatedRegistration;

      const nextData: AppData = {
        ...sourceData,
        registrations: sourceData.registrations.map((entry) =>
          entry.id === registrationId ? { ...entry, ...updatedRegistration } : entry
        ),
        paymentIntents: sourceData.paymentIntents.map((entry) =>
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

      setAppData(nextData);

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

      const paidSync = await syncRegistrationRecord(nextData, updatedRegistration);

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
          sync: paidSync.ok
            ? t('sync_state_ok')
            : t('sync_state_fail', { reason: paidSync.reason }),
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
      assignNumber: (registrationIdToAssign, eventId) => {
        const lookupEvent = sourceData.events.find((entry) => entry.id === eventId);
        if (!lookupEvent || !lookupEvent.assignNumbers) {
          return undefined;
        }
        return getNextAssignedNumber(sourceData, eventId, registrationIdToAssign);
      },
    });

    if (!applied.applied) {
      Alert.alert(t('payment_webhook_not_applied_title'), applied.reason ?? t('unknown_error'));
      return;
    }

    const now = new Date().toISOString();
    const refreshedEvent = sourceData.events.find((entry) => entry.id === registration.eventId);
    const enrichedData: AppData = {
      ...applied.nextData,
      registrations: applied.nextData.registrations.map((entry) => {
        if (entry.id !== registrationId) {
          return entry;
        }
        const updatedEntry: RegistrationRecord = {
          ...entry,
          paymentMethod: payment.method,
          paymentReference:
            cleanText(payment.reference) ||
            entry.paymentReference ||
            `STRIPE-${Date.now().toString().slice(-8)}`,
          updatedAt: now,
        };
        if (updatedEntry.registrationStatus === 'paid' && refreshedEvent) {
          return withGroupAssignedNumbers(applied.nextData, refreshedEvent, updatedEntry);
        }
        return updatedEntry;
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
    const paidRegistration = withGroupAssignedNumbers(sourceData, event, {
      ...registration,
      registrationStatus: 'paid',
      paymentStatus: 'captured',
      paymentMethod: 'cash',
      paymentCapturedAt: now,
      paymentFailedReason: undefined,
      updatedAt: now,
    });

    const nextData: AppData = {
      ...sourceData,
      registrations: sourceData.registrations.map((entry) =>
        entry.id === registrationId
          ? paidRegistration
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
      participantEmail: paidRegistration.email,
      participantName: paidRegistration.fullName,
      eventName: event.name,
      amount: paidRegistration.paymentAmount,
      registrationCode: paidRegistration.registrationCode,
      assignedNumber: paidRegistration.assignedNumber,
      groupParticipantsCount: paidRegistration.groupParticipantsCount,
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
        code: paidRegistration.registrationCode,
        number:
          typeof paidRegistration.assignedNumber === 'number'
            ? t('number_assigned_line', { number: paidRegistration.assignedNumber })
            : '',
        email: emailText,
        sync: syncText,
      })}${
        paidRegistration.groupParticipantsCount > 1
          ? `\n${t('group_participants_line', { count: paidRegistration.groupParticipantsCount })}`
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
              if (!ORGANIZER_SECURITY_ENFORCED) {
                setScreen({ name: 'organizerProfile' });
                return;
              }
              setScreen({ name: 'organizerAuth' });
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
              organizers={organizersForProfile}
              onBack={() => setScreen({ name: 'role' })}
              onSignOut={() => {
                void signOutOrganizerAccount();
              }}
              showSignOut={ORGANIZER_SECURITY_ENFORCED && Boolean(organizerSecurity?.email)}
              onCreate={createOrganizer}
              onUseExisting={(organizerId) => setScreen({ name: 'organizerDashboard', organizerId })}
              t={t}
            />
          );
        }

        return (
          <OrganizerAuthScreen
            status={organizerSecurity}
            notice={authNotice}
            onBack={() => setScreen({ name: 'role' })}
            onEmailMagicLinkRequest={async (email) => {
              await requestOrganizerMagicLink(email);
            }}
            onGoogleSignIn={async () => {
              await signInOrganizerWithOAuth('google');
            }}
            onSignOut={async () => {
              await signOutOrganizerAccount();
            }}
            onContinue={async () => {
              const securityReady = await refreshOrganizerSecurityState(true);
              if (securityReady) {
                const latestSecurity = await getOrganizerSecurityStatus();
                if (latestSecurity.ok) {
                  setOrganizerSecurity(latestSecurity.data);
                  await openOrganizerWorkspace(latestSecurity.data);
                  return;
                }
                await openOrganizerWorkspace();
              }
            }}
            t={t}
          />
        );

      case 'organizerProfile':
        return (
          <OrganizerProfileScreen
            organizers={organizersForProfile}
            onBack={() => setScreen({ name: 'role' })}
            onSignOut={() => {
              void signOutOrganizerAccount();
            }}
            showSignOut={ORGANIZER_SECURITY_ENFORCED && Boolean(organizerSecurity?.email)}
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
            isAdmin={adminAccess.isAdmin}
            canManageAdmins={adminAccess.canManageAdmins}
            adminUsers={adminUsers}
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
            onDeleteEventPermanently={deleteEventPermanently}
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
            onRefreshAdminUsers={async () => {
              await refreshAdminUsers(true);
            }}
            onGrantAdmin={grantPlatformAdmin}
            onRevokeAdmin={revokePlatformAdmin}
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
            events={appData.events.filter(
              (event) => IS_DEMO_CHANNEL || Boolean(cleanText(event.remoteId ?? ''))
            )}
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
            initialDraft={participantDraftForEdit}
            isEditing={Boolean(participantRegistrationForEdit)}
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
            onBack={() =>
              setScreen({
                name: 'participantRegister',
                eventId: participantEventForPayment.id,
                registrationId: participantRegistrationForPayment.id,
              })
            }
            onEditRegistration={() =>
              setScreen({
                name: 'participantRegister',
                eventId: participantEventForPayment.id,
                registrationId: participantRegistrationForPayment.id,
              })
            }
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
      <FreeInterstitialModal
        data={freeInterstitial}
        onClose={() => {
          setFreeInterstitial(null);
          if (!postRegistrationAlert) {
            return;
          }
          const { title, message, nextScreen } = postRegistrationAlert;
          setPostRegistrationAlert(null);
          showAppAlert(title, message);
          setScreen(nextScreen);
        }}
        t={t}
      />
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
