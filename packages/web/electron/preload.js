const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  agentHost: process.env.WEILA_AGENT_HOST || 'http://127.0.0.1:2000',
  apiBaseUrl: process.env.WEILA_API_BASE_URL || 'https://voiswork.cn/v2',
  // debug: 渲染进程日志回传
  debugLog: (...args) => ipcRenderer.send('__debug_log__', ...args),
})
