const { app, BrowserWindow, desktopCapturer, dialog, session } = require('electron');
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
    return path.join(baseDir, 'UwoTool Trading Compagnion Data');
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
        'UwoTool Trading Compagnion user files',
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

function getWindowIconPath() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

  if (!app.isPackaged) {
    return iconPath;
  }

  return iconPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

function normalizeCaptureText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function requestJson({ port, path: requestPath, timeoutMs = 1500 }) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        timeout: timeoutMs
      },
      (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            console.warn(`Could not parse backend response from ${requestPath}:`, error);
            resolve(null);
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => {
      resolve(null);
    });
  });
}

async function getSelectedGameWindow(config) {
  return requestJson({
    port: Number(config.backendPort || 5000),
    path: '/api/system/game-window'
  });
}

function getGameWindowCandidateNames(gameWindow) {
  const processName = gameWindow?.processName
    ? String(gameWindow.processName).replace(/\.[^.]+$/, '')
    : '';

  return uniq([
    normalizeCaptureText(gameWindow?.title),
    normalizeCaptureText(gameWindow?.windowTitle),
    normalizeCaptureText(gameWindow?.name),
    normalizeCaptureText(processName)
  ]).filter((candidate) => candidate.length >= 3);
}

function isOwnAppWindow(sourceName) {
  return sourceName.includes('uwotool') ||
    sourceName.includes('trading compagnion') ||
    sourceName.includes('trading companion');
}

function sourceMatchesCandidate(sourceName, candidate) {
  return sourceName === candidate ||
    sourceName.includes(candidate) ||
    candidate.includes(sourceName);
}

function findGameWindowSource(sources, gameWindow) {
  const namedCandidates = getGameWindowCandidateNames(gameWindow);

  for (const candidate of namedCandidates) {
    const matchedSource = sources.find((source) => {
      const sourceName = normalizeCaptureText(source.name);
      return !isOwnAppWindow(sourceName) && sourceMatchesCandidate(sourceName, candidate);
    });

    if (matchedSource) return matchedSource;
  }

  return sources.find((source) => {
    const sourceName = normalizeCaptureText(source.name);

    if (isOwnAppWindow(sourceName)) return false;
    if (sourceName.includes('uncharted')) return true;
    return sourceName.includes('uwo') && !sourceName.includes('uwotool');
  });
}

function setupDisplayCaptureSession(config) {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const [sources, gameWindow] = await Promise.all([
        desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 0, height: 0 }
        }),
        getSelectedGameWindow(config)
      ]);

      const gameWindowSource = findGameWindowSource(sources, gameWindow);

      if (!gameWindowSource) {
        const selectedTitle = gameWindow?.title || gameWindow?.windowTitle || gameWindow?.name || 'none';
        console.warn(
          `No matching game window source found for OCR capture. Selected game window: ${selectedTitle}. ` +
          `Available windows: ${sources.map((source) => source.name).join(', ')}`
        );
        callback({});
        return;
      }

      callback({ video: gameWindowSource });
    } catch (error) {
      console.error('Display capture request failed:', error);
      callback({});
    }
  });
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
    icon: getWindowIconPath(),
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
    setupDisplayCaptureSession(config);

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
