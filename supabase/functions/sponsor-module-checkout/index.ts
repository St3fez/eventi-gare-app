/// <reference path="../_shared/ide-shims.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.25.0';

type SponsorModuleCheckoutPayload = {
  organizerId?: string;
  successUrl?: string;
  cancelUrl?: string;
};

type OrganizerRow = {
  id: string;
  user_id: string;
  email: string;
  sponsor_module_enabled: boolean;
  sponsor_module_activation_amount: number;
};

const DEFAULT_ACTIVATION_AMOUNT = 25;

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

const asPositiveNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
};

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
    Deno.env.get('SPONSOR_MODULE_SUCCESS_URL') ??
      Deno.env.get('SPONSOR_SUCCESS_URL') ??
      'https://eventigare.app/sponsor/success',
    'https://eventigare.app/sponsor/success'
  );
  const defaultCancelUrl = normalizeFallbackUrl(
    Deno.env.get('SPONSOR_MODULE_CANCEL_URL') ??
      Deno.env.get('SPONSOR_CANCEL_URL') ??
      'https://eventigare.app/sponsor/cancel',
    'https://eventigare.app/sponsor/cancel'
  );
  const allowedOrigins = resolveAllowedOrigins(
    defaultSuccessUrl,
    Deno.env.get('SPONSOR_MODULE_ALLOWED_REDIRECT_ORIGINS')
  );
  const requestOrigin = cleanText(req.headers.get('origin'));
  const defaultCurrency = Deno.env.get('SPONSOR_MODULE_DEFAULT_CURRENCY') ?? 'EUR';

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
    return json(
      {
        error: 'Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY',
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

  let payload: SponsorModuleCheckoutPayload;
  try {
    payload = (await req.json()) as SponsorModuleCheckoutPayload;
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
    .select('id,user_id,email,sponsor_module_enabled,sponsor_module_activation_amount')
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

  if (organizer.sponsor_module_enabled) {
    return json({
      ok: true,
      state: 'already_active',
      organizerId: organizer.id,
    });
  }

  const activationAmount =
    asPositiveNumber(organizer.sponsor_module_activation_amount) || DEFAULT_ACTIVATION_AMOUNT;

  if (!activationAmount) {
    return json(
      {
        error: 'Sponsor module activation amount invalid',
        detail: organizer.sponsor_module_activation_amount,
      },
      400
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  const successUrl = normalizeRedirectUrl(payload.successUrl, defaultSuccessUrl, allowedOrigins);
  const cancelUrl = normalizeRedirectUrl(payload.cancelUrl, defaultCancelUrl, allowedOrigins);

  let session: { id: string; url?: string | null; payment_intent?: string | null };
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: cleanText(organizer.email) || undefined,
      metadata: {
        kind: 'sponsor_module_activation',
        organizer_id: organizer.id,
        user_id: userId,
      },
      payment_intent_data: {
        metadata: {
          kind: 'sponsor_module_activation',
          organizer_id: organizer.id,
          user_id: userId,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: defaultCurrency.toLowerCase(),
            unit_amount: Math.round(activationAmount * 100),
            product_data: {
              name: 'Sponsor module activation',
            },
          },
        },
      ],
    });
  } catch (error) {
    return json(
      {
        error: 'Stripe checkout session creation failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }

  return json({
    ok: true,
    state: 'checkout',
    checkoutUrl: session.url,
    organizerId: organizer.id,
    amount: activationAmount,
    currency: defaultCurrency,
  });
});
