# UwoToolt Trading Compagnion - Release Shell

This repository creates a Windows `.exe` release when you manually trigger it after your OCR backend and frontend repos are ready.

Configured repositories:
- Frontend: `https://github.com/loise888999/OcrTradingFrontend`
- Backend: `https://github.com/loise888999/OcrTradingBackend`

## One-time setup in this repo

Add secret for private external repositories (optional if repos are public):

- `EXTERNAL_REPO_TOKEN`: token with read access to the external repos.

## Manual GitHub Release (recommended)

1. Push this repo to GitHub.
2. Open **Actions** → **Release Windows App**.
3. Click **Run workflow**.
4. Fill/confirm:
   - `release_tag` in semver format like `v1.0.0`
   - optional `backend_entry` (default: `server.js`)
   - optional `frontend_url`
5. Workflow will always clone these fixed repositories from `main`:
   - Backend: `https://github.com/loise888999/OcrTradingBackend`
   - Frontend: `https://github.com/loise888999/OcrTradingFrontend`
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
