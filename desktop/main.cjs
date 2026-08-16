const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const { createWriteStream, mkdirSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const STARTUP_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 150;

app.setName('SYA Scheduler');

let mainWindow = null;
let runtimeProcess = null;
let runtimeLog = null;
let isQuitting = false;

function allocatePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error('Could not allocate a local scheduler port.'));
      });
    });
  });
}

function runtimeCommand() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scheduler-runtime', 'scheduler-server');
  }
  return path.join(app.getAppPath(), 'bin', 'scheduler-server');
}

function openRuntimeLog() {
  const logDirectory = app.getPath('logs');
  mkdirSync(logDirectory, { recursive: true });
  const logPath = path.join(logDirectory, 'scheduler-runtime.log');
  runtimeLog = createWriteStream(logPath, { flags: 'a' });
  runtimeLog.write(`\n[${new Date().toISOString()}] Starting SYA Scheduler runtime\n`);
  return logPath;
}

function stopRuntime() {
  const processToStop = runtimeProcess;
  const logToClose = runtimeLog;
  runtimeProcess = null;
  runtimeLog = null;

  if (processToStop && logToClose) {
    processToStop.stdout.unpipe(logToClose);
    processToStop.stderr.unpipe(logToClose);
  }
  if (processToStop && processToStop.exitCode === null) {
    processToStop.kill('SIGTERM');
  }
  logToClose?.end();
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    if (!runtimeProcess || runtimeProcess.exitCode !== null) {
      throw new Error(`Scheduler runtime exited before becoming healthy (exit ${runtimeProcess?.exitCode ?? 'unknown'}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.ok === true && payload?.data?.functionId === 'scheduler') return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }

  throw new Error(`Scheduler runtime did not become healthy within ${STARTUP_TIMEOUT_MS / 1_000}s.${lastError ? ` ${lastError.message}` : ''}`);
}

async function startRuntime() {
  const port = await allocatePort();
  const command = runtimeCommand();
  const logPath = openRuntimeLog();

  runtimeProcess = spawn(command, [], {
    cwd: app.isPackaged ? process.resourcesPath : app.getAppPath(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  runtimeProcess.stdout.pipe(runtimeLog, { end: false });
  runtimeProcess.stderr.pipe(runtimeLog, { end: false });
  runtimeProcess.once('error', (error) => {
    runtimeLog?.write(`[desktop] spawn error: ${error.stack || error.message}\n`);
  });
  runtimeProcess.once('exit', (code, signal) => {
    runtimeLog?.write(`[desktop] runtime exited: code=${code} signal=${signal}\n`);
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Scheduler runtime stopped',
        `The local Scheduler service exited unexpectedly. Runtime log: ${logPath}`,
      );
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl);
  return { baseUrl, logPath };
}

function installMenu(baseUrl, logPath) {
  const template = [
    {
      label: 'SYA Scheduler',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Open Runtime Log', click: () => shell.openPath(logPath) },
        { label: 'Open API Documentation', click: () => shell.openExternal(`${baseUrl}/docs`) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(baseUrl, logPath) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 920,
    minHeight: 680,
    title: 'SYA Scheduler',
    show: false,
    backgroundColor: '#f5efe3',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  installMenu(baseUrl, logPath);
  await mainWindow.loadURL(baseUrl);
}

async function launch() {
  try {
    const runtime = await startRuntime();
    await createWindow(runtime.baseUrl, runtime.logPath);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    runtimeLog?.write(`[desktop] startup failed: ${message}\n`);
    dialog.showErrorBox(
      'Unable to start SYA Scheduler',
      `${message}\n\nCheck the runtime log under ${app.getPath('logs')}.`,
    );
    stopRuntime();
    app.quit();
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(launch);

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    stopRuntime();
  });

  app.on('window-all-closed', () => app.quit());
}
