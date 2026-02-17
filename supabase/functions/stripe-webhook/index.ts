/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.25.0';

type RegistrationWebhookType =
  | 'payment_intent.succeeded'
  | 'payment_intent.failed'
  | 'payment_intent.expired'
  | 'payment_intent.refunded';

type SponsorWebhookType =
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'payment_intent.payment_failed'
  | 'charge.refunded';

type RegistrationMappedWebhook = {
  eventType: RegistrationWebhookType;
  providerPaymentIntentId: string;
  paymentReference?: string;
  reason?: string;
  metadata?: Record<string, string>;
};

type SponsorMappedWebhook = {
  eventType: SponsorWebhookType;
  sponsorSlotId: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paymentLinkUrl?: string;
  payerEmail?: string;
};

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

type StripePaymentIntent = {
  id: string;
  latest_charge?: unknown;
  metadata?: Record<string, string>;
  last_payment_error?: { message?: string };
  cancellation_reason?: string;
};

type StripeCharge = {
  id: string;
  payment_intent?: unknown;
  metadata?: Record<string, string>;
};

type StripeCheckoutSession = {
  id: string;
  payment_intent?: unknown;
  metadata?: Record<string, string>;
  url?: string | null;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
  };
};

const jsonResponse = (payload: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const hasSponsorMetadata = (metadata?: Record<string, string>): boolean =>
  Boolean(metadata?.kind === 'sponsor_slot' && metadata?.sponsor_slot_id);

const mapStripeSponsorEvent = (event: StripeEvent): SponsorMappedWebhook | null => {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
    const session = event.data.object as StripeCheckoutSession;
    if (!hasSponsorMetadata(session.metadata)) {
      return null;
    }

    return {
      eventType: event.type,
      sponsorSlotId: String(session.metadata?.sponsor_slot_id),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
      paymentLinkUrl: session.url ?? undefined,
      payerEmail: session.customer_details?.email ?? session.customer_email ?? undefined,
    };
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as StripePaymentIntent;
    if (!hasSponsorMetadata(intent.metadata)) {
      return null;
    }

    return {
      eventType: 'payment_intent.payment_failed',
      sponsorSlotId: String(intent.metadata?.sponsor_slot_id),
      stripePaymentIntentId: intent.id,
    };
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as StripeCharge;
    if (!hasSponsorMetadata(charge.metadata)) {
      return null;
    }

    return {
      eventType: 'charge.refunded',
      sponsorSlotId: String(charge.metadata?.sponsor_slot_id),
      stripePaymentIntentId: charge.payment_intent ? String(charge.payment_intent) : undefined,
    };
  }

  return null;
};

const mapStripeRegistrationEvent = (
  event: StripeEvent
): RegistrationMappedWebhook | null => {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as StripePaymentIntent;
      if (hasSponsorMetadata(intent.metadata)) {
        return null;
      }
      return {
        eventType: 'payment_intent.succeeded',
        providerPaymentIntentId: intent.id,
        paymentReference: intent.latest_charge ? String(intent.latest_charge) : intent.id,
        metadata: intent.metadata,
      };
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as StripePaymentIntent;
      if (hasSponsorMetadata(intent.metadata)) {
        return null;
      }
      return {
        eventType: 'payment_intent.failed',
        providerPaymentIntentId: intent.id,
        paymentReference: intent.latest_charge ? String(intent.latest_charge) : intent.id,
        reason:
          intent.last_payment_error?.message ??
          intent.cancellation_reason ??
          'Pagamento non autorizzato',
        metadata: intent.metadata,
      };
    }
    case 'payment_intent.canceled': {
      const intent = event.data.object as StripePaymentIntent;
      if (hasSponsorMetadata(intent.metadata)) {
        return null;
      }
      return {
        eventType: 'payment_intent.expired',
        providerPaymentIntentId: intent.id,
        paymentReference: intent.id,
        reason: intent.cancellation_reason ?? 'Pagamento annullato/scaduto',
        metadata: intent.metadata,
      };
    }
    case 'charge.refunded': {
      const charge = event.data.object as StripeCharge;
      if (hasSponsorMetadata(charge.metadata)) {
        return null;
      }
      if (!charge.payment_intent) {
        return null;
      }
      return {
        eventType: 'payment_intent.refunded',
        providerPaymentIntentId: String(charge.payment_intent),
        paymentReference: charge.id,
        metadata: charge.metadata,
      };
    }
    default:
      return null;
  }
};

const resolveInternalPaymentIntentId = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  providerPaymentIntentId: string,
  metadata?: Record<string, string>
): Promise<string | null> => {
  const metadataId = metadata?.supabase_payment_intent_id;
  if (metadataId) {
    return metadataId;
  }

  const { data, error } = await supabaseAdmin
    .from('payment_intents')
    .select('id')
    .eq('provider_payment_intent_id', providerPaymentIntentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lookup payment_intents fallito: ${error.message}`);
  }

  return data?.id ?? null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSigningSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey || !stripeWebhookSigningSecret) {
    return jsonResponse(
      {
        error:
          'Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SIGNING_SECRET',
      },
      500
    );
  }

  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing Stripe-Signature header' }, 400);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const rawBody = await req.text();

  let event: StripeEvent;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSigningSecret
    );
  } catch (error) {
    return jsonResponse(
      {
        error: 'Stripe signature verification failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      400
    );
  }

  const sponsorMapped = mapStripeSponsorEvent(event);
  if (sponsorMapped) {
    const { data, error } = await supabaseAdmin.rpc('apply_sponsor_webhook', {
      p_webhook_event_id: event.id,
      p_event_type: sponsorMapped.eventType,
      p_sponsor_slot_id: sponsorMapped.sponsorSlotId,
      p_stripe_checkout_session_id: sponsorMapped.stripeCheckoutSessionId ?? null,
      p_stripe_payment_intent_id: sponsorMapped.stripePaymentIntentId ?? null,
      p_payment_link_url: sponsorMapped.paymentLinkUrl ?? null,
      p_payer_email: sponsorMapped.payerEmail ?? null,
      p_reason: null,
      p_payload: event,
    });

    if (error) {
      return jsonResponse(
        {
          error: 'apply_sponsor_webhook failed',
          detail: error.message,
        },
        500
      );
    }

    return jsonResponse({
      received: true,
      target: 'sponsor',
      applied: data,
      eventId: event.id,
    });
  }

  const registrationMapped = mapStripeRegistrationEvent(event);
  if (!registrationMapped) {
    return jsonResponse({ received: true, ignored: true, eventType: event.type });
  }

  let internalPaymentIntentId: string | null;
  try {
    internalPaymentIntentId = await resolveInternalPaymentIntentId(
      supabaseAdmin,
      registrationMapped.providerPaymentIntentId,
      registrationMapped.metadata
    );
  } catch (error) {
    return jsonResponse(
      {
        error: 'Failed to resolve internal payment intent',
        detail: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }

  if (!internalPaymentIntentId) {
    return jsonResponse(
      {
        error: 'Internal payment intent not found',
        providerPaymentIntentId: registrationMapped.providerPaymentIntentId,
      },
      404
    );
  }

  const { data, error } = await supabaseAdmin.rpc('apply_payment_webhook', {
    p_webhook_event_id: event.id,
    p_provider: 'stripe',
    p_event_type: registrationMapped.eventType,
    p_payment_intent_id: internalPaymentIntentId,
    p_provider_payment_intent_id: registrationMapped.providerPaymentIntentId,
    p_payment_reference: registrationMapped.paymentReference ?? null,
    p_reason: registrationMapped.reason ?? null,
    p_payload: event,
  });

  if (error) {
    return jsonResponse(
      {
        error: 'apply_payment_webhook failed',
        detail: error.message,
      },
      500
    );
  }

  return jsonResponse({
    received: true,
    target: 'registration',
    applied: data,
    eventId: event.id,
  });
});
