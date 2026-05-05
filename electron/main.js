const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function getRuntimeConfig() {
  const configPath = path.join(__dirname, '..', 'bundle', 'runtime-config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing runtime config at ${configPath}. Run prepare:bundle before packaging.`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function startBackend(config) {
  const backendEntry = path.join(__dirname, '..', 'bundle', 'ocr-backend', config.backendEntryRel || 'server.js');

  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Backend entry not found: ${backendEntry}`);
  }

  backendProcess = spawn(process.execPath, [backendEntry], {
    env: { ...process.env, PORT: String(config.backendPort || 3210) },
    stdio: 'inherit'
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

function createWindow(loadUrl) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL(loadUrl);
}

app.whenReady().then(() => {
  try {
    const config = getRuntimeConfig();
    startBackend(config);

    const url = config.frontendUrl || `http://127.0.0.1:${config.backendPort || 3210}`;

    setTimeout(() => {
      createWindow(url);
    }, 1500);
  } catch (error) {
    dialog.showErrorBox('Startup Error', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});
