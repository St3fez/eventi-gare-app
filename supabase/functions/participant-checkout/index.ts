/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.25.0';

type ParticipantCheckoutPayload = {
  registrationId?: string;
  successUrl?: string;
  cancelUrl?: string;
};

type RegistrationRow = {
  id: string;
  event_id: string;
  organizer_id: string;
  participant_user_id: string | null;
  participant_email: string;
  registration_code: string;
  registration_status:
    | 'pending_payment'
    | 'pending_cash'
    | 'paid'
    | 'cancelled'
    | 'payment_failed'
    | 'refunded';
  payment_intent_id: string | null;
  payment_status:
    | 'pending'
    | 'requires_action'
    | 'authorized'
    | 'captured'
    | 'failed'
    | 'expired'
    | 'refunded'
    | 'cancelled'
    | null;
  payment_amount: number;
  commission_amount: number;
  payment_reference: string | null;
  payment_session_expires_at: string | null;
  payment_captured_at: string | null;
  payment_failed_reason: string | null;
  refunded_at: string | null;
  assigned_number: number | null;
};

type PaymentIntentRow = {
  id: string;
  status:
    | 'pending'
    | 'requires_action'
    | 'authorized'
    | 'captured'
    | 'failed'
    | 'expired'
    | 'refunded'
    | 'cancelled';
  provider_payment_intent_id: string | null;
  expires_at: string;
  currency: string;
  amount: number;
};

type OrganizerRow = {
  id: string;
  stripe_connect_account_id: string | null;
  payout_enabled: boolean;
};

const PARTICIPANT_SESSION_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isFinalRegistrationStatus = (
  status: RegistrationRow['registration_status']
): boolean =>
  status === 'paid' ||
  status === 'cancelled' ||
  status === 'payment_failed' ||
  status === 'refunded';

const toAllowedOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const normalizeFallbackUrl = (value: string, fallback: string): string => {
  const candidate = cleanText(value);
  if (!candidate) {
    return fallback;
  }
  return toAllowedOrigin(candidate) ? candidate : fallback;
};

const resolveAllowedOrigins = (
  fallbackUrl: string,
  additionalAllowedOriginsRaw?: string
): Set<string> => {
  const origins = new Set<string>();
  const fallbackOrigin = toAllowedOrigin(fallbackUrl);
  if (fallbackOrigin) {
    origins.add(fallbackOrigin);
  }

  cleanText(additionalAllowedOriginsRaw ?? '')
    .split(',')
    .map((entry) => cleanText(entry))
    .filter(Boolean)
    .forEach((entry) => {
      const parsed = toAllowedOrigin(entry);
      if (parsed) {
        origins.add(parsed);
      }
    });

  // Keep local web testing available without relaxing production origins.
  ['http://localhost:19006', 'http://127.0.0.1:19006'].forEach((entry) => {
    const parsed = toAllowedOrigin(entry);
    if (parsed) {
      origins.add(parsed);
    }
  });

  return origins;
};

const isOriginAllowed = (origin: string, allowedOrigins: Set<string>): boolean =>
  allowedOrigins.size === 0 || allowedOrigins.has(origin);

const normalizeRedirectUrl = (
  value: unknown,
  fallback: string,
  allowedOrigins: Set<string>
): string => {
  const candidate = cleanText(value);
  if (!candidate) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fallback;
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return fallback;
  }
  if (allowedOrigins.size > 0 && !allowedOrigins.has(parsed.origin)) {
    return fallback;
  }
  return parsed.toString();
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  const defaultSuccessUrl = normalizeFallbackUrl(
    Deno.env.get('PARTICIPANT_SUCCESS_URL') ??
      'https://eventigare.app/participant/payment/success',
    'https://eventigare.app/participant/payment/success'
  );
  const defaultCancelUrl = normalizeFallbackUrl(
    Deno.env.get('PARTICIPANT_CANCEL_URL') ??
      'https://eventigare.app/participant/payment/cancel',
    'https://eventigare.app/participant/payment/cancel'
  );
  const allowedOrigins = resolveAllowedOrigins(
    defaultSuccessUrl,
    Deno.env.get('PARTICIPANT_ALLOWED_REDIRECT_ORIGINS')
  );
  const requestOrigin = cleanText(req.headers.get('origin'));

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
    return json(
      {
        error:
          'Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY',
      },
      500
    );
  }

  if (requestOrigin && !isOriginAllowed(requestOrigin, allowedOrigins)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401);
  }

  let payload: ParticipantCheckoutPayload;
  try {
    payload = (await req.json()) as ParticipantCheckoutPayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const registrationId = cleanText(payload.registrationId);
  if (!registrationId) {
    return json(
      {
        error: 'Missing required fields',
        required: ['registrationId'],
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

  const registrationResult = await supabaseAdmin
    .from('registrations')
    .select(
      'id,event_id,organizer_id,participant_user_id,participant_email,registration_code,registration_status,payment_intent_id,payment_status,payment_amount,commission_amount,payment_reference,payment_session_expires_at,payment_captured_at,payment_failed_reason,refunded_at,assigned_number'
    )
    .eq('id', registrationId)
    .maybeSingle<RegistrationRow>();

  if (registrationResult.error) {
    return json(
      {
        error: 'Registration lookup failed',
        detail: registrationResult.error.message,
      },
      500
    );
  }

  const registration = registrationResult.data;
  if (!registration) {
    return json({ error: 'Registration not found' }, 404);
  }

  if (registration.participant_user_id !== userId) {
    return json({ error: 'Forbidden: registration does not belong to current participant' }, 403);
  }

  const organizerResult = await supabaseAdmin
    .from('organizers')
    .select('id,stripe_connect_account_id,payout_enabled')
    .eq('id', registration.organizer_id)
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

  if (!organizerResult.data || !organizerResult.data.stripe_connect_account_id) {
    return json(
      {
        error: 'Organizer Stripe account not configured',
      },
      409
    );
  }

  if (!organizerResult.data.payout_enabled) {
    return json(
      {
        error: 'Organizer Stripe payouts not enabled',
      },
      409
    );
  }

  const latestIntentResult = await supabaseAdmin
    .from('payment_intents')
    .select('id,status,provider_payment_intent_id,expires_at,currency,amount')
    .eq('registration_id', registration.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PaymentIntentRow>();

  if (latestIntentResult.error) {
    return json(
      {
        error: 'Payment intent lookup failed',
        detail: latestIntentResult.error.message,
      },
      500
    );
  }

  let latestIntent = latestIntentResult.data ?? null;

  const resolvedPaymentStatus =
    registration.payment_status ?? latestIntent?.status ?? 'pending';

  if (isFinalRegistrationStatus(registration.registration_status)) {
    return json({
      ok: true,
      state: 'final',
      remoteRegistrationId: registration.id,
      remotePaymentIntentId: latestIntent?.id ?? registration.payment_intent_id,
      providerPaymentIntentId: latestIntent?.provider_payment_intent_id ?? null,
      registrationStatus: registration.registration_status,
      paymentStatus: resolvedPaymentStatus,
      paymentReference: registration.payment_reference,
      assignedNumber: registration.assigned_number,
      paymentCapturedAt: registration.payment_captured_at,
      paymentFailedReason: registration.payment_failed_reason,
      refundedAt: registration.refunded_at,
      sessionExpiresAt:
        registration.payment_session_expires_at ?? latestIntent?.expires_at ?? null,
    });
  }

  if (!Number.isFinite(registration.payment_amount) || registration.payment_amount <= 0) {
    return json(
      {
        error: 'Registration has invalid payment amount',
        detail: registration.payment_amount,
      },
      400
    );
  }

  const now = Date.now();
  const sessionExpiresAt = new Date(
    now + PARTICIPANT_SESSION_MINUTES * 60_000
  ).toISOString();

  let targetIntent = latestIntent;
  let createdIntent = false;

  if (
    !targetIntent ||
    targetIntent.status === 'failed' ||
    targetIntent.status === 'expired' ||
    targetIntent.status === 'cancelled'
  ) {
    const insertedIntent = await supabaseAdmin
      .from('payment_intents')
      .insert({
        registration_id: registration.id,
        event_id: registration.event_id,
        organizer_id: registration.organizer_id,
        provider: 'stripe',
        currency: 'EUR',
        amount: registration.payment_amount,
        status: 'pending',
        idempotency_key: crypto.randomUUID(),
        expires_at: sessionExpiresAt,
      })
      .select('id,status,provider_payment_intent_id,expires_at,currency,amount')
      .single<PaymentIntentRow>();

    if (insertedIntent.error || !insertedIntent.data) {
      return json(
        {
          error: 'Payment intent creation failed',
          detail: insertedIntent.error?.message,
        },
        500
      );
    }

    targetIntent = insertedIntent.data;
    createdIntent = true;
  }

  if (!targetIntent) {
    return json({ error: 'Payment intent unavailable' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  const successUrl = normalizeRedirectUrl(payload.successUrl, defaultSuccessUrl, allowedOrigins);
  const cancelUrl = normalizeRedirectUrl(payload.cancelUrl, defaultCancelUrl, allowedOrigins);

  let session: { id: string; url: string | null; payment_intent: string | null };
  try {
    const amountCents = Math.round(registration.payment_amount * 100);
    const rawCommissionCents = Math.round(registration.commission_amount * 100);
    const applicationFeeAmount = Math.min(Math.max(rawCommissionCents, 0), amountCents);
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: cleanText(registration.participant_email) || undefined,
      metadata: {
        kind: 'registration_payment',
        registration_id: registration.id,
        event_id: registration.event_id,
        organizer_id: registration.organizer_id,
        registration_code: registration.registration_code,
        supabase_payment_intent_id: targetIntent.id,
      },
      payment_intent_data: {
        metadata: {
          kind: 'registration_payment',
          registration_id: registration.id,
          event_id: registration.event_id,
          organizer_id: registration.organizer_id,
          registration_code: registration.registration_code,
          supabase_payment_intent_id: targetIntent.id,
        },
        application_fee_amount: applicationFeeAmount > 0 ? applicationFeeAmount : undefined,
        transfer_data: {
          destination: organizerResult.data.stripe_connect_account_id,
        },
        on_behalf_of: organizerResult.data.stripe_connect_account_id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (targetIntent.currency || 'EUR').toLowerCase(),
            unit_amount: Math.round(registration.payment_amount * 100),
            product_data: {
              name: `Registration fee - ${registration.registration_code}`,
            },
          },
        },
      ],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (createdIntent) {
      await supabaseAdmin
        .from('payment_intents')
        .update({
          status: 'failed',
          failure_reason: `Checkout session creation failed: ${detail}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetIntent.id);
    }

    return json(
      {
        error: 'Stripe checkout session creation failed',
        detail,
      },
      502
    );
  }

  const nowIso = new Date().toISOString();

  const intentUpdate = await supabaseAdmin
    .from('payment_intents')
    .update({
      status: 'requires_action',
      provider_payment_intent_id:
        (session.payment_intent ? String(session.payment_intent) : null) ??
        targetIntent.provider_payment_intent_id,
      failure_reason: null,
      expires_at: sessionExpiresAt,
      updated_at: nowIso,
    })
    .eq('id', targetIntent.id)
    .select('id,status,provider_payment_intent_id,expires_at,currency,amount')
    .single<PaymentIntentRow>();

  if (intentUpdate.error || !intentUpdate.data) {
    return json(
      {
        error: 'Payment intent update failed',
        detail: intentUpdate.error?.message,
      },
      500
    );
  }

  const registrationUpdate = await supabaseAdmin
    .from('registrations')
    .update({
      payment_intent_id: intentUpdate.data.id,
      registration_status: 'pending_payment',
      payment_status: 'requires_action',
      payment_session_expires_at: sessionExpiresAt,
      payment_failed_reason: null,
      updated_at: nowIso,
    })
    .eq('id', registration.id);

  if (registrationUpdate.error) {
    return json(
      {
        error: 'Registration update failed',
        detail: registrationUpdate.error.message,
      },
      500
    );
  }

  return json({
    ok: true,
    state: 'checkout',
    checkoutUrl: session.url,
    remoteRegistrationId: registration.id,
    remotePaymentIntentId: intentUpdate.data.id,
    providerPaymentIntentId: intentUpdate.data.provider_payment_intent_id,
    registrationStatus: 'pending_payment',
    paymentStatus: 'requires_action',
    paymentReference: registration.payment_reference,
    assignedNumber: registration.assigned_number,
    paymentCapturedAt: registration.payment_captured_at,
    paymentFailedReason: null,
    refundedAt: registration.refunded_at,
    sessionExpiresAt: sessionExpiresAt,
  });
});
