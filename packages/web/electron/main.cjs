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

  const agentDir = isDev ? AGENT_DIR : AGENT_DIR_PACKAGED
  // 读取 agent 目录下的 .env（dev + prod 都读）
  const env = { ...process.env, WEILA_AGENT_HOST: AGENT_HOST }
  ;(function loadDotEnv() {
    try {
      const fs = require('node:fs')
      const envPath = path.join(agentDir, '.env')
      const envContent = fs.readFileSync(envPath, 'utf-8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx === -1) continue
        const key = trimmed.slice(0, idx).trim()
        if (env[key]) continue
        env[key] = trimmed.slice(idx + 1).trim()
      }
    }
    catch { /* no .env */ }
  })()

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
  })

  const ready = await waitForAgent(AGENT_HOST, 30000)
  if (!ready) {
    log('agent failed to start in time')
    return
  }
  log('agent ready')
}

function stopAgent() {
  if (!agentChild) return

  log('stopping agent server...')
  if (!agentChild.killed) {
    if (process.platform === 'win32') {
      require('node:child_process').execSync(`taskkill /pid ${agentChild.pid} /T /F`, { stdio: 'ignore' })
    } else {
      agentChild.kill('SIGTERM')
      setTimeout(() => {
        if (agentChild && !agentChild.killed)
          agentChild.kill('SIGKILL')
      }, 5000).unref()
    }
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
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
