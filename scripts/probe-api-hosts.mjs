#!/usr/bin/env node
// Classify where a signed v2 route is served: unreachable, route absent, or live (errcode).
// Usage: node scripts/probe-api-hosts.mjs <har-file> [--path <relative-path>] [--hosts <origin,origin>]
// Reads a signed query (appid/et/sign/uuid/token) from a captured HAR and reuses it per host.

import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import process from 'node:process'

const DEFAULT_HOSTS = [
  'https://api.voischat.cn',
  'https://voiswork.cn',
  'https://webapi.voiswork.cn',
  'https://webapi.voischat.cn',
  'https://api.weila.hk',
  'http://demo.weila.hk',
  'http://localhost:8090',
]

const CONTROL_PATH = 'corp/user/get-selfinfo'

function parseArgs(argv) {
  const [har, ...rest] = argv
  if (!har) throw new Error('usage: probe-api-hosts.mjs <har-file> [--path <p>] [--hosts <a,b>]')
  const opts = { har, path: 'corp/api/manage/get-app-list?page=0&size=20', hosts: DEFAULT_HOSTS }
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]
    const value = rest[i + 1]
    if (key === '--path') opts.path = value
    else if (key === '--hosts')
      opts.hosts = value
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
    else throw new Error(`unknown flag ${key}`)
  }
  return opts
}

function signedQueryFromHar(harPath) {
  const data = JSON.parse(readFileSync(harPath, 'utf8'))
  const entry = (data.log?.entries || []).find((e) => /\/v2\/.+token=/.test(e.request?.url || ''))
  if (!entry) throw new Error('no signed v2 request with token found in HAR')
  const query = entry.request.url.split('?')[1]
  const keep = new Set(['appid', 'et', 'sign', 'uuid', 'token'])
  return query
    .split('&')
    .filter((p) => keep.has(p.split('=')[0]))
    .join('&')
}

function call(origin, path, query) {
  const url = new URL(`${origin}/v2/${path.split('?')[0]}`)
  for (const [k, v] of new URLSearchParams(query)) url.searchParams.set(k, v)
  for (const [k, v] of new URLSearchParams(path.split('?')[1] || '')) url.searchParams.set(k, v)

  const client = url.protocol === 'http:' ? httpRequest : httpsRequest
  const body = '{}'
  return new Promise((resolve) => {
    const req = client(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        rejectUnauthorized: false,
        timeout: 6000,
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => resolve({ status: res.statusCode, text }))
      },
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', (error) => resolve({ status: 0, text: error.code || error.message }))
    req.end(body)
  })
}

function classify({ status, text }) {
  if (status === 0) return `unreachable (${text})`
  if (status === 404) return 'route absent (404)'
  if (status === 200) {
    try {
      const body = JSON.parse(text)
      if (typeof body.errcode !== 'undefined') {
        return body.errcode === 0
          ? 'live (errcode 0)'
          : `live (errcode ${body.errcode} ${body.errmsg ?? ''})`.trim()
      }
    } catch {}
    return 'live (200, non-JSON)'
  }
  return `http ${status}`
}

const opts = parseArgs(process.argv.slice(2))
const query = signedQueryFromHar(opts.har)

console.log(
  `query: appid=${new URLSearchParams(query).get('appid')} (signed params reused per host)`,
)
console.log(`target: ${opts.path}`)
console.log('')
console.log('host | control | target')

for (const host of opts.hosts) {
  const control = await call(host, CONTROL_PATH, query)
  const target = await call(host, opts.path, query)
  console.log(`${host} | ${classify(control)} | ${classify(target)}`)
}
