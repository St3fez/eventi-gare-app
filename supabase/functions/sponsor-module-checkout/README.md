# sponsor-module-checkout edge function

Path: `supabase/functions/sponsor-module-checkout/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets:
- `SPONSOR_MODULE_SUCCESS_URL` (fallback: `SPONSOR_SUCCESS_URL` or `https://eventigare.app/sponsor/success`)
- `SPONSOR_MODULE_CANCEL_URL` (fallback: `SPONSOR_CANCEL_URL` or `https://eventigare.app/sponsor/cancel`)
- `SPONSOR_MODULE_DEFAULT_CURRENCY` (default: `EUR`)

## Deploy
```bash
supabase functions deploy sponsor-module-checkout
```

## Notes
- Endpoint requires authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It verifies organizer ownership (`organizers.user_id = current user`).
- It creates Stripe Checkout session with metadata `kind=sponsor_module_activation`.
- Webhook `stripe-webhook` enables the module after `checkout.session.completed`.
