import { SPONSOR_CHECKOUT_URL, SPONSOR_MODULE_CHECKOUT_URL } from '../constants';
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

export type SponsorSlotRow = {
  id: string;
  event_id: string;
  organizer_id: string;
  sponsor_name: string;
  sponsor_name_it: string;
  sponsor_name_en: string;
  sponsor_url: string | null;
  sponsor_logo_url: string | null;
  package_days: number;
  amount: number;
  currency: string;
  contract_terms: {
    it?: string;
    en?: string;
  };
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_link_url: string | null;
  payer_email: string | null;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled' | 'payment_failed' | 'refunded';
  active: boolean;
  starts_at: string;
  ends_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

const SPONSOR_SELECT =
  'id,event_id,organizer_id,sponsor_name,sponsor_name_it,sponsor_name_en,sponsor_url,sponsor_logo_url,package_days,amount,currency,contract_terms,stripe_checkout_session_id,stripe_payment_intent_id,stripe_payment_link_url,payer_email,status,active,starts_at,ends_at,paid_at,cancelled_at,created_at,updated_at';

export const listSponsorSlotsFromSupabase = async (): Promise<SyncResult<SponsorSlotRow[]>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser();
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const { data, error } = await supabase
    .from('sponsor_slots')
    .select(SPONSOR_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    return fail(`Lettura sponsor slot fallita: ${error.message}`);
  }

  return {
    ok: true,
    data: (data ?? []) as SponsorSlotRow[],
  };
};

export const createSponsorCheckout = async (payload: {
  eventId: string;
  sponsorName: string;
  sponsorNameIt?: string;
  sponsorNameEn?: string;
  sponsorUrl?: string;
  sponsorLogoUrl?: string;
  sponsorEmail?: string;
  packageDays: number;
  amount: number;
  currency?: string;
}): Promise<
  SyncResult<{
    checkoutUrl?: string;
    sponsorSlot: SponsorSlotRow;
    maxPackageDays?: number;
  }>
> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  if (!SPONSOR_CHECKOUT_URL) {
    return fail('EXPO_PUBLIC_SPONSOR_CHECKOUT_URL non configurato.');
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
    return fail('Sessione utente mancante: impossibile creare checkout sponsor.');
  }

  let response: Response;
  try {
    response = await fetch(SPONSOR_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return fail('Endpoint sponsor-checkout non raggiungibile.');
  }

  let body: {
    ok?: boolean;
    checkoutUrl?: string;
    sponsorSlot?: SponsorSlotRow;
    maxPackageDays?: number;
    error?: string;
    detail?: string;
  } = {};

  try {
    body = (await response.json()) as {
      ok?: boolean;
      checkoutUrl?: string;
      sponsorSlot?: SponsorSlotRow;
      maxPackageDays?: number;
      error?: string;
      detail?: string;
    };
  } catch {
    // keep default
  }

  if (!response.ok || !body.sponsorSlot) {
    const reason = [body.error, body.detail].filter(Boolean).join(': ');
    return fail(reason || `Creazione checkout sponsor fallita (HTTP ${response.status})`);
  }

  return {
    ok: true,
    data: {
      checkoutUrl: body.checkoutUrl,
      sponsorSlot: body.sponsorSlot,
      maxPackageDays: body.maxPackageDays,
    },
  };
};

export type SponsorModuleCheckoutState = {
  state: 'checkout' | 'already_active';
  checkoutUrl?: string;
  organizerId: string;
  amount?: number;
  currency?: string;
  activatedAt?: string;
};

export const createSponsorModuleCheckout = async (payload: {
  organizerId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<SyncResult<SponsorModuleCheckoutState>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  if (!SPONSOR_MODULE_CHECKOUT_URL) {
    return fail('EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL non configurato.');
  }

  const auth = await ensureSupabaseUser({ allowAnonymous: false });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const session = await supabase.auth.getSession();
  if (session.error) {
    return fail(`Lettura sessione fallita: ${session.error.message}`);
  }

  const accessToken = session.data.session?.access_token;
  if (!accessToken) {
    return fail('Sessione utente mancante: impossibile creare checkout modulo sponsor.');
  }

  let response: Response;
  try {
    response = await fetch(SPONSOR_MODULE_CHECKOUT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizerId: payload.organizerId,
        successUrl: payload.successUrl,
        cancelUrl: payload.cancelUrl,
      }),
    });
  } catch {
    return fail('Endpoint sponsor-module-checkout non raggiungibile.');
  }

  let body: {
    ok?: boolean;
    state?: 'checkout' | 'already_active';
    checkoutUrl?: string | null;
    organizerId?: string | null;
    amount?: number | null;
    currency?: string | null;
    activatedAt?: string | null;
    error?: string;
    detail?: string;
  } = {};

  try {
    body = (await response.json()) as typeof body;
  } catch {
    // keep defaults
  }

  if (!response.ok || !body.ok || !body.state || !body.organizerId) {
    const reason = [body.error, body.detail].filter(Boolean).join(': ');
    return fail(reason || `Checkout modulo sponsor fallito (HTTP ${response.status})`);
  }

  return {
    ok: true,
    data: {
      state: body.state,
      checkoutUrl: body.checkoutUrl ?? undefined,
      organizerId: body.organizerId,
      amount: typeof body.amount === 'number' ? body.amount : undefined,
      currency: body.currency ?? undefined,
      activatedAt: body.activatedAt ?? undefined,
    },
  };
};
