# Play Console - Closed Testing (Events)

## Current status (already prepared)
- `applicationId`: `com.eventi.slash.gare`
- App name: `Events`
- Signed release AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Upload keystore: `android/app/upload-keystore.jks`
- Release signing config: `android/keystore.properties`
- Keystore credentials backup (local): `android/upload-keystore.credentials.txt`
- Play build script: `scripts/build-play-aab.ps1`

## Build AAB for Play Console
From project root:

```powershell
./scripts/build-play-aab.ps1
```

Output:
- Main bundle: `android/app/build/outputs/bundle/release/app-release.aab`
- Timestamped copy for upload: `dist/play/*.aab`

If you want to force clean (slower; on Windows this may fail with CMake/codegen path issues):

```powershell
./scripts/build-play-aab.ps1 -Clean
```

## Upload key fingerprints (OAuth/API)
- SHA1: `3F:56:94:EC:42:35:57:5E:C4:A1:7D:BF:6F:F6:2F:02:C0:61:7C:97`
- SHA256: `21:2F:E6:A9:4F:FC:AD:D2:EC:72:52:37:A5:A5:F8:14:82:4C:48:B1:D4:69:5F:C5:3C:6C:AC:BD:B7:BD:BC:4E`

## Closed testing checklist
1. Create app in Play Console.
2. Open `Test and release` -> `Closed testing` -> create track.
3. Upload `app-release.aab` (or the file in `dist/play/`).
4. Fill release details (`What's new`).
5. Save and review release.
6. Add testers:
   - direct email list, or
   - Google Group.
7. Publish release to the closed track.
8. Share the opt-in link with testers.

## Minimum store listing required
Before publishing, complete:
- App name
- Short description
- Full description
- 512x512 icon
- Phone screenshots
- Category
- Contact email
- Privacy policy URL

## Mandatory policy declarations
In `App content`, complete:
- App access (if needed)
- Data safety
- Content rating
- Target audience
- Ads declaration (banner/interstitial are present)

## Important technical notes
- For each new upload, increment `android.versionCode` in `app.json`.
- Keep `android/app/upload-keystore.jks` and `android/upload-keystore.credentials.txt` safe.
- Never lose keystore/passwords, or you cannot ship updates from this key.

## Android permissions
Unnecessary high-risk permissions were removed from release manifest:
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `SYSTEM_ALERT_WINDOW`

## Next upload (version bump)
Update:
- `app.json` -> `expo.android.versionCode` (+1)
- optional: `expo.version`

Then rebuild:

```powershell
./scripts/build-play-aab.ps1
```
