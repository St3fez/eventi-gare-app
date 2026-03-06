import { AppData } from './types';

declare const process: {
  env: Record<string, string | undefined>;
};

export const STORAGE_KEY = '@eventi_gare_data_v1';
export const COMMISSION_RATE = 0.03;
export const STRIPE_PROVIDER_FEE_RATE = 0.015;
export const STRIPE_PROVIDER_FEE_FIXED = 0.25;
export const BANK_PROVIDER_FEE_RATE = 0;
export const BANK_PROVIDER_FEE_FIXED = 0;
export const PAYMENT_SESSION_MINUTES = 15;
export const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;

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

// Expo replaces EXPO_PUBLIC_* at bundle time. Public fallbacks keep GitHub Pages stable.
const expoPublicEnv = {
  APP_CHANNEL: process.env.EXPO_PUBLIC_APP_CHANNEL ?? 'prod',
  ORGANIZER_TEST_MODE: process.env.EXPO_PUBLIC_ORGANIZER_TEST_MODE ?? 'false',
  ORGANIZER_SECURITY_ENFORCED:
    process.env.EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED ?? 'true',
  PARTICIPANT_SECURITY_ENFORCED:
    process.env.EXPO_PUBLIC_PARTICIPANT_SECURITY_ENFORCED,
  DEMO_ALL_OPEN: process.env.EXPO_PUBLIC_DEMO_ALL_OPEN ?? 'false',
  ADMOB_ENABLED: process.env.EXPO_PUBLIC_ADMOB_ENABLED ?? 'true',
  ADMOB_TEST_MODE: process.env.EXPO_PUBLIC_ADMOB_TEST_MODE ?? 'true',
  PAID_FEATURE_UNLOCK_CONTACT:
    process.env.EXPO_PUBLIC_PAID_FEATURE_UNLOCK_CONTACT ?? 'profstefanoferrari',
  ADMIN_CONTACT_EMAIL:
    process.env.EXPO_PUBLIC_ADMIN_CONTACT_EMAIL ?? 'profstefanoferrari@gmail.com',
  EMAIL_WEBHOOK_URL:
    process.env.EXPO_PUBLIC_EMAIL_WEBHOOK_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/send-confirmation',
  ORGANIZER_COMPLIANCE_WEBHOOK_URL:
    process.env.EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/send-organizer-compliance',
  EVENT_WEB_BASE_URL:
    process.env.EXPO_PUBLIC_EVENT_WEB_BASE_URL ?? 'https://st3fez.github.io/eventi-gare-app',
  PRIVACY_POLICY_URL:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
    'https://st3fez.github.io/eventi-gare-app/privacy-policy',
  SUPABASE_URL:
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://sjargirgkjkxvvggcuwa.supabase.co',
  SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYXJnaXJna2preHZ2Z2djdXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzE1NzcsImV4cCI6MjA4NjkwNzU3N30.LfjFAVOyEld101-kSZy8IJ0dsC0XKr9vfDN9e29oANA',
  SPONSOR_CHECKOUT_URL:
    process.env.EXPO_PUBLIC_SPONSOR_CHECKOUT_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/sponsor-checkout',
  SPONSOR_MODULE_CHECKOUT_URL:
    process.env.EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/sponsor-module-checkout',
  STRIPE_CONNECT_URL:
    process.env.EXPO_PUBLIC_STRIPE_CONNECT_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/stripe-connect',
  STRIPE_CONNECT_SYNC_URL:
    process.env.EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/stripe-connect-sync',
  PARTICIPANT_CHECKOUT_URL:
    process.env.EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL ??
    'https://sjargirgkjkxvvggcuwa.functions.supabase.co/participant-checkout',
  ADMOB_BANNER_UNIT_ID_ANDROID:
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID ??
    'ca-app-pub-3940256099942544/6300978111',
  ADMOB_BANNER_UNIT_ID_IOS:
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS ??
    'ca-app-pub-3940256099942544/2934735716',
  ADMOB_INTERSTITIAL_UNIT_ID_ANDROID:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID ??
    'ca-app-pub-3940256099942544/1033173712',
  ADMOB_INTERSTITIAL_UNIT_ID_IOS:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS ??
    'ca-app-pub-3940256099942544/4411468910',
} as const;

export const APP_CHANNEL: 'demo' | 'prod' =
  String(expoPublicEnv.APP_CHANNEL ?? '').trim().toLowerCase() === 'demo'
    ? 'demo'
    : 'prod';
export const IS_DEMO_CHANNEL = APP_CHANNEL === 'demo';

const organizerTestModeFromEnv = parseEnvBoolean(expoPublicEnv.ORGANIZER_TEST_MODE);
export const ORGANIZER_TEST_MODE = organizerTestModeFromEnv ?? IS_DEMO_CHANNEL;

const organizerSecurityFromEnv = parseEnvBoolean(
  expoPublicEnv.ORGANIZER_SECURITY_ENFORCED
);
export const ORGANIZER_SECURITY_ENFORCED =
  !ORGANIZER_TEST_MODE && (organizerSecurityFromEnv ?? true);

const participantSecurityFromEnv = parseEnvBoolean(
  expoPublicEnv.PARTICIPANT_SECURITY_ENFORCED
);
export const PARTICIPANT_SECURITY_ENFORCED =
  !IS_DEMO_CHANNEL && (participantSecurityFromEnv ?? true);

const demoAllOpenFromEnv = parseEnvBoolean(expoPublicEnv.DEMO_ALL_OPEN);
export const DEMO_ALL_OPEN = demoAllOpenFromEnv ?? IS_DEMO_CHANNEL;

const admobEnabledFromEnv = parseEnvBoolean(expoPublicEnv.ADMOB_ENABLED);
export const ADMOB_ENABLED = admobEnabledFromEnv ?? false;
const admobTestFromEnv = parseEnvBoolean(expoPublicEnv.ADMOB_TEST_MODE);
export const ADMOB_TEST_MODE = admobTestFromEnv ?? IS_DEMO_CHANNEL;

export const PAID_FEATURE_UNLOCK_CONTACT =
  expoPublicEnv.PAID_FEATURE_UNLOCK_CONTACT ?? 'profstefanoferrari';
export const SPONSOR_MODULE_ACTIVATION_EUR = 25;
export const ADMIN_CONTACT_EMAIL =
  expoPublicEnv.ADMIN_CONTACT_EMAIL ?? 'profstefanoferrari@gmail.com';
export const EMAIL_WEBHOOK_URL = expoPublicEnv.EMAIL_WEBHOOK_URL;
export const ORGANIZER_COMPLIANCE_WEBHOOK_URL =
  expoPublicEnv.ORGANIZER_COMPLIANCE_WEBHOOK_URL;
export const EVENT_WEB_BASE_URL = expoPublicEnv.EVENT_WEB_BASE_URL;
export const PRIVACY_POLICY_URL =
  expoPublicEnv.PRIVACY_POLICY_URL || EVENT_WEB_BASE_URL;
export const SUPABASE_URL = expoPublicEnv.SUPABASE_URL;
export const SUPABASE_ANON_KEY = expoPublicEnv.SUPABASE_ANON_KEY;
export const SPONSOR_CHECKOUT_URL = expoPublicEnv.SPONSOR_CHECKOUT_URL;
export const SPONSOR_MODULE_CHECKOUT_URL =
  expoPublicEnv.SPONSOR_MODULE_CHECKOUT_URL;
export const STRIPE_CONNECT_URL = expoPublicEnv.STRIPE_CONNECT_URL;
export const STRIPE_CONNECT_SYNC_URL = expoPublicEnv.STRIPE_CONNECT_SYNC_URL;
export const PARTICIPANT_CHECKOUT_URL = expoPublicEnv.PARTICIPANT_CHECKOUT_URL;
export const ADMOB_BANNER_UNIT_ID_ANDROID =
  expoPublicEnv.ADMOB_BANNER_UNIT_ID_ANDROID;
export const ADMOB_BANNER_UNIT_ID_IOS =
  expoPublicEnv.ADMOB_BANNER_UNIT_ID_IOS;
export const ADMOB_INTERSTITIAL_UNIT_ID_ANDROID =
  expoPublicEnv.ADMOB_INTERSTITIAL_UNIT_ID_ANDROID;
export const ADMOB_INTERSTITIAL_UNIT_ID_IOS =
  expoPublicEnv.ADMOB_INTERSTITIAL_UNIT_ID_IOS;

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
  const seedDemoCatalog = IS_DEMO_CHANNEL || DEMO_ALL_OPEN;
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
    organizers: seedDemoCatalog
      ? [
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
    ]
      : [],
    events: seedDemoCatalog
      ? [
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
    ]
      : [],
    registrations: [],
    paymentIntents: [],
    sponsorSlots,
    processedWebhookEventIds: [],
  };
};
