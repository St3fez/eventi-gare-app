# Events / Eventi (Expo)

App mobile Android/iOS per gestione eventi con due ruoli:
- Organizzatore
- Partecipante

## Funzioni implementate
- Scelta ruolo all'apertura.
- Profilo organizzatore con antifrode:
  - nuovi organizer in `pending_review`
  - payout bloccato finche non verificato
  - risk score + risk flags
- Creazione evento con:
  - nome, luogo, data
  - gratuito o a quota
  - modulo privacy
  - logo (URL opzionale)
  - sponsor locale (banner)
  - assegnazione automatica numero partecipante
- Commissione tecnica 3% sugli eventi a pagamento.
- Ricerca evento partecipante per nome/localita con filtro ricerca attiva.
- Iscrizione partecipante con consenso privacy + conservazione dati.
- Flusso gratuito: banner fisso + interstitial a fine iscrizione.
- Flusso pagamento con state machine:
  - `pending_payment -> paid | payment_failed | cancelled | refunded`
  - sessione pagamento a scadenza (default 15 minuti)
  - payment intent e webhook idempotente
  - checkout partecipante Stripe via Edge Function (`participant-checkout`) in canale `prod`
- Dashboard organizzatore con lista iscritti e stato pagamento in tempo reale locale.
- Export CSV iscritti con stati pagamento/iscrizione.
- Export PDF iscritti con riepilogo completo per evento.
- Modulo sponsor a pagamento:
  - attivazione una tantum (25 EUR) via checkout Stripe
  - pacchetto giornaliero/multi-day fino alla data evento
  - generazione link Stripe condivisibile
  - contratto sponsor IT/EN salvato in `sponsor_slots`
- Stripe Connect per incasso quota iscrizione e payout organizzatore.
- visualizzazione banner solo con `active=true` e slot non scaduto
- Compliance organizer:
  - profilo ente (presidente/segretario/altro)
  - upload documenti da dispositivo (no URL esterni)
  - invio documenti via email amministratore (Edge Function Supabase)
- Template disclaimer/privacy/economico direttamente in app.

## Setup
```bash
npm install
npm run start
```

Per Android:
```bash
npm run android
```

Build AAB release per Play Console (test chiuso):
```powershell
./scripts/build-play-aab.ps1
```

Build separato per canale:
```powershell
# PRODUZIONE (sicura)
npm run build:play:aab:prod

# DEMO (sezioni aperte)
npm run build:play:aab:demo
```

Build web produzione (sito pubblicabile):
```powershell
./scripts/build-web-release.ps1
```

Build web separato per canale:
```powershell
# PRODUZIONE
npm run build:web:prod

# DEMO
npm run build:web:demo
```

Per iOS (su macOS) o Expo Go:
```bash
npm run ios
```

## Email conferma partecipante
L'app usa un webhook opzionale per l'invio email automatico.

1. Copia `.env.example` in `.env`
2. Imposta URL webhook

Variabile:
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
- `EXPO_PUBLIC_APP_CHANNEL` (`prod` o `demo`)
- `EXPO_PUBLIC_ORGANIZER_TEST_MODE` (`true/false`)
- `EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED` (`true/false`)
- `EXPO_PUBLIC_DEMO_ALL_OPEN` (`true/false`)

Template consigliati:
- `.env.prod.example`
- `.env.demo.example`

Se non configurato, l'app usa modalita simulata (conferma comunque il completamento iscrizione).

## Supabase (scelta consigliata)
Per database realtime e sicurezza produzione, usa Supabase (non Google Sheet pubblico).

File inclusi:
- `supabase/schema.sql`
- `supabase/README.md`

Lo schema include:
- tabelle organizer/eventi/iscrizioni/payment_intents/webhook_events/sponsor_slots
- RLS policy
- funzione SQL idempotente per webhook pagamento

## Note legali importanti
I testi privacy/disclaimer inclusi sono una base tecnica.
Devono essere validati da consulente legale/privacy prima della pubblicazione sugli store.

## Play Console (test chiuso)
Guida operativa completa:
- `docs/play-console-closed-test.md`
- `docs/play-console-submission-pack-en.md`
- `docs/demo-prod-channels-it.md`
- `docs/prod-go-live-checklist-it.md`

Preflight produzione (config + endpoint + Stripe/ads sanity check):
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/preflight-prod-readiness.ps1
```

## Pubblicazione sito web + QR
- `docs/web-publish-quickstart-it.md`
- `docs/web-publish-quickstart-en.md`
- `docs/deploy-web-autosync-github-it.md`

## Deploy Netlify su sito fisso
Per evitare la creazione di siti Netlify casuali:

1. Imposta token Netlify nella shell:
   ```powershell
   $env:NETLIFY_AUTH_TOKEN="NETLIFY_PERSONAL_ACCESS_TOKEN"
   ```
2. Deploy produzione sempre sul progetto `eventi-gare-app`:
   ```powershell
   npm run deploy:netlify
   ```

3. Deploy demo sullo stesso script, con canale demo:
   ```powershell
   npm run deploy:netlify:demo
   ```

## Build icon
Icone personalizzate generate in `assets/`:
- `icon.png`
- `adaptive-icon.png`
- `splash-icon.png`
- `favicon.png`
