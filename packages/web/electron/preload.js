const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  agentHost: process.env.WEILA_AGENT_HOST || 'http://127.0.0.1:2000',
  apiBaseUrl: process.env.WEILA_API_BASE_URL || '',
  token: process.env.WEILA_ACCESS_TOKEN || '',
})
