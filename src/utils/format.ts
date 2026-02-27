import {
  AppData,
  EventItem,
  OrganizerProfile,
  OrganizerVerificationChecklist,
  PaymentIntentRecord,
  RegistrationRecord,
  SponsorSlot,
} from '../types';
import {
  COMMISSION_RATE,
  PAID_FEATURE_UNLOCK_CONTACT,
  SPONSOR_MODULE_ACTIVATION_EUR,
  STRIPE_PROVIDER_FEE_FIXED,
  STRIPE_PROVIDER_FEE_RATE,
} from '../constants';

export const randomId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const addMinutesIso = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export const toIsoDate = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
};

export const toIsoTime = (raw: string): string => {
  const value = raw.trim();
  if (!value) {
    return '';
  }

  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return '';
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '';
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('it-IT');
};

export const formatTime = (time: string): string => {
  const normalized = toIsoTime(time);
  if (normalized) {
    return normalized;
  }
  return cleanText(time);
};

export const parseEuro = (input: string): number => {
  const normalized = input.replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
};

export const toMoney = (value: number): string =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

export const cleanText = (value: string): string => value.trim();

export const normalizeComparableText = (value: string): string =>
  cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const formatEventSchedule = (event: Pick<EventItem, 'date' | 'endDate' | 'startTime'>): string => {
  const startDate = toIsoDate(event.date);
  const candidateEndDate = cleanText(event.endDate) ? toIsoDate(event.endDate) : startDate;
  const endDate = candidateEndDate < startDate ? startDate : candidateEndDate;
  const datePart =
    endDate === startDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} - ${formatDate(endDate)}`;
  const timePart = formatTime(event.startTime);
  return timePart ? `${datePart} | ${timePart}` : datePart;
};

export const buildRegistrationCode = (eventName: string): string => {
  const tag = eventName
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')
    .padEnd(3, 'X');
  const tail = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${tag}-${tail}`;
};

const escapeCsvValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) {
    return '""';
  }
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

export const buildCsv = (
  header: string[],
  rows: Array<Array<string | number | undefined>>
): string => {
  return `\uFEFF${[header, ...rows]
    .map((line) => line.map((cell) => escapeCsvValue(cell)).join(';'))
    .join('\n')}`;
};

const defaultChecklist: OrganizerVerificationChecklist = {
  emailVerified: false,
  fiscalDataVerified: false,
  ibanOwnershipVerified: false,
  identityVerified: false,
  manualReviewPassed: false,
};

const normalizeOrganizer = (value: Partial<OrganizerProfile>): OrganizerProfile => {
  const createdAt = value.createdAt ?? new Date().toISOString();
  return {
    id: value.id ?? randomId('org_legacy'),
    remoteId: value.remoteId,
    userId: value.userId,
    email: value.email ?? '',
    organizationName: value.organizationName ?? '',
    organizationRole: value.organizationRole ?? 'altro',
    organizationRoleLabel: value.organizationRoleLabel ?? '',
    legalRepresentative: value.legalRepresentative ?? '',
    officialPhone: value.officialPhone ?? '',
    fiscalData: value.fiscalData ?? '',
    bankAccount: value.bankAccount ?? '',
    complianceDocuments: {
      identityDocumentUrl: value.complianceDocuments?.identityDocumentUrl ?? '',
      organizationDocumentUrl: value.complianceDocuments?.organizationDocumentUrl ?? '',
      paymentAuthorizationDocumentUrl:
        value.complianceDocuments?.paymentAuthorizationDocumentUrl ?? '',
      adminContactMessage: value.complianceDocuments?.adminContactMessage ?? '',
    },
    complianceSubmittedAt: value.complianceSubmittedAt,
    verificationStatus: value.verificationStatus ?? 'pending_review',
    payoutEnabled: value.payoutEnabled ?? false,
    paidFeatureUnlocked: value.paidFeatureUnlocked ?? false,
    paidFeatureUnlockRequestedAt: value.paidFeatureUnlockRequestedAt,
    paidFeatureUnlockContact: value.paidFeatureUnlockContact ?? PAID_FEATURE_UNLOCK_CONTACT,
    sponsorModuleEnabled: value.sponsorModuleEnabled ?? false,
    sponsorModuleActivatedAt: value.sponsorModuleActivatedAt,
    sponsorModuleActivationAmount:
      value.sponsorModuleActivationAmount ?? SPONSOR_MODULE_ACTIVATION_EUR,
    stripeConnectAccountId: value.stripeConnectAccountId,
    stripeConnectChargesEnabled: value.stripeConnectChargesEnabled ?? false,
    stripeConnectPayoutsEnabled: value.stripeConnectPayoutsEnabled ?? false,
    stripeConnectDetailsSubmitted: value.stripeConnectDetailsSubmitted ?? false,
    stripeConnectRequirements: Array.isArray(value.stripeConnectRequirements)
      ? value.stripeConnectRequirements
      : [],
    stripeConnectLastSyncAt: value.stripeConnectLastSyncAt,
    riskScore: value.riskScore ?? 0,
    riskFlags: Array.isArray(value.riskFlags) ? value.riskFlags : [],
    verificationChecklist: {
      ...defaultChecklist,
      ...(value.verificationChecklist ?? {}),
    },
    createdAt,
    updatedAt: value.updatedAt ?? createdAt,
  };
};

const normalizeEvent = (value: Partial<EventItem>): EventItem => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const createdAt = value.createdAt ?? new Date().toISOString();
  const eventDate = toIsoDate(value.date ?? todayIso);
  const normalizedEndDateCandidate = toIsoDate(value.endDate ?? eventDate);
  const endDate = normalizedEndDateCandidate < eventDate ? eventDate : normalizedEndDateCandidate;
  const startTime = toIsoTime(value.startTime ?? '') || '09:00';
  const registrationOpenDate = toIsoDate(value.registrationOpenDate ?? todayIso);
  const rawRegistrationCloseDate = toIsoDate(value.registrationCloseDate ?? endDate);
  const registrationCloseDate =
    rawRegistrationCloseDate < registrationOpenDate
      ? registrationOpenDate
      : rawRegistrationCloseDate > endDate
        ? endDate
        : rawRegistrationCloseDate;
  const isFree = value.isFree ?? true;
  const feeAmount = value.feeAmount ?? 0;
  const baseFeeAmount = value.baseFeeAmount ?? feeAmount;
  return {
    id: value.id ?? randomId('evt_legacy'),
    remoteId: value.remoteId,
    organizerId: value.organizerId ?? '',
    name: value.name ?? '',
    location: value.location ?? '',
    date: eventDate,
    endDate,
    startTime,
    isFree,
    feeAmount,
    privacyText: value.privacyText ?? '',
    logoUrl: value.logoUrl ?? '',
    localSponsor: value.localSponsor ?? '',
    assignNumbers: value.assignNumbers ?? true,
    registrationOpenDate,
    registrationCloseDate,
    registrationsOpen: value.registrationsOpen ?? true,
    visibility: value.visibility ?? (value.active === false ? 'hidden' : 'public'),
    closedAt: value.closedAt,
    definitivePublishedAt:
      value.definitivePublishedAt ??
      ((value.visibility ?? (value.active === false ? 'hidden' : 'public')) === 'public' &&
      (value.active ?? true)
        ? createdAt
        : undefined),
    seasonVersion: value.seasonVersion ?? 1,
    lastParticipantsResetAt: value.lastParticipantsResetAt,
    baseFeeAmount: isFree ? 0 : baseFeeAmount,
    feePolicy: value.feePolicy ?? 'organizer_absorbs_fees',
    paymentChannel: value.paymentChannel === 'bank' ? 'stripe' : value.paymentChannel ?? 'stripe',
    cashPaymentEnabled: value.cashPaymentEnabled ?? false,
    cashPaymentInstructions: value.cashPaymentInstructions ?? '',
    cashPaymentDeadline: value.cashPaymentDeadline,
    participantAuthMode: value.participantAuthMode ?? 'anonymous',
    participantPhoneRequired: value.participantPhoneRequired ?? false,
    developerCommissionRate: value.developerCommissionRate ?? COMMISSION_RATE,
    providerFeeRate: value.providerFeeRate ?? STRIPE_PROVIDER_FEE_RATE,
    providerFeeFixed: value.providerFeeFixed ?? STRIPE_PROVIDER_FEE_FIXED,
    organizerNetAmount:
      value.organizerNetAmount ??
      Math.max(
        0,
        (isFree ? 0 : feeAmount) -
          (isFree ? 0 : baseFeeAmount * (value.developerCommissionRate ?? COMMISSION_RATE)) -
          (isFree ? 0 : baseFeeAmount * (value.providerFeeRate ?? STRIPE_PROVIDER_FEE_RATE)) -
          (isFree ? 0 : (value.providerFeeFixed ?? STRIPE_PROVIDER_FEE_FIXED))
      ),
    active: value.active ?? true,
    createdAt,
  };
};

const normalizeRegistration = (value: Partial<RegistrationRecord>): RegistrationRecord => {
  const now = new Date().toISOString();
  const rawPaymentStatus = (value as { paymentStatus?: string }).paymentStatus;

  const mappedStatus = (() => {
    if (value.registrationStatus) {
      return value.registrationStatus;
    }
    if (rawPaymentStatus === 'paid') {
      return 'paid' as const;
    }
    if (rawPaymentStatus === 'not_required') {
      return 'paid' as const;
    }
    return 'pending_payment' as const;
  })();

  const mappedPaymentStatus = (() => {
    if (rawPaymentStatus === 'paid') {
      return 'captured' as const;
    }
    if (value.paymentStatus) {
      return value.paymentStatus;
    }
    if (mappedStatus === 'paid' && (value.paymentAmount ?? 0) > 0) {
      return 'captured' as const;
    }
    if (mappedStatus === 'paid' && (value.paymentAmount ?? 0) === 0) {
      return 'not_required' as const;
    }
    return 'pending' as const;
  })();

  return {
    id: value.id ?? randomId('reg_legacy'),
    remoteId: value.remoteId,
    eventId: value.eventId ?? '',
    organizerId: value.organizerId ?? '',
    fullName: value.fullName ?? '',
    email: value.email ?? '',
    phone: value.phone ?? '',
    city: value.city ?? '',
    birthDate: value.birthDate ?? '',
    privacyConsent: value.privacyConsent ?? false,
    retentionConsent: value.retentionConsent ?? false,
    groupParticipantsCount:
      Number.isFinite(value.groupParticipantsCount) && (value.groupParticipantsCount ?? 0) > 0
        ? Number(value.groupParticipantsCount)
        : 1,
    assignedNumber: value.assignedNumber,
    registrationCode: value.registrationCode ?? randomId('code').slice(-8).toUpperCase(),
    registrationStatus: mappedStatus,
    paymentIntentId: value.paymentIntentId,
    paymentStatus: mappedPaymentStatus,
    paymentAmount: value.paymentAmount ?? 0,
    paymentMethod: value.paymentMethod,
    paymentReference: value.paymentReference,
    paymentSessionExpiresAt: value.paymentSessionExpiresAt,
    paymentCapturedAt: value.paymentCapturedAt,
    paymentFailedReason: value.paymentFailedReason,
    refundedAt: value.refundedAt,
    commissionAmount: value.commissionAmount ?? 0,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? value.createdAt ?? now,
  };
};

const normalizePaymentIntent = (value: Partial<PaymentIntentRecord>): PaymentIntentRecord => {
  const now = new Date().toISOString();
  return {
    id: value.id ?? randomId('pi_legacy'),
    registrationId: value.registrationId ?? '',
    eventId: value.eventId ?? '',
    organizerId: value.organizerId ?? '',
    provider: value.provider ?? 'manual_demo',
    currency: 'EUR',
    amount: value.amount ?? 0,
    status: value.status ?? 'pending',
    idempotencyKey: value.idempotencyKey ?? randomId('idem'),
    providerPaymentIntentId: value.providerPaymentIntentId,
    webhookEventId: value.webhookEventId,
    failureReason: value.failureReason,
    expiresAt: value.expiresAt ?? addMinutesIso(15),
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? value.createdAt ?? now,
  };
};

const normalizeSponsorSlot = (value: Partial<SponsorSlot>): SponsorSlot => {
  const now = new Date().toISOString();
  const startsAt = value.startsAt ?? now;
  const endsAt = value.endsAt ?? addMinutesIso(60 * 24);

  return {
    id: value.id ?? randomId('sponsor_legacy'),
    eventId: value.eventId ?? '',
    eventRemoteId: value.eventRemoteId ?? '',
    organizerId: value.organizerId ?? '',
    organizerRemoteId: value.organizerRemoteId ?? '',
    sponsorName: value.sponsorName ?? '',
    sponsorNameIt: value.sponsorNameIt ?? value.sponsorName ?? '',
    sponsorNameEn: value.sponsorNameEn ?? value.sponsorName ?? '',
    sponsorUrl: value.sponsorUrl ?? '',
    sponsorLogoUrl: value.sponsorLogoUrl ?? '',
    packageDays: value.packageDays ?? 1,
    amount: value.amount ?? 0,
    currency: value.currency ?? 'EUR',
    contractTerms: {
      it: value.contractTerms?.it ?? '',
      en: value.contractTerms?.en ?? '',
    },
    stripeCheckoutSessionId: value.stripeCheckoutSessionId,
    stripePaymentIntentId: value.stripePaymentIntentId,
    stripePaymentLinkUrl: value.stripePaymentLinkUrl,
    payerEmail: value.payerEmail,
    status: value.status ?? 'pending_payment',
    active: value.active ?? false,
    startsAt,
    endsAt,
    paidAt: value.paidAt,
    cancelledAt: value.cancelledAt,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? value.createdAt ?? now,
  };
};

export const normalizeData = (
  input: Partial<AppData> | null | undefined,
  fallback: AppData
): AppData => {
  if (!input) {
    return fallback;
  }

  return {
    organizers: Array.isArray(input.organizers)
      ? input.organizers.map((entry) => normalizeOrganizer(entry))
      : fallback.organizers,
    events: Array.isArray(input.events)
      ? input.events.map((entry) => normalizeEvent(entry))
      : fallback.events,
    registrations: Array.isArray(input.registrations)
      ? input.registrations.map((entry) => normalizeRegistration(entry))
      : fallback.registrations,
    paymentIntents: Array.isArray(input.paymentIntents)
      ? input.paymentIntents.map((entry) => normalizePaymentIntent(entry))
      : fallback.paymentIntents,
    sponsorSlots: Array.isArray(input.sponsorSlots)
      ? input.sponsorSlots.map((entry) => normalizeSponsorSlot(entry))
      : fallback.sponsorSlots,
    processedWebhookEventIds: Array.isArray(input.processedWebhookEventIds)
      ? input.processedWebhookEventIds
      : fallback.processedWebhookEventIds,
  };
};
