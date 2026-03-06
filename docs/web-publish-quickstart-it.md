# Pubblicazione Web Rapida + QR (Eventi)

Obiettivo: pubblicare il sito web dell'app e renderlo accessibile da qualsiasi smartphone via QR code.

## 1) Build web produzione
Da root progetto:

```powershell
./scripts/build-web-release.ps1
```

Output:
- Cartella statica: `web-build/`
- Zip pronto upload: `dist/web/events-web-build-prod.zip`

Se vuoi forzare cache pulita:

```powershell
./scripts/build-web-release.ps1 -Clear
```

## 2) Pubblicazione consigliata: GitHub Pages
Il repo e gia predisposto per il deploy automatico via GitHub Actions.

1. In GitHub repo apri `Settings -> Pages`
2. In `Build and deployment`, imposta `Source: GitHub Actions`
3. In `Settings -> Secrets and variables -> Actions`, aggiungi:
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
4. Valori URL consigliati:
   - `EXPO_PUBLIC_EVENT_WEB_BASE_URL=https://<owner>.github.io/eventi-gare-app`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<owner>.github.io/eventi-gare-app/privacy-policy`
5. Push su `main`: il workflow `Deploy Pages` pubblica automaticamente il sito

## 3) Generazione QR ufficiale
Quando hai l'URL pubblico (es. `https://<owner>.github.io/eventi-gare-app`):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://eventiegare.netlify.app"
```

Output:
- `dist/web/events-web-qr.png`

## 4) Condivisione mobile
- Stampa o condividi `events-web-qr.png`
- Qualsiasi utente mobile apre il sito scansionando il QR

## 5) Note funzionali web
- Le funzionalita principali app sono disponibili sul sito.
- Export CSV su web: download diretto file dal browser.
- Usa sempre URL `https://` per evitare blocchi su mobile.

## Comandi veloci
```powershell
# Build web
./scripts/build-web-release.ps1

# QR da URL GitHub Pages
./scripts/generate-web-qr.ps1 -Url "https://TUO-DOMINIO"
```
