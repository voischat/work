// Shared ego-browser helpers for the weila-work verify skills. Import by
// absolute path from a CFG prelude: the embedded runtime has no shell cwd or
// environment, so callers pipe in `const CFG = {...}` ahead of their script.

export function scrubUrl(url) {
  const u = new URL(url)
  for (const key of [...u.searchParams.keys()]) {
    if (/^(?:token|sign|et|uuid|appid)$/i.test(key)) u.searchParams.set(key, '…')
  }
  return u.toString()
}

// ego's page.fill prepends a stale credential prefix (seen as "70012533" on
// the login form), so set the value through the native setter and fire one
// input event for Vue to pick it up.
async function setInputValue(page, selector, value) {
  await page.evaluate(
    ([sel, v]) => {
      const input = document.querySelector(sel)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    [selector, value],
  )
}

// Fill and submit the login form on a page that already shows it. No
// navigation before or after, so it also covers SPA re-login after expiry.
export async function loginHere(page, account, password) {
  await setInputValue(page, 'input[placeholder="用户名/手机号"]', account)
  await setInputValue(page, 'input[placeholder="密码"]', password)
  await page.click('text="我已阅读并同意"', { label: 'agree privacy terms' })
  await page.click('loc=role:button[name="登录"]', { label: 'submit login' })
  await page.waitForFunction(() => !location.hash.includes('#/login'), undefined, {
    timeout: 20000,
  })
}

// One probe of the SPA state. The ego profile keeps localStorage, so a
// still-valid session renders the console (sidebar) with no login form. The
// home route is bare `#/`, and a stale modal can be open, so decide
// by DOM, never by hash.
const pageState = (page) =>
  page.evaluate(() => ({
    form: Boolean(document.querySelector('input[placeholder="用户名/手机号"]')),
    loggedIn: Boolean(document.querySelector('.arco-menu')),
  }))

// Open BASE and end up logged in on a freshly booted app. If the kept profile
// is already logged in, reload once so the app boots under any interception
// the caller armed before calling this. A blank first render (cold
// module-graph transform) gets one reload before failing.
export async function ensureLogin(page, base, account, password, settleMs = 3000) {
  await page.goto(`${base}/`, { timeout: 30000 })
  for (let attempt = 0; attempt < 2; attempt++) {
    const state = await pageState(page)
    if (state.form) {
      await loginHere(page, account, password)
      await page.waitForFunction(() => location.hash.includes('#/contact/'), undefined, {
        timeout: 20000,
      })
      await page.waitForTimeout(settleMs) // let vip / self-info settle before asserting UI
      return await page.url()
    }
    if (state.loggedIn) {
      await page.reload({ timeout: 30000 }) // fresh boot under the caller's mock
      await page.waitForTimeout(4000)
      return await page.url()
    }
    await page.reload({ timeout: 30000 })
    await page.waitForTimeout(8000)
  }
  throw new Error(`login page never rendered a form at ${base}`)
}

// Owns the page's CDP event buffer. Every pump() drains buffered events once:
// network events are folded into `requests`, and each Fetch.requestPaused is
// either fulfilled from decideMock(url) or continued untouched. Call pump()
// after every action window; events between pumps are only observed late.
export function makePump(page, decideMock) {
  const requests = new Map()
  async function pump(rounds = 1, gapMs = 250) {
    let fulfilled = 0
    for (let i = 0; i < rounds; i++) {
      if (i) await page.waitForTimeout(gapMs)
      const events = await page.events()
      for (const ev of events) {
        const p = ev.params || {}
        if (ev.method === 'Network.requestWillBeSent' && p.request) {
          requests.set(p.requestId, {
            id: p.requestId,
            method: p.request.method,
            url: p.request.url,
            ts: (p.wallTime ?? 0) * 1000,
            status: null,
          })
        } else if (ev.method === 'Network.responseReceived' && requests.has(p.requestId)) {
          requests.get(p.requestId).status = p.response.status
        } else if (ev.method === 'Fetch.requestPaused') {
          const mock = decideMock ? decideMock(p.request.url) : null
          // A paused request that expired (page reloaded while it was held)
          // answers with Invalid InterceptionId; it is already gone, skip it.
          try {
            if (mock) {
              await page.cdp('Fetch.fulfillRequest', {
                requestId: p.requestId,
                responseCode: mock.status ?? 200,
                responseHeaders: [
                  { name: 'content-type', value: mock.contentType ?? 'application/json' },
                ],
                body: mock.bodyB64,
              })
              fulfilled++
            } else {
              await page.cdp('Fetch.continueRequest', { requestId: p.requestId })
            }
          } catch {}
        }
      }
    }
    return fulfilled
  }
  return { pump, requests }
}

// Pump until the mock has been served and at least three quiet rounds follow,
// bounded by `rounds`. Returns the number of fulfilled interceptions.
export async function settlePump(page, pump, { rounds = 20, gapMs = 250, quiet = 3 } = {}) {
  let total = 0
  let lastHit = -1
  for (let i = 0; i < rounds; i++) {
    const n = await pump(1)
    if (n > 0) {
      total += n
      lastHit = i
    }
    if (total > 0 && i - lastHit >= quiet) break
    await page.waitForTimeout(gapMs)
  }
  return total
}
