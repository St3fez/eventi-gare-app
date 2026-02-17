# Quick Web Publish + QR (Eventi e Gare)

Goal: publish the web version quickly and make it accessible to all mobile users via QR code.

## 1) Production web build
From project root:

```powershell
./scripts/build-web-release.ps1
```

Outputs:
- Static folder: `web-build/`
- Upload zip: `dist/web/eventi-e-gare-web-build.zip`

Force clean cache build if needed:

```powershell
./scripts/build-web-release.ps1 -Clear
```

## 2) Fast publishing (recommended)
No server setup required:

1. Open Netlify Drop: `https://app.netlify.com/drop`
2. Drag and drop the `web-build` folder (or extracted zip)
3. Netlify gives you a public HTTPS URL in seconds

Equivalent options:
- Cloudflare Pages
- Vercel

## 3) Generate official QR
When you have the public URL (example `https://eventiegare.netlify.app`):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://eventiegare.netlify.app"
```

Output:
- `dist/web/eventi-e-gare-web-qr.png`

## 4) Mobile distribution
- Share or print `eventi-e-gare-web-qr.png`
- Any smartphone can open the site by scanning the QR

## 5) Functional notes
- Main app features are available on web.
- CSV export on web uses direct browser download.
- Always use `https://` URL for mobile compatibility.
