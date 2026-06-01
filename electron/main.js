'use strict';

const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 3456;
const SERVER_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 300;

let serverProcess = null;
let mainWindow = null;

// ── Server management ─────────────────────────────────────────────────────────

/**
 * Returns the server launch target.
 * - Packaged: Electron's own Node runtime (ELECTRON_RUN_AS_NODE=1) runs server.js
 * - Dev:      system node runs the source directly
 */
function resolveServerTarget() {
  if (app.isPackaged) {
    return {
      cmd: process.execPath,   // electron binary acting as Node
      args: [path.join(process.resourcesPath, 'server.js')],
    };
  }
  return {
    cmd: 'node',
    args: [path.join(__dirname, '..', 'server', 'src', 'index.js')],
  };
}

function startServer() {
  const { cmd, args } = resolveServerTarget();

  // When packaged, tell the server where to find the client dist and data dir
  // so each part can be swapped independently without rebuilding Electron.
  // ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave as plain Node.js.
  // NODE_PATH points to the resources/node_modules where better-sqlite3 lives
  // (rebuilt for Electron's ABI by electron-builder).
  const extraEnv = app.isPackaged
    ? {
        ELECTRON_RUN_AS_NODE: '1',
        // electron-builder rebuilds native deps into resources/app/node_modules
        NODE_PATH:        path.join(process.resourcesPath, 'app', 'node_modules'),
        CLIENT_DIST_PATH: path.join(process.resourcesPath, 'client', 'dist'),
        DATA_DIR:         path.join(process.resourcesPath, 'data'),
      }
    : {};

  console.log(`[electron] Starting server: ${cmd} ${args.join(' ')}`);

  serverProcess = spawn(cmd, args, {
    env: { ...process.env, PORT: String(PORT), ...extraEnv },
    detached: false,
    windowsHide: true,   // hide the console window on Windows
  });

  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));

  serverProcess.on('error', (err) => {
    console.error('[electron] Failed to start server:', err.message);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`[electron] Server exited — code=${code} signal=${signal}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (!serverProcess) return;
  try {
    serverProcess.kill();
  } catch (_) {
    // already dead
  }
  serverProcess = null;
}

// ── Readiness polling ─────────────────────────────────────────────────────────

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + READY_TIMEOUT_MS;

    const attempt = () => {
      http
        .get(SERVER_URL, (res) => {
          res.resume();           // drain the response so the socket closes cleanly
          resolve();
        })
        .on('error', () => {
          if (Date.now() >= deadline) {
            reject(new Error(`Server did not become ready within ${READY_TIMEOUT_MS / 1000}s`));
          } else {
            setTimeout(attempt, POLL_INTERVAL_MS);
          }
        });
    };

    attempt();
  });
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: '2Dot Billz',
    // Uses default Electron icon; swap in a real .ico via electron-builder config
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,        // shown only after content loads (avoids white flash)
  });

  // Remove default menu bar (optional — delete this line to keep it)
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open every <a target="_blank"> link in the OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(SERVER_URL);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startServer();

  try {
    await waitForServer();
    console.log('[electron] Server is ready — opening window');
    createWindow();
  } catch (err) {
    dialog.showErrorBox(
      '2Dot Billz — Startup Error',
      `The backend server failed to start.\n\n${err.message}\n\nPlease check that port ${PORT} is not already in use.`
    );
    stopServer();
    app.quit();
  }
});

// Quit when all windows are closed (standard on Windows / Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// macOS: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Always kill the server when Electron exits
app.on('will-quit', () => {
  stopServer();
});
