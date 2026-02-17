# Pubblicazione Web Rapida + QR (Eventi e Gare)

Obiettivo: pubblicare il sito web dell'app e renderlo accessibile da qualsiasi smartphone via QR code.

## 1) Build web produzione
Da root progetto:

```powershell
./scripts/build-web-release.ps1
```

Output:
- Cartella statica: `web-build/`
- Zip pronto upload: `dist/web/eventi-e-gare-web-build.zip`

Se vuoi forzare cache pulita:

```powershell
./scripts/build-web-release.ps1 -Clear
```

## 2) Pubblicazione immediata (scelta consigliata)
Metodo rapido senza configurazione server:

1. Vai su Netlify Drop: `https://app.netlify.com/drop`
2. Trascina la cartella `web-build` (o lo zip estratto)
3. Netlify ti genera un URL pubblico HTTPS in pochi secondi

Alternative equivalenti:
- Cloudflare Pages (upload cartella `web-build`)
- Vercel (import cartella statica)

## 3) Generazione QR ufficiale
Quando hai l'URL pubblico (es. `https://eventiegare.netlify.app`):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://eventiegare.netlify.app"
```

Output:
- `dist/web/eventi-e-gare-web-qr.png`

## 4) Condivisione mobile
- Stampa o condividi `eventi-e-gare-web-qr.png`
- Qualsiasi utente mobile apre il sito scansionando il QR

## 5) Note funzionali web
- Le funzionalita principali app sono disponibili sul sito.
- Export CSV su web: download diretto file dal browser.
- Usa sempre URL `https://` per evitare blocchi su mobile.

## Comandi veloci
```powershell
# Build web
./scripts/build-web-release.ps1

# QR da URL pubblico
./scripts/generate-web-qr.ps1 -Url "https://TUO-DOMINIO"
```
