import { PARTICIPANT_CHECKOUT_URL } from '../constants';
import { PaymentIntentStatus, RegistrationStatus } from '../types';
import { supabase } from './supabaseClient';
import { ensureSupabaseUser } from './supabaseData';

type SyncResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: string;
    };

const fail = <T>(reason: string): SyncResult<T> => ({
  ok: false,
  reason,
});

const PAYMENT_STATUSES: PaymentIntentStatus[] = [
  'pending',
  'requires_action',
  'authorized',
  'captured',
  'failed',
  'expired',
  'refunded',
  'cancelled',
];

const REGISTRATION_STATUSES: RegistrationStatus[] = [
  'pending_payment',
  'pending_cash',
  'paid',
  'cancelled',
  'payment_failed',
  'refunded',
];

const parsePaymentStatus = (value: unknown): PaymentIntentStatus =>
  PAYMENT_STATUSES.includes(value as PaymentIntentStatus)
    ? (value as PaymentIntentStatus)
    : 'pending';

const parseRegistrationStatus = (value: unknown): RegistrationStatus =>
  REGISTRATION_STATUSES.includes(value as RegistrationStatus)
    ? (value as RegistrationStatus)
    : 'pending_payment';

export type ParticipantCheckoutState = {
  state: 'checkout' | 'final';
  checkoutUrl?: string;
  remoteRegistrationId: string;
  remotePaymentIntentId?: string;
  providerPaymentIntentId?: string;
  registrationStatus: RegistrationStatus;
  paymentStatus: PaymentIntentStatus;
  paymentReference?: string;
  assignedNumber?: number;
  paymentCapturedAt?: string;
  paymentFailedReason?: string;
  refundedAt?: string;
  sessionExpiresAt?: string;
};

export const createParticipantCheckout = async (payload: {
  registrationRemoteId: string;
}): Promise<SyncResult<ParticipantCheckoutState>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  if (!PARTICIPANT_CHECKOUT_URL) {
    return fail('EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL non configurato.');
  }

  const auth = await ensureSupabaseUser();
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const session = await supabase.auth.getSession();
  if (session.error) {
    return fail(`Lettura sessione fallita: ${session.error.message}`);
  }

  const accessToken = session.data.session?.access_token;
  if (!accessToken) {
    return fail('Sessione utente mancante: impossibile creare checkout partecipante.');
  }

  let response: Response;
  try {
    response = await fetch(PARTICIPANT_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationId: payload.registrationRemoteId,
      }),
    });
  } catch {
    return fail('Endpoint participant-checkout non raggiungibile.');
  }

  let body: {
    ok?: boolean;
    state?: 'checkout' | 'final';
    checkoutUrl?: string | null;
    remoteRegistrationId?: string | null;
    remotePaymentIntentId?: string | null;
    providerPaymentIntentId?: string | null;
    registrationStatus?: string;
    paymentStatus?: string;
    paymentReference?: string | null;
    assignedNumber?: number | null;
    paymentCapturedAt?: string | null;
    paymentFailedReason?: string | null;
    refundedAt?: string | null;
    sessionExpiresAt?: string | null;
    error?: string;
    detail?: string;
  } = {};

  try {
    body = (await response.json()) as typeof body;
  } catch {
    // keep defaults
  }

  if (!response.ok || !body.ok || !body.remoteRegistrationId || !body.state) {
    const reason = [body.error, body.detail].filter(Boolean).join(': ');
    return fail(reason || `Creazione checkout partecipante fallita (HTTP ${response.status})`);
  }

  const state: ParticipantCheckoutState = {
    state: body.state,
    checkoutUrl: body.checkoutUrl ?? undefined,
    remoteRegistrationId: body.remoteRegistrationId,
    remotePaymentIntentId: body.remotePaymentIntentId ?? undefined,
    providerPaymentIntentId: body.providerPaymentIntentId ?? undefined,
    registrationStatus: parseRegistrationStatus(body.registrationStatus),
    paymentStatus: parsePaymentStatus(body.paymentStatus),
    paymentReference: body.paymentReference ?? undefined,
    assignedNumber:
      typeof body.assignedNumber === 'number' ? body.assignedNumber : undefined,
    paymentCapturedAt: body.paymentCapturedAt ?? undefined,
    paymentFailedReason: body.paymentFailedReason ?? undefined,
    refundedAt: body.refundedAt ?? undefined,
    sessionExpiresAt: body.sessionExpiresAt ?? undefined,
  };

  return {
    ok: true,
    data: state,
  };
};
