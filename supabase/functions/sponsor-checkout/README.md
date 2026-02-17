# sponsor-checkout edge function

Path: `supabase/functions/sponsor-checkout/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets:
- `SPONSOR_SUCCESS_URL` (default: `https://eventigare.app/sponsor/success`)
- `SPONSOR_CANCEL_URL` (default: `https://eventigare.app/sponsor/cancel`)
- `SPONSOR_DEFAULT_CURRENCY` (default: `EUR`)

## Deploy
```bash
supabase functions deploy sponsor-checkout
```

## Notes
- This endpoint expects authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It verifies event ownership (organizer -> current user).
- It creates a pending `sponsor_slots` row, then creates Stripe Checkout URL.
- Slot metadata includes both Italian and English contract text (`contract_terms.it/en`).
- Slot becomes visible in app only when webhook marks it `active=true` and `ends_at > now()`.
