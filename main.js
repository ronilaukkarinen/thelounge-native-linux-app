const { app, BrowserWindow, shell, Notification, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const windowStateFile = path.join(__dirname, 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
  } catch {
    return { width: 1400, height: 900, x: undefined, y: undefined };
  }
}

function saveWindowState() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(windowStateFile, JSON.stringify(bounds));
  }
}

// Handle notifications from renderer
ipcMain.on('show-notification', (event, { title, body }) => {
  // Debug: uncomment to see notifications in terminal
  // console.log('Notification received:', title, body);

  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'thelounge.png')
    });
    notification.show();

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } else {
    console.log('Notifications not supported on this system');
  }
});

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'thelounge.png'),
    title: 'The Lounge'
  });

  // Override Notification API and Service Worker BEFORE page loads
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Helper to send notification to Electron
        function sendToElectron(title, body) {
          if (window.electronNotifications) {
            window.electronNotifications.send(title || 'The Lounge', body || '');
          }
        }

        // Override Notification constructor (fallback path)
        class ElectronNotification {
          static permission = 'granted';

          static requestPermission(callback) {
            const result = 'granted';
            if (callback) callback(result);
            return Promise.resolve(result);
          }

          constructor(title, options = {}) {
            this.title = title;
            this.body = options.body || '';
            sendToElectron(this.title, this.body);
          }

          close() {}
          addEventListener() {}
          removeEventListener() {}
        }
        window.Notification = ElectronNotification;

        // Override permissions query
        if (navigator.permissions) {
          const originalQuery = navigator.permissions.query.bind(navigator.permissions);
          navigator.permissions.query = function(desc) {
            if (desc.name === 'notifications') {
              return Promise.resolve({ state: 'granted', onchange: null });
            }
            return originalQuery(desc);
          };
        }

        // Intercept Service Worker postMessage (primary path for The Lounge)
        // The Lounge sends: {type: "notification", chanId, timestamp, title, body}
        if ('serviceWorker' in navigator) {
          // Patch any existing service worker registration
          function patchRegistration(reg) {
            if (reg && reg.active && !reg.active._electronPatched) {
              const originalPostMessage = reg.active.postMessage.bind(reg.active);
              reg.active.postMessage = function(data) {
                if (data && data.type === 'notification') {
                  sendToElectron(data.title, data.body);
                  return; // Don't forward to actual service worker
                }
                return originalPostMessage(data);
              };
              reg.active._electronPatched = true;
            }
            return reg;
          }

          // Override ready promise - property is on ServiceWorkerContainer.prototype
          const proto = Object.getPrototypeOf(navigator.serviceWorker);
          const originalReadyDescriptor = Object.getOwnPropertyDescriptor(proto, 'ready');
          Object.defineProperty(navigator.serviceWorker, 'ready', {
            get: function() {
              return originalReadyDescriptor.get.call(this)
                .then(patchRegistration)
                .catch(() => ({
                  active: {
                    postMessage: function(data) {
                      if (data && data.type === 'notification') {
                        sendToElectron(data.title, data.body);
                      }
                    },
                    _electronPatched: true
                  }
                }));
            },
            configurable: true
          });

          // Also patch getRegistration for any existing registrations
          const originalGetRegistration = navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);
          navigator.serviceWorker.getRegistration = function(...args) {
            return originalGetRegistration(...args).then(patchRegistration);
          };

          // Patch getRegistrations too
          const originalGetRegistrations = navigator.serviceWorker.getRegistrations.bind(navigator.serviceWorker);
          navigator.serviceWorker.getRegistrations = function() {
            return originalGetRegistrations().then(regs => regs.map(patchRegistration));
          };
        }
      })();
    `);
  });

  mainWindow.setMenu(null);
  mainWindow.loadURL('https://irc.pulina.fi');

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Also handle link clicks
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://irc.pulina.fi')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Inject scrollbar styles and notification bridge after page loads
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      ::-webkit-scrollbar:horizontal {
        display: none !important;
      }
      body, html {
        overflow-x: hidden !important;
      }
      ::-webkit-scrollbar {
        width: 4px;
        background-color: transparent;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: 20px;
        transition: background-color 0.3s ease;
      }
      ::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.5);
      }
      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.5);
        }
      }
    `);

  });

  // Zoom with Ctrl+Plus / Ctrl+Minus / Ctrl+0 (like a browser)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'keyDown') {
      if (input.key === '+' || input.key === '=') {
        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
        event.preventDefault();
      } else if (input.key === '-') {
        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5);
        event.preventDefault();
      } else if (input.key === '0') {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });

  mainWindow.on('close', saveWindowState);
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
}

app.whenReady().then(() => {
  createWindow();

  // F12 to open devtools
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
