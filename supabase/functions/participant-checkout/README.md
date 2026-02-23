# participant-checkout edge function

Path: `supabase/functions/participant-checkout/index.ts`

## Required secrets
- `STRIPE_SECRET_KEY`

Supabase runtime already provides:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional secrets:
- `PARTICIPANT_SUCCESS_URL` (default: `https://eventigare.app/participant/payment/success`)
- `PARTICIPANT_CANCEL_URL` (default: `https://eventigare.app/participant/payment/cancel`)

## Deploy
```bash
supabase functions deploy participant-checkout
```

## Notes
- Endpoint requires authenticated Bearer token (`Authorization: Bearer <access_token>`).
- It verifies registration ownership (`participant_user_id = current user`).
- It routes the payment to the organizer Stripe Connect account and keeps the platform fee as application fee.
- It creates/reuses `payment_intents`, then creates Stripe Checkout session.
- It always sets Stripe metadata with `supabase_payment_intent_id`, so webhook mapping is deterministic.
- If registration is already final (`paid`, `failed`, `cancelled`, `refunded`) it returns state `final` and does not create a new checkout.
