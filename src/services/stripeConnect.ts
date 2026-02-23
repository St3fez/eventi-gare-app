import { EVENT_WEB_BASE_URL, STRIPE_CONNECT_SYNC_URL, STRIPE_CONNECT_URL } from '../constants';
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

export type StripeConnectState = {
  state: 'not_connected' | 'onboarding' | 'ready';
  organizerId: string;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirements?: string[];
  onboardingUrl?: string;
};

const normalizeBaseUrl = (value?: string): string | null => {
  const text = (value ?? '').trim();
  if (!text) {
    return null;
  }
  return text.endsWith('/') ? text.slice(0, -1) : text;
};

const defaultReturnUrl = (): string | undefined => {
  const base = normalizeBaseUrl(EVENT_WEB_BASE_URL);
  return base ? `${base}/?stripeConnect=return` : undefined;
};

const defaultRefreshUrl = (): string | undefined => {
  const base = normalizeBaseUrl(EVENT_WEB_BASE_URL);
  return base ? `${base}/?stripeConnect=refresh` : undefined;
};

const requestStripeConnect = async (
  endpoint: string | undefined,
  payload: Record<string, unknown>
): Promise<SyncResult<StripeConnectState>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  if (!endpoint) {
    return fail('Endpoint Stripe Connect non configurato.');
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
    return fail('Sessione utente mancante: impossibile aprire Stripe Connect.');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return fail('Endpoint Stripe Connect non raggiungibile.');
  }

  let body: {
    ok?: boolean;
    state?: 'not_connected' | 'onboarding' | 'ready';
    organizerId?: string | null;
    accountId?: string | null;
    chargesEnabled?: boolean | null;
    payoutsEnabled?: boolean | null;
    detailsSubmitted?: boolean | null;
    requirements?: string[] | null;
    onboardingUrl?: string | null;
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
    return fail(reason || `Stripe Connect fallito (HTTP ${response.status})`);
  }

  return {
    ok: true,
    data: {
      state: body.state,
      organizerId: body.organizerId,
      accountId: body.accountId ?? undefined,
      chargesEnabled: body.chargesEnabled ?? undefined,
      payoutsEnabled: body.payoutsEnabled ?? undefined,
      detailsSubmitted: body.detailsSubmitted ?? undefined,
      requirements: body.requirements ?? undefined,
      onboardingUrl: body.onboardingUrl ?? undefined,
    },
  };
};

export const startStripeConnectOnboarding = async (payload: {
  organizerId: string;
}): Promise<SyncResult<StripeConnectState>> =>
  requestStripeConnect(STRIPE_CONNECT_URL, {
    organizerId: payload.organizerId,
    returnUrl: defaultReturnUrl(),
    refreshUrl: defaultRefreshUrl(),
  });

export const syncStripeConnectStatus = async (payload: {
  organizerId: string;
}): Promise<SyncResult<StripeConnectState>> =>
  requestStripeConnect(STRIPE_CONNECT_SYNC_URL, {
    organizerId: payload.organizerId,
  });
