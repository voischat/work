import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

const root = '/Users/kvoon/weila/weila-work-and-sdk/weila-work/packages/web/dist'
const port = 5180
const apiTarget = 'https://api.voischat.cn'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.map': 'application/json',
}

function proxy(req, res) {
  const url = new URL(apiTarget)
  const headers = { ...req.headers, host: url.host }
  delete headers.origin
  delete headers.referer
  const proxyReq = https.request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 443,
    path: req.url,
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
    proxyRes.pipe(res)
  })
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(String(err))
  })
  req.pipe(proxyReq)
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/v1') || req.url.startsWith('/v2')) {
    proxy(req, res)
    return
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0])
  let filePath = path.join(root, urlPath === '/'
    ? '/index.html'
    : urlPath)
  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory())
    filePath = path.join(root, 'index.html')

  const ext = path.extname(filePath)
  res.writeHead(200, {
    'content-type': mime[ext] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(port, () => {
  console.warn(`serving ${root} on http://localhost:${port}`)
})
