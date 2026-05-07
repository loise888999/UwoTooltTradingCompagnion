const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfgPath = path.join(root, 'bundle', 'runtime-config.json');

if (!fs.existsSync(cfgPath)) {
  throw new Error('bundle/runtime-config.json missing');
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const backendPath = path.join(root, 'bundle', 'ocr-backend', cfg.backendEntryRel || 'OcrTradingBackend.exe');

if (!fs.existsSync(backendPath)) {
  throw new Error(`Backend entry from runtime-config not found: ${backendPath}`);
}

const frontendPath = path.join(root, 'bundle', 'frontend');

if (!fs.existsSync(frontendPath)) {
  throw new Error('bundle/frontend missing');
}

if (!fs.existsSync(path.join(frontendPath, 'index.html'))) {
  throw new Error('bundle/frontend/index.html missing');
}

function findPowerShellFiles(dir) {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...findPowerShellFiles(entryPath));
      continue;
    }

    if (/\.(ps1|psm1|psd1)$/i.test(entry.name)) {
      found.push(entryPath);
    }
  }

  return found;
}

const powerShellFiles = findPowerShellFiles(path.join(root, 'bundle'));

if (powerShellFiles.length > 0) {
  throw new Error(`PowerShell scripts must not be bundled:\n${powerShellFiles.join('\n')}`);
}

console.log('Bundle verification passed.');
