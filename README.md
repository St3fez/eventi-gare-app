# Eventi e Gare (Expo)

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
- Dashboard organizzatore con lista iscritti e stato pagamento in tempo reale locale.
- Export CSV iscritti con stati pagamento/iscrizione.
- Modulo sponsor a pagamento:
  - pacchetto giornaliero/multi-day fino alla data evento
  - generazione link Stripe condivisibile
  - contratto sponsor IT/EN salvato in `sponsor_slots`
  - visualizzazione banner solo con `active=true` e slot non scaduto
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

Build web produzione (sito pubblicabile):
```powershell
./scripts/build-web-release.ps1
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
- `EXPO_PUBLIC_EMAIL_WEBHOOK_URL`
- `EXPO_PUBLIC_SPONSOR_CHECKOUT_URL`

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

## Pubblicazione sito web + QR
- `docs/web-publish-quickstart-it.md`
- `docs/web-publish-quickstart-en.md`

## Build icon
Icone personalizzate generate in `assets/`:
- `icon.png`
- `adaptive-icon.png`
- `splash-icon.png`
- `favicon.png`
