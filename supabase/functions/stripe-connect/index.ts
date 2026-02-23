/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.25.0';

type StripeConnectPayload = {
  organizerId?: string;
  returnUrl?: string;
  refreshUrl?: string;
};

type OrganizerRow = {
  id: string;
  user_id: string;
  email: string;
  stripe_connect_account_id: string | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeRedirectUrl = (value: unknown, fallback: string): string => {
  const candidate = cleanText(value);
  if (!candidate) {
    return fallback;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    return fallback;
  }
  return candidate;
};

const normalizeCountry = (value: string | undefined, fallback: string): string => {
  const text = cleanText(value).toUpperCase();
  return text || fallback;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const defaultCountry = normalizeCountry(Deno.env.get('STRIPE_CONNECT_DEFAULT_COUNTRY'), 'IT');
  const defaultReturnUrl =
    Deno.env.get('STRIPE_CONNECT_RETURN_URL') ?? 'https://eventigare.app';
  const defaultRefreshUrl =
    Deno.env.get('STRIPE_CONNECT_REFRESH_URL') ?? defaultReturnUrl;

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
    return json(
      {
        error: 'Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY',
      },
      500
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401);
  }

  let payload: StripeConnectPayload;
  try {
    payload = (await req.json()) as StripeConnectPayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const organizerId = cleanText(payload.organizerId);
  if (!organizerId) {
    return json(
      {
        error: 'Missing required fields',
        required: ['organizerId'],
      },
      400
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const accessToken = authHeader.replace('Bearer ', '').trim();
  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  if (userResult.error || !userResult.data.user) {
    return json(
      {
        error: 'Invalid user token',
        detail: userResult.error?.message,
      },
      401
    );
  }

  const userId = userResult.data.user.id;

  const organizerResult = await supabaseAdmin
    .from('organizers')
    .select(
      'id,user_id,email,stripe_connect_account_id,stripe_connect_charges_enabled,stripe_connect_payouts_enabled,stripe_connect_details_submitted'
    )
    .eq('id', organizerId)
    .eq('user_id', userId)
    .maybeSingle<OrganizerRow>();

  if (organizerResult.error) {
    return json(
      {
        error: 'Organizer lookup failed',
        detail: organizerResult.error.message,
      },
      500
    );
  }

  if (!organizerResult.data) {
    return json({ error: 'Organizer not found or forbidden' }, 404);
  }

  const organizer = organizerResult.data;
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  let accountId = organizer.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: defaultCountry,
      email: organizer.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        organizer_id: organizer.id,
        user_id: userId,
      },
    });
    accountId = account.id;
  }

  const account = await stripe.accounts.retrieve(accountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const nowIso = new Date().toISOString();

  const updateResult = await supabaseAdmin
    .from('organizers')
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_details_submitted: detailsSubmitted,
      stripe_connect_last_sync_at: nowIso,
      payout_enabled: chargesEnabled && payoutsEnabled,
    })
    .eq('id', organizer.id);

  if (updateResult.error) {
    return json(
      {
        error: 'Organizer update failed',
        detail: updateResult.error.message,
      },
      500
    );
  }

  const returnUrl = normalizeRedirectUrl(payload.returnUrl, defaultReturnUrl);
  const refreshUrl = normalizeRedirectUrl(payload.refreshUrl, defaultRefreshUrl);

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  const requirements = Array.isArray(account.requirements?.currently_due)
    ? account.requirements?.currently_due
    : [];

  return json({
    ok: true,
    state: chargesEnabled && payoutsEnabled ? 'ready' : 'onboarding',
    organizerId: organizer.id,
    accountId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    requirements,
    onboardingUrl: link.url,
  });
});
