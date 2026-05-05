# UwoToolt Trading Compagnion - Release Shell

This repository creates a Windows `.exe` release when you manually trigger it after your OCR backend and frontend repos are ready.

## One-time setup in this repo

Add secret for private external repositories:

- `EXTERNAL_REPO_TOKEN`: token with read access to the external repos.

(For public repos this secret is optional.)

## Manual GitHub Release (recommended)

1. Push this repo to GitHub.
2. Open **Actions** → **Release Windows App**.
3. Click **Run workflow**.
4. Fill inputs:
   - `release_tag` in semver format like `v1.0.0`
   - `ocr_backend_repo` and `ocr_backend_ref`
   - `frontend_repo` and `frontend_ref`
   - optional `backend_entry` (default: `server.js`)
   - optional `frontend_url`
5. Workflow will:
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
