# Checklist Go-Live Produzione (Web + Stripe + Ads)

Questa checklist serve per portare il progetto in produzione senza demo mode.

## 1) Preflight locale (obbligatorio)

Da root progetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preflight-prod-readiness.ps1
```

La verifica controlla:
- variabili `.env` obbligatorie;
- flag produzione (`APP_CHANNEL=prod`, test mode off, security on);
- raggiungibilita endpoint Supabase Functions (email, sponsor-checkout, sponsor-module-checkout, stripe-connect, stripe-connect-sync, participant-checkout, compliance, stripe-webhook);
- presenza/assenza SDK Ads;
- warning su testi legali.

Se esce almeno un `FAIL`, non fare deploy.

## 2) Configurazione Supabase Functions

In Supabase Dashboard:

1. Deploy funzione `stripe-webhook` (public webhook, verify JWT disattivato).
2. Deploy funzione `sponsor-checkout` (`--no-verify-jwt`, verifica bearer token interna).
3. Deploy funzione `sponsor-module-checkout` (`--no-verify-jwt`, verifica bearer token interna).
4. Deploy funzione `stripe-connect` (`--no-verify-jwt`, verifica bearer token interna).
5. Deploy funzione `stripe-connect-sync` (`--no-verify-jwt`, verifica bearer token interna).
6. Deploy funzione `participant-checkout` (`--no-verify-jwt`, verifica bearer token interna).
7. Deploy funzione `send-confirmation` (`--no-verify-jwt`).
8. Deploy funzione `send-organizer-compliance` (`--no-verify-jwt`, verifica bearer token interna).

Secrets minimi:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SIGNING_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- opzionali sponsor: `SPONSOR_SUCCESS_URL`, `SPONSOR_CANCEL_URL`, `SPONSOR_DEFAULT_CURRENCY`
- opzionali modulo sponsor: `SPONSOR_MODULE_SUCCESS_URL`, `SPONSOR_MODULE_CANCEL_URL`, `SPONSOR_MODULE_DEFAULT_CURRENCY`

## 3) Stripe (dashboard)

In Stripe:

1. Crea endpoint webhook:
   - `https://<PROJECT_REF>.functions.supabase.co/stripe-webhook`
2. Eventi da inviare:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `checkout.session.completed`
   - `checkout.session.expired`
3. Copia il signing secret (`whsec_...`) in Supabase secret `STRIPE_WEBHOOK_SIGNING_SECRET`.

## 4) Variabili Netlify (Production)

Nel sito Netlify, imposta le stesse variabili di produzione:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_EMAIL_WEBHOOK_URL`
- `EXPO_PUBLIC_SPONSOR_CHECKOUT_URL`
- `EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL`
- `EXPO_PUBLIC_STRIPE_CONNECT_URL`
- `EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL`
- `EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL`
- `EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL`
- `EXPO_PUBLIC_ADMIN_CONTACT_EMAIL`
- `EXPO_PUBLIC_EVENT_WEB_BASE_URL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_APP_CHANNEL=prod`
- `EXPO_PUBLIC_ORGANIZER_TEST_MODE=false`
- `EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED=true`
- `EXPO_PUBLIC_DEMO_ALL_OPEN=false`

## 5) Policy e disclaimer

Prima del pubblico:

1. Definisci URL pubblico `Privacy Policy` (HTTPS) da usare in Play Console.
2. Allinea la retention dati in modo coerente (testi app + policy pubblica).
3. Validazione finale da consulente legale/privacy.

Nota: nel codice i testi legali sono etichettati come base tecnica.

## 6) Ads e sponsor

Stato attuale progetto:
- Banner/interstitial sponsor locali sono supportati.
- SDK AdMob presente: `react-native-google-mobile-ads`.

Implicazione:
- In Play Console la dichiarazione Ads resta `Yes` se mostri contenuti sponsorizzati/pubblicitari.
- Se abiliti AdMob (`EXPO_PUBLIC_ADMOB_ENABLED=true`) devi valorizzare:
  - `ADMOB_ANDROID_APP_ID`
  - `ADMOB_IOS_APP_ID`
  - unit id banner/interstitial Android/iOS
  altrimenti il preflight fallisce.

## 7) Deploy web definitivo (solo dopo tutti i check OK)

Quando il preflight e tutto verde:

```powershell
npm run deploy:netlify
```
