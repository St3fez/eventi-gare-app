import { AppData } from './types';

export const STORAGE_KEY = '@eventi_gare_data_v1';
export const COMMISSION_RATE = 0.03;
export const PAYMENT_SESSION_MINUTES = 15;
export const EMAIL_WEBHOOK_URL = process.env.EXPO_PUBLIC_EMAIL_WEBHOOK_URL;
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const SPONSOR_CHECKOUT_URL = process.env.EXPO_PUBLIC_SPONSOR_CHECKOUT_URL;

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

  return {
    organizers: [
      {
        id: organizerId,
        email: 'organizzatore.demo@eventigare.app',
        fiscalData: 'P.IVA 01234567890',
        bankAccount: 'IT60X0542811101000000123456',
        verificationStatus: 'verified',
        payoutEnabled: true,
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
        isFree: true,
        feeAmount: 0,
        privacyText: DEFAULT_PRIVACY_TEXT,
        logoUrl: '',
        localSponsor: 'Sponsor locale: Bar Centrale Torino',
        assignNumbers: true,
        active: true,
        createdAt: now,
      },
      {
        id: 'evt_paid_demo',
        organizerId,
        name: 'Trail delle Colline',
        location: 'Asti',
        date: plusDaysIso(30),
        isFree: false,
        feeAmount: 25,
        privacyText: DEFAULT_PRIVACY_TEXT,
        logoUrl: '',
        localSponsor: '',
        assignNumbers: true,
        active: true,
        createdAt: now,
      },
    ],
    registrations: [],
    paymentIntents: [],
    sponsorSlots: [],
    processedWebhookEventIds: [],
  };
};
