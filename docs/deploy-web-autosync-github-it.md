# Deploy Web da GitHub (GitHub Pages + Demo Google Sites)

Repo: `https://github.com/St3fez/eventi-gare-app`

Questo progetto e gia predisposto con:
- CI GitHub: `.github/workflows/ci.yml`
- Deploy GitHub Pages: `.github/workflows/deploy-pages.yml`

## 1) Variabili ambiente da impostare nel provider
Imposta queste env uguali a quelle del tuo `.env` locale:

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

Nota: tutte iniziano con `EXPO_PUBLIC_` perche Expo le inietta in fase build web.

## 2) Produzione su GitHub Pages
1. In GitHub repo: `Settings -> Pages`.
2. In `Build and deployment`, imposta `Source: GitHub Actions`.
3. In `Settings -> Secrets and variables -> Actions`, aggiungi tutte le env sopra.
4. Valori consigliati per URL pubblici:
   - `EXPO_PUBLIC_EVENT_WEB_BASE_URL=https://<owner>.github.io/eventi-gare-app`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<owner>.github.io/eventi-gare-app/privacy-policy`
5. Push su `main`: parte automaticamente workflow `Deploy Pages`.

Nota:
- GitHub Pages espone un solo sito per repo; se vuoi anche una demo separata evita di usare lo stesso Pages della produzione.

## 3) Demo pubblicitaria su Google Sites
Google Sites e ottimo come landing marketing, ma non e ideale per ospitare direttamente il bundle Expo web.

Flusso consigliato:
1. Crea pagina Google Sites (hero, screenshot, FAQ, contatti, privacy).
2. Inserisci pulsante `Apri Demo`.
3. Punta il pulsante a un URL demo separato (non alla produzione).

Opzioni URL demo:
- repo GitHub separato per demo (es. `eventi-gare-app-demo`) con GitHub Pages e build `npm run build:web:demo`;
- in alternativa pagina solo vetrina senza app interattiva.

## 4) Dopo primo deploy: genera QR definitivo
Quando hai URL pubblico GitHub Pages:

```powershell
./scripts/generate-web-qr.ps1 -Url "https://TUO-URL-PUBBLICO" -OutFile "dist\\web\\events-web-qr-public.png"
```

## 5) Verifica veloce produzione
- Apri il sito in incognito mobile
- Crea organizer/evento/iscrizione
- Controlla tabelle Supabase (`organizers`, `events`, `registrations`)
- Verifica banner/sponsor e CSV download lato web
