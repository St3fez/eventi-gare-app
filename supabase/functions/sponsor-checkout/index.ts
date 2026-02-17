/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.25.0';

type SponsorCheckoutPayload = {
  eventId?: string;
  sponsorName?: string;
  sponsorNameIt?: string;
  sponsorNameEn?: string;
  sponsorUrl?: string;
  sponsorLogoUrl?: string;
  packageDays?: number;
  amount?: number;
  currency?: string;
  sponsorEmail?: string;
};

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  organizer_id: string;
};

const json = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const cleanText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asPositiveNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
};

const normalizeCurrency = (value: unknown, fallback = 'EUR'): string => {
  const text = cleanText(value).toUpperCase();
  return text || fallback;
};

const asPositiveInt = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
};

const buildContractTerms = (params: {
  sponsorNameIt: string;
  sponsorNameEn: string;
  eventName: string;
  packageDays: number;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
}) => {
  const formatDateTime = (value: Date) => value.toISOString().replace('T', ' ').slice(0, 16);
  const amountLine = `${params.currency} ${params.amount.toFixed(2)}`;

  return {
    it: `Contratto sponsor per \"${params.sponsorNameIt}\" su evento \"${params.eventName}\". Pacchetto ${params.packageDays} giorni (${formatDateTime(params.startsAt)} - ${formatDateTime(params.endsAt)}), importo ${amountLine}. Visibilita banner solo con pagamento confermato, slot attivo e non scaduto.`,
    en: `Sponsor contract for \"${params.sponsorNameEn}\" on event \"${params.eventName}\". ${params.packageDays}-day package (${formatDateTime(params.startsAt)} - ${formatDateTime(params.endsAt)}), amount ${amountLine}. Banner visibility only after confirmed payment, active slot and not expired.`,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const sponsorSuccessUrl =
    Deno.env.get('SPONSOR_SUCCESS_URL') ?? 'https://eventigare.app/sponsor/success';
  const sponsorCancelUrl =
    Deno.env.get('SPONSOR_CANCEL_URL') ?? 'https://eventigare.app/sponsor/cancel';
  const defaultCurrency = Deno.env.get('SPONSOR_DEFAULT_CURRENCY') ?? 'EUR';

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

  let payload: SponsorCheckoutPayload;
  try {
    payload = (await req.json()) as SponsorCheckoutPayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const eventId = cleanText(payload.eventId);
  const sponsorName = cleanText(payload.sponsorName || payload.sponsorNameIt || payload.sponsorNameEn);
  const sponsorNameIt = cleanText(payload.sponsorNameIt || sponsorName);
  const sponsorNameEn = cleanText(payload.sponsorNameEn || sponsorName);
  const sponsorUrl = cleanText(payload.sponsorUrl);
  const sponsorLogoUrl = cleanText(payload.sponsorLogoUrl);
  const sponsorEmail = cleanText(payload.sponsorEmail).toLowerCase();
  const amount = asPositiveNumber(payload.amount);
  const packageDays = asPositiveInt(payload.packageDays);
  const currency = normalizeCurrency(payload.currency, defaultCurrency);

  if (!eventId || !sponsorName || !sponsorNameIt || !sponsorNameEn || !amount || !packageDays) {
    return json(
      {
        error: 'Missing required fields',
        required: ['eventId', 'sponsorName', 'packageDays', 'amount'],
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

  const eventResult = await supabaseAdmin
    .from('events')
    .select('id,name,event_date,organizer_id')
    .eq('id', eventId)
    .maybeSingle<EventRow>();

  if (eventResult.error) {
    return json({ error: 'Event lookup failed', detail: eventResult.error.message }, 500);
  }

  if (!eventResult.data) {
    return json({ error: 'Event not found' }, 404);
  }

  const organizerAccess = await supabaseAdmin
    .from('organizers')
    .select('id')
    .eq('id', eventResult.data.organizer_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (organizerAccess.error) {
    return json({ error: 'Organizer ownership check failed', detail: organizerAccess.error.message }, 500);
  }

  if (!organizerAccess.data) {
    return json({ error: 'Forbidden: event does not belong to current organizer' }, 403);
  }

  const now = new Date();
  const eventEnd = new Date(`${eventResult.data.event_date}T23:59:59.999Z`);
  if (Number.isNaN(eventEnd.getTime()) || eventEnd.getTime() <= now.getTime()) {
    return json({ error: 'Event date is in the past, sponsor package cannot be created' }, 400);
  }

  const dayMs = 86_400_000;
  const maxDays = Math.max(1, Math.ceil((eventEnd.getTime() - now.getTime()) / dayMs));
  if (packageDays > maxDays) {
    return json(
      {
        error: 'Package duration exceeds event lifetime',
        maxPackageDays: maxDays,
      },
      400
    );
  }

  const startsAt = now;
  const projectedEnd = new Date(now.getTime() + packageDays * dayMs);
  const endsAt = projectedEnd.getTime() > eventEnd.getTime() ? eventEnd : projectedEnd;

  const contractTerms = buildContractTerms({
    sponsorNameIt,
    sponsorNameEn,
    eventName: eventResult.data.name,
    packageDays,
    amount,
    currency,
    startsAt,
    endsAt,
  });

  const slotId = crypto.randomUUID();

  const slotInsert = await supabaseAdmin.from('sponsor_slots').insert({
    id: slotId,
    event_id: eventResult.data.id,
    organizer_id: eventResult.data.organizer_id,
    sponsor_name: sponsorName,
    sponsor_name_it: sponsorNameIt,
    sponsor_name_en: sponsorNameEn,
    sponsor_url: sponsorUrl || null,
    sponsor_logo_url: sponsorLogoUrl || null,
    package_days: packageDays,
    amount,
    currency,
    contract_terms: contractTerms,
    status: 'pending_payment',
    active: false,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    payer_email: sponsorEmail || null,
  });

  if (slotInsert.error) {
    return json({ error: 'Insert sponsor slot failed', detail: slotInsert.error.message }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  let session: { id: string; url?: string | null; payment_intent?: string | null };
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: sponsorSuccessUrl,
      cancel_url: sponsorCancelUrl,
      customer_email: sponsorEmail || undefined,
      metadata: {
        kind: 'sponsor_slot',
        sponsor_slot_id: slotId,
        event_id: eventResult.data.id,
        organizer_id: eventResult.data.organizer_id,
      },
      payment_intent_data: {
        metadata: {
          kind: 'sponsor_slot',
          sponsor_slot_id: slotId,
          event_id: eventResult.data.id,
          organizer_id: eventResult.data.organizer_id,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Sponsor package - ${eventResult.data.name}`,
              description: `${packageDays} day package`,
            },
          },
        },
      ],
    });
  } catch (error) {
    await supabaseAdmin.from('sponsor_slots').delete().eq('id', slotId);
    return json(
      {
        error: 'Stripe checkout session creation failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }

  const updateResult = await supabaseAdmin
    .from('sponsor_slots')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_link_url: session.url ?? null,
      stripe_payment_intent_id: session.payment_intent ?? null,
    })
    .eq('id', slotId)
    .select(
      'id,event_id,organizer_id,sponsor_name,sponsor_name_it,sponsor_name_en,sponsor_url,sponsor_logo_url,package_days,amount,currency,contract_terms,status,active,starts_at,ends_at,paid_at,cancelled_at,created_at,updated_at,stripe_checkout_session_id,stripe_payment_intent_id,stripe_payment_link_url,payer_email'
    )
    .single();

  if (updateResult.error) {
    return json({ error: 'Sponsor slot update failed', detail: updateResult.error.message }, 500);
  }

  return json({
    ok: true,
    checkoutUrl: session.url,
    sponsorSlot: updateResult.data,
    maxPackageDays: maxDays,
  });
});
