const { app, BrowserWindow, protocol, net, session } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

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

// 注册自定义特权协议 weila-app://，标记为 secure origin，
// 这样打包后渲染进程通过该协议加载时 getUserMedia 就能正常调用。
// file:// 不被 Chromium 视为 secure origin，会导致媒体 API 直接失败。
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'weila-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
])

let agentChild = null
// 极简可观测：保留 agent 子进程 stderr 末尾若干行，启动失败时展示给用户
const AGENT_LOG_MAX_LINES = 40
let agentLogTail = []

function recordAgentLog(chunk) {
  const text = String(chunk)
  agentLogTail.push(...text.split('\n').filter(Boolean))
  if (agentLogTail.length > AGENT_LOG_MAX_LINES)
    agentLogTail = agentLogTail.slice(-AGENT_LOG_MAX_LINES)
}

function reportAgentFailure(reason) {
  const tail = agentLogTail.length ? agentLogTail.join('\n') : '(无 agent 日志输出)'
  const message = `本地 AI 助手服务未能在 ${AGENT_HOST} 启动。\n\n原因：${reason}\n\n最近日志：\n${tail}`
  console.error('[electron]', message)
  try {
    require('electron').dialog.showErrorBox('AI 助手启动失败', message)
  }
  catch (err) {
    console.error('[electron] showErrorBox failed:', err)
  }
}

function log(...args) {
  console.log('[electron]', ...args)
}

// 打包后渲染进程通过 weila-app:// 加载，Chromium 默认会拒绝麦克风等设备权限，
// 导致 AI 助手语音输入（getUserMedia）报 NotAllowedError。这里显式放行
// media / audioCapture 权限。本地可信首方应用，其余权限也一并放行以维持原有行为。
function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true)
  })
  session.defaultSession.setPermissionCheckHandler(() => true)
}

// 生产环境下通过自定义 weila-app:// 协议提供 dist 目录的静态文件服务。
// 该协议在 registerSchemesAsPrivileged 中被标记为 secure，使得 getUserMedia 可用。
function setupProtocol(distDir) {
  protocol.handle('weila-app', (request) => {
    const url = new URL(request.url)
    // 保留 pathname 中的前导 /，使 path.join 正确处理
    const filePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    return net.fetch(pathToFileURL(path.join(distDir, filePath)).href)
  })
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
    // 生产环境：直接运行预构建的 .output server（平台中立 JS），不再用 eve dev，
    // 从而不依赖 eve CLI 及 rolldown/rollup/esbuild/lightningcss 等打包器原生件。
    const agentUrl = new URL(AGENT_HOST)
    const serverEntry = path.join(agentDir, '.output', 'server', 'index.mjs')
    agentChild = spawn(process.execPath, [serverEntry], {
      cwd: agentDir,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
        HOST: agentUrl.hostname,
        PORT: agentUrl.port,
        NITRO_HOST: agentUrl.hostname,
        NITRO_PORT: agentUrl.port,
      },
      stdio: 'pipe',
      detached: false,
    })
  }

  agentChild.stdout?.on('data', (data) => {
    recordAgentLog(data)
    process.stdout.write(`[agent] ${data}`)
  })

  agentChild.stderr?.on('data', (data) => {
    recordAgentLog(data)
    process.stderr.write(`[agent] ${data}`)
  })

  let agentReady = false
  agentChild.on('error', (err) => {
    recordAgentLog(`spawn error: ${err.message}`)
    log(`agent spawn error: ${err.message}`)
  })

  agentChild.on('exit', (code) => {
    log(`agent exited with code ${code}`)
    // 启动阶段就退出（尤其非 0），说明 agent 没起来，主动报错给用户
    if (!agentReady && code !== 0)
      reportAgentFailure(`agent 进程提前退出（code ${code}）`)
    agentChild = null
  })

  const ready = await waitForAgent(AGENT_HOST, 30000)
  if (!ready) {
    log('agent failed to start in time')
    reportAgentFailure('启动超时（30s 内未通过 /eve/v1/health 健康检查）')
    return
  }
  agentReady = true
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
    win.loadURL('weila-app://index.html')
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
  setupPermissions()
  if (!isDev)
    setupProtocol(path.join(__dirname, '../dist'))
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
