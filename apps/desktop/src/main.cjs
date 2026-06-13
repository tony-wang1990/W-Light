const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const isDev = process.env.W_LIGHT_DESKTOP_DEV === 'true';
const appProtocol = 'wlight';
const appHost = 'app';

protocol.registerSchemesAsPrivileged([
  {
    scheme: appProtocol,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function resolveWebFile(requestUrl) {
  const webRoot = path.resolve(__dirname, '..', 'web');
  const parsed = new URL(requestUrl);
  const pathname = decodeURIComponent(parsed.pathname || '/');
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = path.resolve(webRoot, requestedPath);

  if (!candidate.startsWith(webRoot)) return path.join(webRoot, 'index.html');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;

  return path.join(webRoot, 'index.html');
}

function registerAppProtocol() {
  protocol.handle(appProtocol, request => net.fetch(pathToFileURL(resolveWebFile(request.url)).toString()));
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    title: 'W-Light',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.W_LIGHT_DESKTOP_URL) {
    win.loadURL(process.env.W_LIGHT_DESKTOP_URL);
    return;
  }

  win.loadURL(`${appProtocol}://${appHost}/index.html`);
}

app.whenReady().then(() => {
  registerAppProtocol();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
