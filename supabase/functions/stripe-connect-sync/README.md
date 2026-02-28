# stripe-connect-sync edge function

Path: `supabase/functions/stripe-connect-sync/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets:
- `STRIPE_CONNECT_RETURN_URL` (default: `https://eventigare.app`)
- `STRIPE_CONNECT_ALLOWED_REDIRECT_ORIGINS` (CSV list of allowed caller origins)

## Deploy
```bash
supabase functions deploy stripe-connect-sync --no-verify-jwt
```

## Notes
- Endpoint requires authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It refreshes Stripe Connect account status and updates organizer flags.
- It supports CORS preflight (`OPTIONS`) for web clients.
- If `Origin` header is present, it must match allowed origins (plus localhost dev origins).
