// Strip crossorigin/CSP/integrity from build output so Electron loadFile works
const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '../dist')

for (const entry of fs.readdirSync(distDir, { recursive: true })) {
  const p = path.join(distDir, entry)
  if (!entry.endsWith('.html') || !fs.statSync(p).isFile()) continue

  let html = fs.readFileSync(p, 'utf-8')
  // Strip crossorigin and integrity on script/link tags
  html = html.replace(/\s+crossorigin(?:\s*=\s*"[^"]*")?/g, '')
  html = html.replace(/\s+integrity="[^"]*"/g, '')
  // Strip CSP upgrade-insecure-requests meta
  html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '')
  fs.writeFileSync(p, html)
}

console.log('[fix-electron-build] done')
