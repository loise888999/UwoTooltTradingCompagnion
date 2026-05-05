# UwoToolt Trading Compagnion - Release Shell

This repository creates a Windows `.exe` release when you manually trigger it after your OCR backend and frontend repos are ready.

Configured repositories:
- Frontend: `https://github.com/loise888999/OcrTrading`
- Backend: `https://github.com/loise888999/OcrTradingBackend`

## One-time setup in this repo

Add secret for private external repositories (optional if repos are public):

- `EXTERNAL_REPO_TOKEN`: token with read access to the external repos.

## Manual GitHub Release (recommended)

1. Push this repo to GitHub.
2. Open **Actions** → **Release Windows App**.
3. Click **Run workflow**.
4. Default repo URLs are pre-filled:
   - `ocr_backend_repo`: `https://github.com/loise888999/OcrTradingBackend.git`
   - `frontend_repo`: `https://github.com/loise888999/OcrTrading.git`
5. Fill/confirm:
   - `release_tag` in semver format like `v1.0.0`
   - `ocr_backend_ref` and `frontend_ref` (branch/tag/commit)
   - optional `backend_entry` (default: `server.js`)
   - optional `frontend_url`
6. Workflow will:
   - clone both repos
   - prepare and verify `bundle/`
   - build Windows installer
   - create GitHub Release with `.exe` artifact

## Local test flow

```bash
npm install
npm run setup:repos
npm run prepare:bundle
npm run verify:bundle
npm start
```

## Build installer locally

```bash
npm run build:win
```
