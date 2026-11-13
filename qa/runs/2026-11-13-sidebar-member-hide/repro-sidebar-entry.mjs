// Reproduces the intermittent hidden state of the 成员管理 sidebar entry.
//
// Prerequisite: the app is open and logged in with an owner/admin account in a
// Chrome driven by agent-browser. `agent-browser get cdp-url` prints
// ws://<host>:<port>/devtools/...; pass http://<host>:<port> instead, e.g.
//   node repro-sidebar-entry.mjs http://127.0.0.1:58896
//
// The role-gated entry is dropped while the permission query is unresolved.

import process from 'node:process'

const [endpoint] = process.argv.slice(2)

async function main() {
  if (!endpoint) {
    console.error('usage: node repro-sidebar-entry.mjs <cdp-http-endpoint>')
    process.exit(2)
  }

  const targets = await (await fetch(`${endpoint}/json/list`)).json()
  const target = targets.find(t => t.type === 'page' && t.url.includes('localhost:'))
  if (!target) {
    console.error('no app page target found; open the local app in the browser first')
    process.exit(2)
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let nextId = 1
  const pending = new Map()

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params
      const delay = request.url.includes('get-selfinfo') ? 5000 : 0
      setTimeout(() => send('Fetch.continueRequest', { requestId }), delay)
    }
  })

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  await new Promise(r => ws.addEventListener('open', r, { once: true }))
  await send('Fetch.enable', { patterns: [{ urlPattern: '*get-selfinfo*', requestStage: 'Request' }] })
  await send('Page.enable')
  await send('Runtime.enable')

  const start = Date.now()
  await send('Page.reload', { ignoreCache: false })

  const samples = []
  let sawMenu = false
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 150))
    const res = await send('Runtime.evaluate', {
      expression: `JSON.stringify([...document.querySelectorAll('.arco-menu-item')].map(e=>e.innerText.trim()))`,
      returnByValue: true,
    })
    const items = JSON.parse(res.result?.result?.value || '[]')
    samples.push({ t: Date.now() - start, items })
    if (items.length)
      sawMenu = true
    if (sawMenu && items.includes('成员管理'))
      break
  }

  const rendered = samples.find(s => s.items.length)
  if (!rendered) {
    const diag = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ appLen: document.querySelector('#app')?.innerHTML.length, title: document.title })`,
      returnByValue: true,
    })
    console.error('FAIL: the menu never rendered', diag.result?.result?.value)
    ws.close()
    process.exit(1)
  }

  const missing = samples.filter(s => s.items.length && !s.items.includes('成员管理'))
  console.warn(JSON.stringify(samples.filter((s, i, a) => i === 0 || JSON.stringify(s.items) !== JSON.stringify(a[i - 1].items)), null, 2))
  ws.close()
  if (missing.length) {
    console.error(`FAIL: 成员管理 missing in ${missing.length} rendered-menu samples, first at ${missing[0].t}ms`)
    process.exit(1)
  }
  console.warn('PASS: every rendered menu sample contains 成员管理')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
