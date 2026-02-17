export type OrganizerVerificationStatus =
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type PaymentProvider = 'stripe' | 'manual_demo';

export type PaymentIntentStatus =
  | 'pending'
  | 'requires_action'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'cancelled';

export type RegistrationStatus =
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'payment_failed'
  | 'refunded';

export type SponsorSlotStatus =
  | 'pending_payment'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'payment_failed'
  | 'refunded';

export type ScreenState =
  | { name: 'role' }
  | { name: 'organizerProfile' }
  | { name: 'organizerCreate'; organizerId: string }
  | { name: 'organizerDashboard'; organizerId: string }
  | { name: 'participantSearch' }
  | { name: 'participantRegister'; eventId: string }
  | { name: 'participantPayment'; registrationId: string };

export type OrganizerVerificationChecklist = {
  emailVerified: boolean;
  fiscalDataVerified: boolean;
  ibanOwnershipVerified: boolean;
  identityVerified: boolean;
  manualReviewPassed: boolean;
};

export type OrganizerProfile = {
  id: string;
  remoteId?: string;
  email: string;
  fiscalData?: string;
  bankAccount?: string;
  verificationStatus: OrganizerVerificationStatus;
  payoutEnabled: boolean;
  riskScore: number;
  riskFlags: string[];
  verificationChecklist: OrganizerVerificationChecklist;
  createdAt: string;
  updatedAt: string;
};

export type EventItem = {
  id: string;
  remoteId?: string;
  organizerId: string;
  name: string;
  location: string;
  date: string;
  isFree: boolean;
  feeAmount: number;
  privacyText: string;
  logoUrl?: string;
  localSponsor?: string;
  assignNumbers: boolean;
  active: boolean;
  createdAt: string;
};

export type RegistrationRecord = {
  id: string;
  remoteId?: string;
  eventId: string;
  organizerId: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  birthDate?: string;
  privacyConsent: boolean;
  retentionConsent: boolean;
  assignedNumber?: number;
  registrationCode: string;
  registrationStatus: RegistrationStatus;
  paymentIntentId?: string;
  paymentStatus: PaymentIntentStatus | 'not_required';
  paymentAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentSessionExpiresAt?: string;
  paymentCapturedAt?: string;
  paymentFailedReason?: string;
  refundedAt?: string;
  commissionAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentIntentRecord = {
  id: string;
  registrationId: string;
  eventId: string;
  organizerId: string;
  provider: PaymentProvider;
  currency: 'EUR';
  amount: number;
  status: PaymentIntentStatus;
  idempotencyKey: string;
  providerPaymentIntentId?: string;
  webhookEventId?: string;
  failureReason?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentWebhookType =
  | 'payment_intent.succeeded'
  | 'payment_intent.failed'
  | 'payment_intent.expired'
  | 'payment_intent.refunded';

export type PaymentWebhookPayload = {
  webhookEventId: string;
  paymentIntentId: string;
  type: PaymentWebhookType;
  provider: PaymentProvider;
  providerPaymentIntentId?: string;
  paymentReference?: string;
  reason?: string;
  receivedAt: string;
};

export type SponsorSlot = {
  id: string;
  eventId: string;
  eventRemoteId: string;
  organizerId: string;
  organizerRemoteId: string;
  sponsorName: string;
  sponsorNameIt: string;
  sponsorNameEn: string;
  sponsorUrl?: string;
  sponsorLogoUrl?: string;
  packageDays: number;
  amount: number;
  currency: string;
  contractTerms: {
    it: string;
    en: string;
  };
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripePaymentLinkUrl?: string;
  payerEmail?: string;
  status: SponsorSlotStatus;
  active: boolean;
  startsAt: string;
  endsAt: string;
  paidAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  organizers: OrganizerProfile[];
  events: EventItem[];
  registrations: RegistrationRecord[];
  paymentIntents: PaymentIntentRecord[];
  sponsorSlots: SponsorSlot[];
  processedWebhookEventIds: string[];
};

export type RegistrationDraft = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  birthDate: string;
  privacyConsent: boolean;
  retentionConsent: boolean;
};

export type PaymentInput = {
  method: string;
  reference: string;
  payerName: string;
};

export type FreeInterstitial = {
  eventName: string;
  registrationCode: string;
  sponsor?: string;
};

export type EmailResult = {
  sent: boolean;
  mode: 'webhook' | 'simulated' | 'resend';
  statusCode?: number;
  detail?: string;
};
