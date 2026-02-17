# stripe-webhook edge function

Path: `supabase/functions/stripe-webhook/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`

## Deploy
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Stripe endpoint
`https://<PROJECT_REF>.functions.supabase.co/stripe-webhook`

## Notes
- Signature Stripe verificata via `Stripe-Signature`.
- Idempotenza gestita via `public.apply_payment_webhook(...)`.
- Il mapping usa `metadata.supabase_payment_intent_id` quando disponibile;
  fallback su lookup per `provider_payment_intent_id`.
- Gestisce anche i pagamenti sponsor (`kind=sponsor_slot`) e richiama
  `public.apply_sponsor_webhook(...)` con:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.refunded`
