# Deploy Automatico Web da GitHub (Netlify + Vercel)

Repo: `https://github.com/St3fez/eventi-gare-app`

Questo progetto e gia predisposto con:
- `netlify.toml`
- `vercel.json`
- CI GitHub: `.github/workflows/ci.yml`

## 1) Variabili ambiente da impostare nel provider
Imposta queste 4 env uguali a quelle del tuo `.env` locale:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_EMAIL_WEBHOOK_URL`
- `EXPO_PUBLIC_SPONSOR_CHECKOUT_URL`

Nota: tutte iniziano con `EXPO_PUBLIC_` perche Expo le inietta in fase build web.

## 2) Netlify (consigliato per partire)
1. Vai su `https://app.netlify.com`
2. `Add new site` -> `Import an existing project`
3. Collega GitHub e seleziona `St3fez/eventi-gare-app`
4. Build settings (se non letti da `netlify.toml`):
   - Build command: `npm run build:web`
   - Publish directory: `web-build`
5. Inserisci le 4 env sopra in `Site settings -> Environment variables`
6. Deploy

Ogni push su `main` fara deploy automatico.

## 3) Vercel (alternativa)
1. Vai su `https://vercel.com/new`
2. Import `St3fez/eventi-gare-app`
3. Vercel legge `vercel.json` automaticamente:
   - Install: `npm ci`
   - Build: `npm run build:web`
   - Output: `web-build`
4. Inserisci le 4 env in `Project Settings -> Environment Variables`
5. Deploy

Ogni push su `main` fara redeploy automatico.

## 4) Dopo primo deploy: genera QR definitivo
Quando hai URL pubblico (es. Netlify/Vercel):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://TUO-URL-PUBBLICO" -OutFile "dist\\web\\eventi-e-gare-web-qr-public.png"
```

## 5) Verifica veloce produzione
- Apri il sito in incognito mobile
- Crea organizer/evento/iscrizione
- Controlla tabelle Supabase (`organizers`, `events`, `registrations`)
- Verifica banner/sponsor e CSV download lato web
