const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess;
let frontendServer;

function getRuntimeConfig() {
  const configPath = path.join(__dirname, '..', 'bundle', 'runtime-config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing runtime config at ${configPath}. Run prepare:bundle before packaging.`);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getBackendEntryPath(config) {
  const backendEntry = path.join(__dirname, '..', 'bundle', 'ocr-backend', config.backendEntryRel || 'OcrTradingBackend.exe');

  if (!app.isPackaged) {
    return backendEntry;
  }

  return backendEntry.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

function getUserFilesDir() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  const baseDir = portableDir || path.dirname(process.execPath);

  if (app.isPackaged && baseDir && fs.existsSync(baseDir)) {
    return path.join(baseDir, 'UwoToolt Trading Compagnion Data');
  }

  return path.join(app.getPath('userData'), 'User Files');
}

function copyMissing(source, destination) {
  if (!fs.existsSync(source) || fs.existsSync(destination)) {
    return;
  }

  fs.cpSync(source, destination, { recursive: true });
}

function prepareUserFiles(backendDir) {
  const userFilesDir = getUserFilesDir();
  fs.mkdirSync(userFilesDir, { recursive: true });

  copyMissing(path.join(backendDir, 'appsettings.json'), path.join(userFilesDir, 'appsettings.json'));
  copyMissing(path.join(backendDir, 'Data'), path.join(userFilesDir, 'Data'));

  const readmePath = path.join(userFilesDir, 'README.txt');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      [
        'UwoToolt Trading Compagnion user files',
        '',
        'You can edit these files while the app is closed:',
        '- appsettings.json',
        '- Data\\cities.csv',
        '- Data\\trade-goods.csv',
        '- Data\\pending-trade-goods.json',
        '- ocr-trading.db',
        '',
        'The SQLite database is created here after the backend starts.',
        'Back up this folder before making large manual edits.'
      ].join('\r\n')
    );
  }

  return userFilesDir;
}

function startBackend(config) {
  const backendEntry = getBackendEntryPath(config);

  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Backend entry not found: ${backendEntry}`);
  }

  const extension = path.extname(backendEntry).toLowerCase();
  const command = extension === '.js' ? process.execPath : extension === '.dll' ? 'dotnet' : backendEntry;
  const args = extension === '.js' || extension === '.dll' ? [backendEntry] : [];
  const backendDir = path.dirname(backendEntry);
  const userFilesDir = prepareUserFiles(backendDir);

  backendProcess = spawn(command, args, {
    cwd: userFilesDir,
    env: { ...process.env, PORT: String(config.backendPort || 5000) },
    stdio: 'inherit'
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

function getFrontendDir() {
  return path.join(__dirname, '..', 'bundle', 'frontend');
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function startFrontendServer(config) {
  const frontendDir = getFrontendDir();
  const indexPath = path.join(frontendDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Frontend entry not found: ${indexPath}`);
  }

  frontendServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
    const filePath = path.normalize(path.join(frontendDir, relativePath));
    const safeRoot = path.normalize(frontendDir + path.sep);

    const resolvedPath = filePath.startsWith(safeRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      ? filePath
      : indexPath;

    response.writeHead(200, { 'Content-Type': getContentType(resolvedPath) });
    fs.createReadStream(resolvedPath).pipe(response);
  });

  frontendServer.listen(Number(config.frontendPort || 5173), 'localhost');
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
    startFrontendServer(config);

    const url = config.frontendUrl || `http://localhost:${config.frontendPort || 5173}`;

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

  if (frontendServer) {
    frontendServer.close();
  }
});
