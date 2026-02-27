# Supabase setup: Auth + webhook + client anon key

Questa guida completa i punti:
1. Configura Auth (email/password o provider)
2. Crea Edge Function webhook PSP (Stripe) che chiama `public.apply_payment_webhook(...)`
3. Usa nel client mobile solo chiave `anon` (mai service key)

Importante:
- `supabase login`, `supabase link`, `supabase functions ...` sono comandi CLI da terminale.
- Nel SQL Editor Supabase va eseguito solo SQL (es. contenuto di `supabase/schema.sql`).

## 1) Auth (email/password o provider)

### A. Email/password
1. Apri Supabase Dashboard -> `Authentication` -> `Providers`.
2. Abilita `Email` provider.
3. Decidi se richiedere conferma email (`Confirm email`) prima del login.
4. Imposta una password policy con minimo 8 caratteri e almeno 1 simbolo di punteggiatura.
5. Configura template email in `Authentication` -> `Email Templates`.
6. Per questa build mobile senza schermata login dedicata, abilita anche `Anonymous Sign-Ins`.

### B. Provider OAuth (es. Google)
1. Crea app OAuth nel provider (Google Cloud Console).
2. Copia `Client ID` e `Client Secret` in Supabase -> `Authentication` -> `Providers` -> `Google`.
3. Imposta redirect URL richiesti dal provider:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
   - eventuali deep link mobile se usi login social in app.

### C. SQL schema e RLS
Esegui `supabase/schema.sql` nel SQL Editor.
Include:
- tabelle organizer/eventi/iscrizioni/pagamenti
- RLS policy
- funzione idempotente `public.apply_payment_webhook(...)`

## 2) Edge Function Stripe webhook

La funzione e gia pronta in:
- `supabase/functions/stripe-webhook/index.ts`

Se `supabase` CLI non parte (es. `The term 'supabase' is not recognized` o blocco Device Guard), usa il percorso Dashboard:
1. Supabase Dashboard -> `Edge Functions` -> `Create function`.
2. Nome: `stripe-webhook`.
3. Copia/incolla il contenuto di `supabase/functions/stripe-webhook/index.ts`.
4. In funzione, disattiva `Verify JWT` (webhook pubblico da Stripe).
5. In Dashboard -> `Project Settings` -> `Edge Functions` -> `Secrets`, aggiungi:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SIGNING_SECRET`
6. Deploy dalla Dashboard.
7. URL finale:
   - `https://<PROJECT_REF>.functions.supabase.co/stripe-webhook`

### A. Prerequisiti CLI
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

### B. Configura secrets su Supabase
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx
```
`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono disponibili nell'ambiente function.

### C. Deploy funzione
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

### D. Endpoint webhook da inserire in Stripe
```text
https://<PROJECT_REF>.functions.supabase.co/stripe-webhook
```
Eventi consigliati:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `checkout.session.completed`
- `checkout.session.expired`

### E. Mapping eventi -> funzione SQL
La funzione edge traduce gli eventi Stripe e chiama:
```sql
select public.apply_payment_webhook(...)
```
con idempotenza via `webhook_event_id`.

## 2.b) Edge Function email conferma (send-confirmation)

File pronto:
- `supabase/functions/send-confirmation/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `send-confirmation`
3. Copia il contenuto da `supabase/functions/send-confirmation/index.ts`
4. Deploy
5. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/send-confirmation`

Deploy via CLI consigliato (email conferma chiamata anche senza sessione JWT):
```bash
supabase functions deploy send-confirmation --no-verify-jwt
```

Secrets consigliati per invio reale via SMTP:
- `SMTP_HOST`
- `SMTP_PORT` (default `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Fallback opzionale via Resend:
- `RESEND_API_KEY`
- `EMAIL_FROM`

Se i secrets non ci sono, la function risponde in modalita simulata.

## 2.c) Edge Function sponsor checkout (sponsor-checkout)

File pronto:
- `supabase/functions/sponsor-checkout/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `sponsor-checkout`
3. Copia il contenuto da `supabase/functions/sponsor-checkout/index.ts`
4. Mantieni `Verify JWT` attivo (solo organizer autenticato)
5. Deploy
6. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/sponsor-checkout`

Secrets richiesti:
- `STRIPE_SECRET_KEY`

Secrets opzionali:
- `SPONSOR_SUCCESS_URL`
- `SPONSOR_CANCEL_URL`
- `SPONSOR_DEFAULT_CURRENCY`
- `SPONSOR_ALLOWED_ORIGINS` (lista CSV origini web autorizzate a chiamare la function)

Note:
- crea record `sponsor_slots` in stato `pending_payment`
- genera checkout Stripe con metadata `kind=sponsor_slot`
- i webhook Stripe aggiornano lo slot con `public.apply_sponsor_webhook(...)`
- se `Origin` e presente, viene validato contro allowlist (con localhost consentito in dev)

## 2.d) Edge Function sponsor module checkout (sponsor-module-checkout)

File pronto:
- `supabase/functions/sponsor-module-checkout/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `sponsor-module-checkout`
3. Copia il contenuto da `supabase/functions/sponsor-module-checkout/index.ts`
4. Mantieni `Verify JWT` attivo (solo organizer autenticato)
5. Deploy
6. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/sponsor-module-checkout`

Secrets richiesti:
- `STRIPE_SECRET_KEY`

Secrets opzionali:
- `SPONSOR_MODULE_SUCCESS_URL` (fallback: `SPONSOR_SUCCESS_URL`)
- `SPONSOR_MODULE_CANCEL_URL` (fallback: `SPONSOR_CANCEL_URL`)
- `SPONSOR_MODULE_DEFAULT_CURRENCY`
- `SPONSOR_MODULE_ALLOWED_REDIRECT_ORIGINS` (lista CSV origini consentite per success/cancel URL)

Note:
- crea checkout Stripe con metadata `kind=sponsor_module_activation`
- attivazione modulo su webhook `checkout.session.completed` via `public.apply_sponsor_module_webhook(...)`
- se `Origin` e presente, viene validato contro allowlist (con localhost consentito in dev)

## 2.e) Edge Function Stripe Connect onboarding (stripe-connect)

File pronto:
- `supabase/functions/stripe-connect/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `stripe-connect`
3. Copia il contenuto da `supabase/functions/stripe-connect/index.ts`
4. Mantieni `Verify JWT` attivo (solo organizer autenticato)
5. Deploy
6. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/stripe-connect`

Secrets richiesti:
- `STRIPE_SECRET_KEY`

Secrets opzionali:
- `STRIPE_CONNECT_DEFAULT_COUNTRY` (default `IT`)
- `STRIPE_CONNECT_RETURN_URL`
- `STRIPE_CONNECT_REFRESH_URL`
- `STRIPE_CONNECT_ALLOWED_REDIRECT_ORIGINS` (lista CSV origini consentite per return/refresh URL)

Note:
- crea/riusa account Stripe Connect (Express)
- ritorna onboarding link
- aggiorna campi organizer (`stripe_connect_*`, `payout_enabled`)
- se `Origin` e presente, viene validato contro allowlist (con localhost consentito in dev)

## 2.f) Edge Function Stripe Connect sync (stripe-connect-sync)

File pronto:
- `supabase/functions/stripe-connect-sync/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `stripe-connect-sync`
3. Copia il contenuto da `supabase/functions/stripe-connect-sync/index.ts`
4. Mantieni `Verify JWT` attivo (solo organizer autenticato)
5. Deploy
6. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/stripe-connect-sync`

Secrets richiesti:
- `STRIPE_SECRET_KEY`

Secrets opzionali:
- `STRIPE_CONNECT_RETURN_URL`
- `STRIPE_CONNECT_ALLOWED_REDIRECT_ORIGINS` (lista CSV origini web autorizzate a chiamare la function)

Note:
- aggiorna lo stato Stripe Connect senza ri-creare account link
- se `Origin` e presente, viene validato contro allowlist (con localhost consentito in dev)

## 2.g) Edge Function participant checkout (participant-checkout)

File pronto:
- `supabase/functions/participant-checkout/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `participant-checkout`
3. Copia il contenuto da `supabase/functions/participant-checkout/index.ts`
4. Mantieni `Verify JWT` attivo (solo partecipante autenticato)
5. Deploy
6. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/participant-checkout`

Secrets richiesti:
- `STRIPE_SECRET_KEY`

Secrets opzionali:
- `PARTICIPANT_SUCCESS_URL`
- `PARTICIPANT_CANCEL_URL`
- `PARTICIPANT_ALLOWED_REDIRECT_ORIGINS` (lista CSV origini consentite per success/cancel URL)

Note:
- verifica ownership registrazione (`participant_user_id = utente corrente`)
- crea/reusa `payment_intents` per iscrizioni partecipante
- crea checkout Stripe con metadata `supabase_payment_intent_id`
- webhook Stripe completa lo stato pagamento via `public.apply_payment_webhook(...)`
- se `Origin` e presente, viene validato contro allowlist (con localhost consentito in dev)

## 2.h) Edge Function invio documenti organizer (send-organizer-compliance)

File pronto:
- `supabase/functions/send-organizer-compliance/index.ts`

Percorso Dashboard (senza CLI):
1. `Edge Functions` -> `Create function`
2. Nome: `send-organizer-compliance`
3. Copia il contenuto da `supabase/functions/send-organizer-compliance/index.ts`
4. Deploy
5. URL:
   - `https://<PROJECT_REF>.functions.supabase.co/send-organizer-compliance`

Secrets richiesti (SMTP):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Se i secret SMTP non sono configurati la function risponde in modalita simulata.

## 3) Client mobile: solo anon key

Nel client Expo/React Native usa solo:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Mai inserire `service_role` nel client.

### File gia predisposti
- `src/services/supabaseClient.ts`
- `src/services/authSupabase.ts`
- `.env.example`

### `.env` esempio
```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_EMAIL_WEBHOOK_URL=https://<project-ref>.functions.supabase.co/send-confirmation
EXPO_PUBLIC_SPONSOR_CHECKOUT_URL=https://<project-ref>.functions.supabase.co/sponsor-checkout
EXPO_PUBLIC_SPONSOR_MODULE_CHECKOUT_URL=https://<project-ref>.functions.supabase.co/sponsor-module-checkout
EXPO_PUBLIC_STRIPE_CONNECT_URL=https://<project-ref>.functions.supabase.co/stripe-connect
EXPO_PUBLIC_STRIPE_CONNECT_SYNC_URL=https://<project-ref>.functions.supabase.co/stripe-connect-sync
EXPO_PUBLIC_PARTICIPANT_CHECKOUT_URL=https://<project-ref>.functions.supabase.co/participant-checkout
EXPO_PUBLIC_ORGANIZER_COMPLIANCE_WEBHOOK_URL=https://<project-ref>.functions.supabase.co/send-organizer-compliance
EXPO_PUBLIC_ADMIN_CONTACT_EMAIL=profstefanoferrari@gmail.com
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://eventi-gare-app.netlify.app/privacy-policy
```

## 4) Test rapido webhook in locale (opzionale)

Terminale A:
```bash
supabase functions serve stripe-webhook --no-verify-jwt
```

Terminale B (Stripe CLI):
```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

## 5) Hardening consigliato
- Abilita `Confirm email` per organizer.
- Usa MFA per account admin.
- Monitora `risk_score` e `risk_flags` prima di settare `verification_status='verified'`.
- Mantieni `payout_enabled=false` finche KYC/KYB non e completata.

## 6) Troubleshooting: non vedo iscrizioni in Supabase
- Questa app mantiene anche un fallback locale (AsyncStorage).
- Per scrivere su Supabase devono essere veri tutti i punti:
  - sessione utente valida (`auth.uid()`), ottenuta via login o anonymous sign-in
  - organizzatore sincronizzato (campo `remoteId`)
  - evento sincronizzato (campo `remoteId`)
- Le demo locali pregresse (create prima della sync) non hanno `remoteId`: le nuove iscrizioni restano locali.
- Se vedi errore `captcha verification process failed`, in `Authentication -> Security` disattiva temporaneamente CAPTCHA/Bot protection per i test oppure integra token CAPTCHA nel client.
- Se l'email organizer esiste gia su altro utente anonimo, l'app applica fallback automatico (`+<uid>`) per evitare conflitto `organizers_email_key`.
- Le variabili `EXPO_PUBLIC_*` sono lette a build-time: dopo modifiche `.env` devi rigenerare/reinstallare l'APK.

## 7) Patch policy RLS (consigliata)
Per aggiornare solo policy/trigger (senza rilanciare tutto lo schema):
1. Apri Supabase SQL Editor.
2. Esegui il file `supabase/policies_patch.sql`.

Questa patch:
- rende idempotenti le policy (`drop policy if exists` + `create policy`)
- aggiunge selezione eventi anche per organizzatore proprietario
- blocca la modifica client dei campi antifrode organizer (`verification_status`, `payout_enabled`, ecc.)
- rafforza l'insert registrazioni (consensi obbligatori + coerenza evento/organizer).

## 8) Patch modulo sponsor (nuovo)
Per aggiungere solo il modulo sponsor su un progetto gia esistente:
1. Apri Supabase SQL Editor.
2. Esegui `supabase/sponsor_patch.sql`.

Questa patch crea/aggiorna:
- tipo `sponsor_slot_status`
- tabelle `sponsor_slots` e `sponsor_webhook_events`
- funzione `public.apply_sponsor_webhook(...)`
- policy RLS + grant select (read-only dal client)

## 9) Patch hardening organizer/eventi (nuovo)
Per aggiungere i nuovi vincoli anti-frode e i campi compliance organizer:
1. Apri Supabase SQL Editor.
2. Esegui `supabase/organizer_event_hardening_patch.sql`.

Questa patch crea/aggiorna:
- policy accesso partecipante per evento (`participant_auth_mode`, `participant_phone_required`)
- campi organizer per ruolo ente/documentazione/sblocco quote
- indice univoco anti-duplicazione evento (stesso giorno + stessa localita + stesso nome)
