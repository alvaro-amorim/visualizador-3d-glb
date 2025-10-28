// C:\Users\Álvaro Amorim\app-3d-educativo\src\main.js

// Mantemos o 'session' para o caso de precisarmos dele
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('fs');

if (require('electron-squirrel-startup')) {
  app.quit();
}

// A tua função handleFileOpen
async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Modelos 3D', extensions: ['glb', 'fbx'] }
    ]
  });
  if (canceled || filePaths.length === 0) { return null; }
  try {
    const data = fs.readFileSync(filePaths[0]);
    return data;
  } catch (err) {
    console.error('Falha ao ler o ficheiro:', err);
    return null;
  }
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      
      // <<< ALTERAÇÃO: A linha 'webSecurity: false' foi REMOVIDA >>>
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  // (Removemos o 'session.defaultSession' daqui para manter limpo)
  createWindow();
  ipcMain.handle('dialog:openFile', handleFileOpen);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});