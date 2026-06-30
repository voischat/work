const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  agentHost: process.env.WEILA_AGENT_HOST || 'http://127.0.0.1:2000',
  token: process.env.WEILA_ACCESS_TOKEN || '',
})
