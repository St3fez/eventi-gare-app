# Canali Demo e Produzione

Questa app supporta due canali separati:

- `prod`: build pronta per rilascio reale, con sicurezza organizer attiva.
- `demo`: build per presentazioni commerciali, con sezioni sbloccate e dataset demo.

## Variabili canale

Usa queste variabili in `.env`:

```env
EXPO_PUBLIC_APP_CHANNEL=prod
EXPO_PUBLIC_ORGANIZER_TEST_MODE=false
EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED=true
EXPO_PUBLIC_DEMO_ALL_OPEN=false
```

Per demo:

```env
EXPO_PUBLIC_APP_CHANNEL=demo
EXPO_PUBLIC_ORGANIZER_TEST_MODE=true
EXPO_PUBLIC_ORGANIZER_SECURITY_ENFORCED=false
EXPO_PUBLIC_DEMO_ALL_OPEN=true
```

Template pronti:
- `.env.prod.example`
- `.env.demo.example`

## Build Android (AAB)

```powershell
# Produzione
npm run build:play:aab:prod

# Demo
npm run build:play:aab:demo
```

Output:
- `android/app/build/outputs/bundle/release/app-release.aab`
- `dist/play/events-<channel>-vc<versionCode>-<timestamp>.aab`

## Build Web

```powershell
# Produzione
npm run build:web:prod

# Demo
npm run build:web:demo
```

Output zip:
- `dist/web/events-web-build-prod.zip`
- `dist/web/events-web-build-demo.zip`

## Deploy Netlify

```powershell
# Produzione
npm run deploy:netlify

# Demo
npm run deploy:netlify:demo
```

## Nota operativa

Il canale `demo` mostra in header l'etichetta demo e abilita seed dati con moduli aperti.  
Il canale `prod` e il riferimento da usare per Play Console e rilascio pubblico.
