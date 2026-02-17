# Play Console Submission Pack (EN)

This folder contains copy-paste assets for Play Console closed testing:

- Release notes:
  - `docs/release-notes-closed-test-en.txt`
- Store listing text:
  - `docs/play-short-description-en.txt`
  - `docs/play-full-description-en.txt`
- Tester invitation template:
  - `docs/tester-invite-en.txt`
- Data Safety draft checklist:
  - `docs/play-data-safety-draft-en.md`
- Graphic assets checklist:
  - `docs/play-assets-checklist-en.md`
- Generated image upload guide:
  - `docs/play-image-upload-guide-en.md`
- End-to-end upload checklist:
  - `docs/play-console-closed-test.md`

## Build command
```powershell
./scripts/build-play-aab.ps1
```

## Generate listing images
```powershell
python scripts/generate-play-assets.py
```

## Upload artifact
Use latest file from:
- `dist/play/*.aab`
