const { app, BrowserWindow } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')

const isDev = !app.isPackaged
const DEV_SERVER_URL = process.env.WEILA_DEV_SERVER_URL || 'https://localhost:5173'
const AGENT_HOST = process.env.WEILA_AGENT_HOST || 'http://127.0.0.1:2000'
const API_BASE_URL = process.env.WEILA_API_BASE_URL || 'https://voiswork.cn/v2'
process.env.WEILA_API_BASE_URL = API_BASE_URL
const AGENT_DIR = path.resolve(__dirname, '../../agent')

// 打包后把 agent 内嵌到 app 内部（与 packages/web 同级的 packages/agent）
const AGENT_DIR_PACKAGED = path.resolve(process.resourcesPath, 'agent')

// 开发环境下 Vite 使用自签名 mkcert 证书，Electron 默认不信任，先忽略证书错误
app.commandLine.appendSwitch('ignore-certificate-errors')

let agentChild = null
let agentStartedByElectron = false

function log(...args) {
  console.log('[electron]', ...args)
}

async function waitForAgent(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/eve/v1/health`, { signal: AbortSignal.timeout(2000) })
      if (res.ok)
        return true
    }
    catch {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function startAgent() {
  const alreadyRunning = await waitForAgent(AGENT_HOST, 2000)
  if (alreadyRunning) {
    log(`agent already running at ${AGENT_HOST}`)
    return
  }

  log('starting agent server...')
  agentStartedByElectron = true

  const agentDir = isDev ? AGENT_DIR : AGENT_DIR_PACKAGED
  const env = {
    ...process.env,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    WEILA_AGENT_HOST: AGENT_HOST,
  }

  if (isDev) {
    // 开发环境使用 pnpm
    agentChild = spawn('pnpm', ['run', 'dev'], {
      cwd: agentDir,
      env,
      stdio: 'pipe',
      detached: false,
    })
  }
  else {
    // 生产环境没有 pnpm，用 Electron 自带的 Node.js 运行内嵌 agent
    agentChild = spawn(process.execPath, [path.join(agentDir, 'node_modules/eve/bin/eve.js'), 'dev'], {
      cwd: agentDir,
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'pipe',
      detached: false,
    })
  }

  agentChild.stdout?.on('data', (data) => {
    process.stdout.write(`[agent] ${data}`)
  })

  agentChild.stderr?.on('data', (data) => {
    process.stderr.write(`[agent] ${data}`)
  })

  agentChild.on('exit', (code) => {
    log(`agent exited with code ${code}`)
    agentChild = null
    agentStartedByElectron = false
  })

  const ready = await waitForAgent(AGENT_HOST, 30000)
  if (!ready) {
    log('agent failed to start in time')
    return
  }
  log('agent ready')
}

function stopAgent() {
  if (!agentChild)
    return

  log('stopping agent server...')
  if (!agentChild.killed) {
    agentChild.kill('SIGTERM')
    // force kill after 5s
    setTimeout(() => {
      if (agentChild && !agentChild.killed)
        agentChild.kill('SIGKILL')
    }, 5000).unref()
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--agent-started-by-electron=${agentStartedByElectron}`],
    },
  })

  if (isDev) {
    win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools()
  }
  else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 生产环境下转发 /eve/v1 请求到本地 agent 服务，避免 CORS
  if (!isDev) {
    const { session } = require('electron')
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://127.0.0.1:2000/*'] }, (details, callback) => {
      details.requestHeaders['Origin'] = 'http://localhost'
      callback({ requestHeaders: details.requestHeaders })
    })
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://voiswork.cn/*'] }, (details, callback) => {
      details.requestHeaders['Origin'] = 'https://voiswork.cn'
      callback({ requestHeaders: details.requestHeaders })
    })
  }

  win.webContents.on('did-finish-load', () => {
    log(`loaded ${isDev ? DEV_SERVER_URL : 'index.html'}`)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[electron] failed to load: ${errorCode} ${errorDescription}`)
  })
}

app.whenReady().then(async () => {
  await startAgent()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAgent()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopAgent()
})

app.on('will-quit', () => {
  stopAgent()
})
