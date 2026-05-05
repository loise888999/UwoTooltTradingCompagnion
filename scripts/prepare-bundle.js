const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const backendRepoDir = path.join(root, 'external', 'ocr-backend');
const frontendRepoDir = path.join(root, 'external', 'frontend');

const bundleDir = path.join(root, 'bundle');
const bundleBackendDir = path.join(bundleDir, 'ocr-backend');
const bundleFrontendDir = path.join(bundleDir, 'frontend');

const backendEntryRel = process.env.OCR_BACKEND_ENTRY_REL || 'server.js';
const frontendUrl = process.env.FRONTEND_URL || '';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing directory: ${source}`);
  }

  fs.cpSync(source, destination, {
    recursive: true,
    filter: (src) => {
      const normalized = src.replace(/\\/g, '/');
      if (normalized.includes('/.git')) return false;
      if (normalized.includes('/node_modules')) return false;
      return true;
    }
  });
}

if (!fs.existsSync(backendRepoDir)) {
  throw new Error('external/ocr-backend not found. Clone backend repo first.');
}

if (!fs.existsSync(frontendRepoDir)) {
  throw new Error('external/frontend not found. Clone frontend repo first.');
}

fs.rmSync(bundleDir, { recursive: true, force: true });
ensureDir(bundleDir);

copyDir(backendRepoDir, bundleBackendDir);
copyDir(frontendRepoDir, bundleFrontendDir);

const runtimeConfigPath = path.join(bundleDir, 'runtime-config.json');
fs.writeFileSync(
  runtimeConfigPath,
  JSON.stringify(
    {
      backendEntryRel,
      frontendUrl,
      backendPort: process.env.BACKEND_PORT || 3210
    },
    null,
    2
  )
);

console.log('Prepared bundle/ with external backend and frontend repos.');
