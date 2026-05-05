const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'repos.config.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing repos.config.json. Copy repos.config.example.json and fill your two repo URLs.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function cloneOrUpdate(repoUrl, targetDir) {
  if (!repoUrl) {
    throw new Error(`Missing repo url for ${targetDir}`);
  }

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    console.log(`Updating ${targetDir}...`);
    execSync('git pull', { cwd: targetDir, stdio: 'inherit' });
    return;
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  console.log(`Cloning ${repoUrl} into ${targetDir}...`);
  execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
}

cloneOrUpdate(config.ocrBackendRepo, path.join(root, 'external', 'ocr-backend'));
cloneOrUpdate(config.frontendRepo, path.join(root, 'external', 'frontend'));

console.log('Done. Configure OCR_BACKEND_ENTRY and FRONTEND_URL if needed.');
