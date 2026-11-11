const path = require('node:path');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');

let gameWindow;

function windowFor(event) {
  if (!gameWindow || event.sender !== gameWindow.webContents || event.senderFrame !== gameWindow.webContents.mainFrame) {
    throw new Error('Display control is restricted to the game window.');
  }
  return gameWindow;
}

function toggleFullscreen(window) {
  const fullscreen = !window.isFullScreen();
  window.setFullScreen(fullscreen);
  return fullscreen;
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'After the Rain',
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    fullscreen: true,
    show: false,
    backgroundColor: '#101816',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  gameWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { gameWindow = undefined; });
  const announceFullscreen = fullscreen => {
    window.webContents.send('display:fullscreen-changed', fullscreen);
  };
  window.on('enter-full-screen', () => announceFullscreen(true));
  window.on('leave-full-screen', () => announceFullscreen(false));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.code !== 'F11') return;
    event.preventDefault();
    if (!input.isAutoRepeat) toggleFullscreen(window);
  });
  window.loadFile(path.join(__dirname, '..', 'index.html')).catch(error => {
    console.error(error);
    app.quit();
  });
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    if (!gameWindow) return;
    if (gameWindow.isMinimized()) gameWindow.restore();
    gameWindow.focus();
  });
  ipcMain.handle('display:get-fullscreen', event => windowFor(event).isFullScreen());
  ipcMain.handle('display:toggle-fullscreen', event => toggleFullscreen(windowFor(event)));
  ipcMain.handle('display:close', event => windowFor(event).close());
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
} else {
  app.quit();
}
