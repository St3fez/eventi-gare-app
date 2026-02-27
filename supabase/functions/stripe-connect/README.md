# stripe-connect edge function

Path: `supabase/functions/stripe-connect/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets:
- `STRIPE_CONNECT_DEFAULT_COUNTRY` (default: `IT`)
- `STRIPE_CONNECT_RETURN_URL` (default: `https://eventigare.app`)
- `STRIPE_CONNECT_REFRESH_URL` (default: same as return URL)
- `STRIPE_CONNECT_ALLOWED_REDIRECT_ORIGINS` (CSV list of allowed origins for return/refresh URLs)

## Deploy
```bash
supabase functions deploy stripe-connect
```

## Notes
- Endpoint requires authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It creates/reuses Stripe Connect account (Express) for the organizer.
- It updates organizer flags (`stripe_connect_*`, `payout_enabled`).
- It returns an onboarding link URL.
- It supports CORS preflight (`OPTIONS`) for web clients.
- If `Origin` header is present, it must match allowed origins (plus localhost dev origins).
