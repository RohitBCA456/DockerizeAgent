// frontend/main.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

// The base URL of your backend server
const BASE_URL = 'http://localhost:4000';

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'public/assets/icon.png'),
    title: "DevOps Agent"
  });

  mainWindow.loadURL('http://localhost:3000');

  return mainWindow;
}

app.whenReady().then(() => {
  const mainWindow = createMainWindow();

  ipcMain.on('login-google', () => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(`${BASE_URL}/auth/google`);

    authWindow.on('closed', () => {
      mainWindow.webContents.send('auth-success');
    });
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (!canceled) {
      return filePaths[0];
    }
  });

  ipcMain.on('open-external-link', (event, url) => {
    shell.openExternal(url);
  });


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