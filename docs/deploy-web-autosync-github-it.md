# Deploy Web da GitHub (GitHub Pages + Demo Google Sites)

Repo: `https://github.com/St3fez/eventi-gare-app`

Questo progetto e gia predisposto con:
- `netlify.toml`
- `vercel.json`
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

## 2) Produzione su GitHub Pages (consigliato se Netlify e bloccato)
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

## 4) Netlify (opzionale)
1. Vai su `https://app.netlify.com`
2. `Add new site` -> `Import an existing project`
3. Collega GitHub e seleziona `St3fez/eventi-gare-app`
4. Build settings (se non letti da `netlify.toml`):
   - Build command: `npm run build:web`
   - Publish directory: `web-build`
5. Inserisci le env sopra in `Site settings -> Environment variables`
6. Deploy

Ogni push su `main` fara deploy automatico.

Nota importante: una volta creato il sito `eventi-gare-app`, riusa sempre quel sito.
Se fai upload da Netlify Drop o deploy CLI con `--create-site`, Netlify crea un nuovo dominio casuale.

## 5) Vercel (alternativa)
1. Vai su `https://vercel.com/new`
2. Import `St3fez/eventi-gare-app`
3. Vercel legge `vercel.json` automaticamente:
   - Install: `npm ci`
   - Build: `npm run build:web`
   - Output: `web-build`
4. Inserisci le env in `Project Settings -> Environment Variables`
5. Deploy

Ogni push su `main` fara redeploy automatico.

## 6) Dopo primo deploy: genera QR definitivo
Quando hai URL pubblico (es. Netlify/Vercel):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://TUO-URL-PUBBLICO" -OutFile "dist\\web\\events-web-qr-public.png"
```

## 7) Deploy CLI diretto sul sito Netlify esistente
Se vuoi deploy manuale dal terminale sul sito esistente `eventi-gare-app`:

```powershell
$env:NETLIFY_AUTH_TOKEN="NETLIFY_PERSONAL_ACCESS_TOKEN"
npm run deploy:netlify
```

## 8) Verifica veloce produzione
- Apri il sito in incognito mobile
- Crea organizer/evento/iscrizione
- Controlla tabelle Supabase (`organizers`, `events`, `registrations`)
- Verifica banner/sponsor e CSV download lato web
