// Shared ego-browser helpers for the weila-work verify skills. Typed entry
// scripts import this module directly; the shell wrappers pipe a small JS
// bootstrap that sets globalThis.CFG and imports the entry, because the
// embedded runtime parses stdin as JavaScript and has no shell cwd or
// environment.

export interface EgoEvent {
  method: string
  params?: {
    requestId?: string
    request?: { method: string; url: string }
    wallTime?: number
    response?: { status: number }
  }
}

export interface EgoPage {
  evaluate<T, A = unknown>(script: (arg: A) => T | Promise<T>, arg?: A): Promise<T>
  waitForFunction<T>(
    script: (arg: T) => boolean,
    arg?: T,
    options?: { timeout?: number },
  ): Promise<unknown>
  click(selector: string, options?: { label?: string }): Promise<void>
  goto(url: string, options?: { timeout?: number; waitUntil?: string }): Promise<unknown>
  reload(options?: { timeout?: number }): Promise<unknown>
  waitForTimeout(milliseconds: number): Promise<void>
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>
  cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
  events(): Promise<EgoEvent[]>
  url(): Promise<string>
  keyboard: { press(key: string): Promise<void> }
  screenshot(options: { path: string }): Promise<unknown>
}

export interface EgoTask {
  page(id: string): EgoPage
  finish(options: { keep: string[] }): Promise<void>
  spaceId: string | number
}

export interface CapturedRequest {
  id: string
  method: string
  url: string
  ts: number
  status: number | null
}

export interface MockResponse {
  status?: number
  contentType?: string
  bodyB64: string
}

export type DecideMock = ((url: string) => MockResponse | null) | null

export function scrubUrl(url: string): string {
  const u = new URL(url)
  for (const key of [...u.searchParams.keys()]) {
    if (/^(?:token|sign|et|uuid|appid)$/i.test(key)) u.searchParams.set(key, '…')
  }
  return u.toString()
}

// ego's page.fill prepends a stale credential prefix (seen as "70012533" on
// the login form), so set the value through the native setter and fire one
// input event for Vue to pick it up.
export async function setInputValue(
  page: EgoPage,
  selector: string,
  value: string,
): Promise<void> {
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

// The login form carries a "remember password" checkbox before the consent
// one, so read the consent input from its visible label instead of by tag.
export async function consentChecked(page: EgoPage): Promise<boolean> {
  return await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.arco-checkbox')]
    const label = labels.find(
      (l) => l.getClientRects().length > 0 && l.textContent.includes('我已阅读并同意'),
    )
    const input = label?.querySelector('input[type="checkbox"]')
      ?? document.querySelector('input[type="checkbox"]')
    return input?.checked ?? false
  })
}

// The ego profile keeps localStorage across TaskSpaces, so the session on
// screen belongs to whoever logged in last: a pool account, or a person at the
// browser. The console rewrites `login_time` on every login and token refresh,
// so a marker pairing a hash of the login account with that stamp proves a
// kept session is the caller's account and that nobody logged in since.
const MARKER_KEY = 'weila_verify_login'

const readLoginTime = (page: EgoPage): Promise<string | null> =>
  page.evaluate(() => localStorage.getItem('login_time'))

async function sessionStamp(
  page: EgoPage,
  account: string,
  stamp: boolean,
): Promise<boolean> {
  return await page.evaluate<boolean, [string, string, boolean]>(
    async ([key, account, stamp]) => {
      if (!globalThis.crypto?.subtle)
        return false
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(account))
      const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
      const loginTime = localStorage.getItem('login_time')
      if (stamp) {
        localStorage.setItem(key, JSON.stringify({ hash, loginTime }))
        return true
      }
      try {
        const marker = JSON.parse(localStorage.getItem(key) || 'null')
        return marker?.hash === hash && marker.loginTime === loginTime
      } catch {
        return false
      }
    },
    [MARKER_KEY, account, stamp],
  )
}

const isOwnSession = async (page: EgoPage, account: string): Promise<boolean> =>
  Boolean(await sessionStamp(page, account, false).catch(() => false))

async function stampLogin(page: EgoPage, account: string, previous: string | null): Promise<void> {
  await page.waitForFunction(
    (prev) => {
      const time = Number(localStorage.getItem('login_time'))
      return time > 0 && String(time) !== prev
    },
    previous,
    { timeout: 10000 },
  )
  await sessionStamp(page, account, true)
}

// Empty the origin's storage on a page that shows the login route. The app
// keeps its session in memory, so the caller reloads afterwards.
export async function clearSession(page: EgoPage, base: string): Promise<void> {
  await page.goto('about:blank')
  await page.goto(`${base}/#/login`, { timeout: 30000 })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// Fill and submit the login form on a page that already shows it, then stamp
// the session with the account. No navigation before or after, so it also
// covers SPA re-login after expiry.
export async function loginHere(
  page: EgoPage,
  account: string,
  password: string,
): Promise<void> {
  await setInputValue(page, 'input[placeholder="用户名/手机号"]', account)
  await setInputValue(page, 'input[placeholder="密码"]', password)
  if (!(await consentChecked(page)))
    await page.click('text="我已阅读并同意"', { label: 'agree privacy terms' })
  const previous = await readLoginTime(page)
  await page.click('loc=role:button[name="登录"]', { label: 'submit login' })
  await page.waitForFunction(() => !location.hash.includes('#/login'), undefined, {
    timeout: 20000,
  })
  await stampLogin(page, account, previous)
}

// One probe of the SPA state. A still-valid session renders the console
// (sidebar) with no login form. The home route is bare `#/`, and a stale modal
// can be open, so decide by DOM, never by hash.
const pageState = (page: EgoPage): Promise<{ form: boolean; loggedIn: boolean }> =>
  page.evaluate(() => ({
    form: Boolean(document.querySelector('input[placeholder="用户名/手机号"]')),
    loggedIn: Boolean(document.querySelector('.arco-menu')),
  }))

// Open BASE and end up logged in as `account` on a freshly booted app. A kept
// session is reused only when its stamp proves it is that account, so the app
// boots under any interception the caller armed; any other session is emptied
// and replaced. A blank first render (cold module-graph transform) reloads
// before failing.
export async function ensureLogin(
  page: EgoPage,
  base: string,
  account: string,
  password: string,
  settleMs = 3000,
): Promise<string> {
  await page.goto(`${base}/`, { timeout: 30000 })
  for (let step = 0; step < 4; step++) {
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
      if (await isOwnSession(page, account)) {
        await page.reload({ timeout: 30000 })
        await page.waitForTimeout(4000)
        return await page.url()
      }
      await clearSession(page, base)
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
export function makePump(
  page: EgoPage,
  decideMock: DecideMock,
): { pump: (rounds?: number, gapMs?: number) => Promise<number>; requests: Map<string, CapturedRequest> } {
  const requests = new Map<string, CapturedRequest>()
  async function pump(rounds = 1, gapMs = 250): Promise<number> {
    let fulfilled = 0
    for (let i = 0; i < rounds; i++) {
      if (i) await page.waitForTimeout(gapMs)
      const events = await page.events()
      for (const event of events) {
        const params = event.params ?? {}
        const requestId = params.requestId
        if (event.method === 'Network.requestWillBeSent' && params.request && requestId) {
          requests.set(requestId, {
            id: requestId,
            method: params.request.method,
            url: params.request.url,
            ts: (params.wallTime ?? 0) * 1000,
            status: null,
          })
        } else if (event.method === 'Network.responseReceived' && requestId) {
          const captured = requests.get(requestId)
          if (captured) captured.status = params.response?.status ?? null
        } else if (event.method === 'Fetch.requestPaused' && requestId) {
          const mock = decideMock ? decideMock(params.request?.url ?? '') : null
          // A paused request that expired (page reloaded while it was held)
          // answers with Invalid InterceptionId; it is already gone, skip it.
          try {
            if (mock) {
              await page.cdp('Fetch.fulfillRequest', {
                requestId,
                responseCode: mock.status ?? 200,
                responseHeaders: [
                  { name: 'content-type', value: mock.contentType ?? 'application/json' },
                ],
                body: mock.bodyB64,
              })
              fulfilled++
            } else {
              await page.cdp('Fetch.continueRequest', { requestId })
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
export async function settlePump(
  page: EgoPage,
  pump: (rounds?: number, gapMs?: number) => Promise<number>,
  { rounds = 20, gapMs = 250, quiet = 3 }: { rounds?: number; gapMs?: number; quiet?: number } = {},
): Promise<number> {
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
