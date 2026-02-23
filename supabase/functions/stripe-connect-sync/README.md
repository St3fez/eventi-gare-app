# stripe-connect-sync edge function

Path: `supabase/functions/stripe-connect-sync/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy
```bash
supabase functions deploy stripe-connect-sync
```

## Notes
- Endpoint requires authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It refreshes Stripe Connect account status and updates organizer flags.
