# Quick Web Publish + QR (Events)

Goal: publish the web version quickly and make it accessible to all mobile users via QR code.

## 1) Production web build
From project root:

```powershell
./scripts/build-web-release.ps1
```

Outputs:
- Static folder: `web-build/`
- Upload zip: `dist/web/events-web-build-prod.zip`

Force clean cache build if needed:

```powershell
./scripts/build-web-release.ps1 -Clear
```

## 2) Recommended publishing: GitHub Pages
The repository is already wired for automatic deployment with GitHub Actions.

1. Open `Settings -> Pages` in the GitHub repository
2. Set `Build and deployment -> Source` to `GitHub Actions`
3. In `Settings -> Secrets and variables -> Actions`, add:
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
4. Recommended public URLs:
   - `EXPO_PUBLIC_EVENT_WEB_BASE_URL=https://<owner>.github.io/eventi-gare-app`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<owner>.github.io/eventi-gare-app/privacy-policy`
5. Push to `main`: the `Deploy Pages` workflow publishes the site automatically

## 3) Generate official QR
When you have the public URL (example `https://<owner>.github.io/eventi-gare-app`):

```powershell
./scripts/generate-web-qr.ps1 -Url "https://eventiegare.netlify.app"
```

Output:
- `dist/web/events-web-qr.png`

## 4) Mobile distribution
- Share or print `events-web-qr.png`
- Any smartphone can open the site by scanning the QR

## 5) Functional notes
- Main app features are available on web.
- CSV export on web uses direct browser download.
- Always use `https://` URL for mobile compatibility.
