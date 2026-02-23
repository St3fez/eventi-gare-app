import { AppData } from './types';

export const STORAGE_KEY = '@eventi_gare_data_v1';
export const COMMISSION_RATE = 0.03;
export const STRIPE_PROVIDER_FEE_RATE = 0.015;
export const STRIPE_PROVIDER_FEE_FIXED = 0.25;
export const BANK_PROVIDER_FEE_RATE = 0;
export const BANK_PROVIDER_FEE_FIXED = 0;
export const PAYMENT_SESSION_MINUTES = 15;

const parseEnvBoolean = (value: string | undefined): boolean | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return null;
};

export const APP_CHANNEL: 'demo' | 'prod' =
  String(process.env.EXPO_PUBLIC_APP_CHANNEL ?? '').trim().toLowerCase() === 'demo'
    ? 'demo'
    : 'prod';
export const IS_DEMO_CHANNEL = APP_CHANNEL === 'demo';

const organizerTestModeFromEnv = parseEnvBoolean(process.env.EXPO_PUBLIC_ORGANIZER_TEST_MODE);
export const ORGANIZER_TEST_MODE = organizerTestModeFromEnv ?? IS_DEMO_CHANNEL;

const organizerSecurityFromEnv = parseEnvBoolean(
  process.env.EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED
);
export const ORGANIZER_SECURITY_ENFORCED =
  !ORGANIZER_TEST_MODE && (organizerSecurityFromEnv ?? true);

const demoAllOpenFromEnv = parseEnvBoolean(process.env.EXPO_PUBLIC_DEMO_ALL_OPEN);
export const DEMO_ALL_OPEN = demoAllOpenFromEnv ?? IS_DEMO_CHANNEL;

const admobEnabledFromEnv = parseEnvBoolean(process.env.EXPO_PUBLIC_ADMOB_ENABLED);
export const ADMOB_ENABLED = admobEnabledFromEnv ?? false;
const admobTestFromEnv = parseEnvBoolean(process.env.EXPO_PUBLIC_ADMOB_TEST_MODE);
export const ADMOB_TEST_MODE = admobTestFromEnv ?? IS_DEMO_CHANNEL;

export const PAID_FEATURE_UNLOCK_CONTACT =
  process.env.EXPO_PUBLIC_PAID_FEATURE_UNLOCK_CONTACT ?? 'profstefanoferrari';
export const SPONSOR_MODULE_ACTIVATION_EUR = 25;
export const ADMIN_CONTACT_EMAIL =
  process.env.EXPO_PUBLIC_ADMIN_CONTACT_EMAIL ?? 'profstefanoferrari@gmail.com';
export const EMAIL_WEBHOOK_URL = process.env.EXPO_PUBLIC_EMAIL_WEBHOOK_URL;
export const ORGANIZER_COMPLIANCE_WEBHOOK_URL =
  process.env.EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL;
export const EVENT_WEB_BASE_URL = process.env.EXPO_PUBLIC_EVENT_WEB_BASE_URL;
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const SPONSOR_CHECKOUT_URL = process.env.EXPO_PUBLIC_SPONSOR_CHECKOUT_URL;
export const SPONSOR_MODULE_CHECKOUT_URL =
  process.env.EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL;
export const STRIPE_CONNECT_URL = process.env.EXPO_PUBLIC_STRIPE_CONNECT_URL;
export const STRIPE_CONNECT_SYNC_URL = process.env.EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL;
export const PARTICIPANT_CHECKOUT_URL = process.env.EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL;
export const ADMOB_BANNER_UNIT_ID_ANDROID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID;
export const ADMOB_BANNER_UNIT_ID_IOS =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS;
export const ADMOB_INTERSTITIAL_UNIT_ID_ANDROID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID;
export const ADMOB_INTERSTITIAL_UNIT_ID_IOS =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS;

export const DEFAULT_PRIVACY_TEXT =
  'Autorizzo il trattamento dei dati personali solo per gestione iscrizione, comunicazioni evento e obblighi fiscali previsti.';

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
]);

const plusDaysIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const createDefaultData = (): AppData => {
  const organizerId = 'org_demo';
  const now = new Date().toISOString();
  const futureStart = plusDaysIso(5);
  const futureEnd = plusDaysIso(25);
  const sponsorSlots: AppData['sponsorSlots'] = DEMO_ALL_OPEN
    ? [
        {
          id: 'slt_demo_active',
          eventId: 'evt_free_demo',
          eventRemoteId: '',
          organizerId,
          organizerRemoteId: '',
          sponsorName: 'Demo Sponsor Running Shop',
          sponsorNameIt: 'Demo Sponsor Running Shop',
          sponsorNameEn: 'Demo Sponsor Running Shop',
          sponsorUrl: 'https://example.org',
          sponsorLogoUrl: '',
          packageDays: 20,
          amount: 120,
          currency: 'EUR',
          contractTerms: {
            it: 'Contratto demo sponsor attivo.',
            en: 'Demo sponsor active contract.',
          },
          stripeCheckoutSessionId: 'cs_demo_sponsor',
          stripePaymentIntentId: 'pi_demo_sponsor',
          stripePaymentLinkUrl: 'https://example.org/checkout-demo',
          payerEmail: 'sponsor@example.org',
          status: 'active' as const,
          active: true,
          startsAt: `${futureStart}T09:00:00.000Z`,
          endsAt: `${futureEnd}T23:59:59.999Z`,
          paidAt: now,
          cancelledAt: undefined,
          createdAt: now,
          updatedAt: now,
        },
      ]
    : [];

  return {
    organizers: [
      {
        id: organizerId,
        email: 'organizzatore.demo@eventigare.app',
        organizationName: 'Fondazione Demo Eventi',
        organizationRole: 'presidente_fondazione',
        organizationRoleLabel: '',
        legalRepresentative: 'Mario Rossi',
        officialPhone: '+393331234567',
        fiscalData: 'P.IVA 01234567890',
        bankAccount: 'IT60X0542811101000000123456',
        complianceDocuments: {
          identityDocumentUrl: 'https://example.org/docs/id-demo.pdf',
          organizationDocumentUrl: 'https://example.org/docs/statuto-demo.pdf',
          paymentAuthorizationDocumentUrl:
            'https://example.org/docs/delega-incassi-demo.pdf',
          adminContactMessage: '',
        },
        complianceSubmittedAt: now,
        verificationStatus: 'verified',
        payoutEnabled: true,
        paidFeatureUnlocked: true,
        paidFeatureUnlockRequestedAt: now,
        paidFeatureUnlockContact: PAID_FEATURE_UNLOCK_CONTACT,
        sponsorModuleEnabled: DEMO_ALL_OPEN,
        sponsorModuleActivatedAt: DEMO_ALL_OPEN ? now : undefined,
        sponsorModuleActivationAmount: SPONSOR_MODULE_ACTIVATION_EUR,
        stripeConnectAccountId: DEMO_ALL_OPEN ? 'acct_demo' : undefined,
        stripeConnectChargesEnabled: DEMO_ALL_OPEN,
        stripeConnectPayoutsEnabled: DEMO_ALL_OPEN,
        stripeConnectDetailsSubmitted: DEMO_ALL_OPEN,
        stripeConnectRequirements: [],
        stripeConnectLastSyncAt: DEMO_ALL_OPEN ? now : undefined,
        riskScore: 0,
        riskFlags: [],
        verificationChecklist: {
          emailVerified: true,
          fiscalDataVerified: true,
          ibanOwnershipVerified: true,
          identityVerified: true,
          manualReviewPassed: true,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    events: [
      {
        id: 'evt_free_demo',
        organizerId,
        name: 'Camminata Cittadina',
        location: 'Torino Centro',
        date: plusDaysIso(12),
        endDate: plusDaysIso(12),
        startTime: '09:00',
        isFree: true,
        feeAmount: 0,
        privacyText: DEFAULT_PRIVACY_TEXT,
        logoUrl: '',
        localSponsor: 'Sponsor locale: Bar Centrale Torino',
        assignNumbers: true,
        registrationOpenDate: new Date().toISOString().slice(0, 10),
        registrationCloseDate: plusDaysIso(11),
        registrationsOpen: true,
        visibility: 'public',
        closedAt: undefined,
        definitivePublishedAt: now,
        seasonVersion: 1,
        lastParticipantsResetAt: undefined,
        baseFeeAmount: 0,
        feePolicy: 'organizer_absorbs_fees',
        paymentChannel: 'stripe',
        cashPaymentEnabled: false,
        cashPaymentInstructions: '',
        cashPaymentDeadline: undefined,
        participantAuthMode: 'anonymous',
        participantPhoneRequired: false,
        developerCommissionRate: COMMISSION_RATE,
        providerFeeRate: BANK_PROVIDER_FEE_RATE,
        providerFeeFixed: BANK_PROVIDER_FEE_FIXED,
        organizerNetAmount: 0,
        active: true,
        createdAt: now,
      },
      {
        id: 'evt_paid_demo',
        organizerId,
        name: 'Trail delle Colline',
        location: 'Asti',
        date: plusDaysIso(30),
        endDate: plusDaysIso(31),
        startTime: '08:30',
        isFree: false,
        feeAmount: 25,
        privacyText: DEFAULT_PRIVACY_TEXT,
        logoUrl: '',
        localSponsor: '',
        assignNumbers: true,
        registrationOpenDate: new Date().toISOString().slice(0, 10),
        registrationCloseDate: plusDaysIso(29),
        registrationsOpen: true,
        visibility: 'public',
        closedAt: undefined,
        definitivePublishedAt: now,
        seasonVersion: 1,
        lastParticipantsResetAt: undefined,
        baseFeeAmount: 25,
        feePolicy: 'participant_pays_fees',
        paymentChannel: 'stripe',
        cashPaymentEnabled: false,
        cashPaymentInstructions: '',
        cashPaymentDeadline: undefined,
        participantAuthMode: 'anonymous',
        participantPhoneRequired: false,
        developerCommissionRate: COMMISSION_RATE,
        providerFeeRate: STRIPE_PROVIDER_FEE_RATE,
        providerFeeFixed: STRIPE_PROVIDER_FEE_FIXED,
        organizerNetAmount: 25,
        active: true,
        createdAt: now,
      },
    ],
    registrations: [],
    paymentIntents: [],
    sponsorSlots,
    processedWebhookEventIds: [],
  };
};
