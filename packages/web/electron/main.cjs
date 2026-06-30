const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const DEV_SERVER_URL = 'https://localhost:5173'

// 开发环境下 Vite 使用自签名 mkcert 证书，Electron 默认不信任，先忽略证书错误
app.commandLine.appendSwitch('ignore-certificate-errors')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.loadURL(DEV_SERVER_URL)

  win.webContents.on('did-finish-load', () => {
    console.log(`[electron] loaded ${DEV_SERVER_URL}`)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[electron] failed to load ${DEV_SERVER_URL}: ${errorCode} ${errorDescription}`)
  })

  // 开发时打开 DevTools，方便调试
  win.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
