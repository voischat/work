---
name: verify-weila-work-web
description: Drive the real Weila Work web console (apps/website, Vue 3 + Arco, https localhost dev server) through ego-browser to prove a change works — log in with the QA account, exercise a page or list like a user, capture requests and rendered rows as evidence, and discover whether and where a backend endpoint is deployed. Use whenever work needs runtime verification, a screenshot, a before/after data comparison, or proof that a page or endpoint works: any new or changed page, any mock-verified flow you are about to hand over, any user report of an errcode or a 404, and any check of which host or port serves a v2 endpoint.
---

# Verify weila-work-web

The app is a Vue 3 + TS admin console (`apps/website`) talking to the real corp backend at `https://api.voischat.cn/v2` through a Vite dev-server proxy. Login is by account and password over `POST /corp/auth/login`; no captcha on the password tab.

All commands run from the repo root. Work from a worktree for changes; verification drives whatever code the dev server you start serves.

ego-browser runs one Node script per observation. A whole verification is a sequence of scripts against one TaskSpace, not a sequence of CLI calls. Start a script with the session setup below and end the flow's last script with `task.finish`. The shared helpers live at `.claude/skills/lib/ego-driver.mjs`; import them by absolute path because the embedded runtime has no shell cwd or environment.

```js
const driver = await import('/abs/path/to/weila-work/.claude/skills/lib/ego-driver.mjs')
const task = await taskSpace('weila verify <feature>') // resume by numeric id once printed
const page = task.page('p1')
```

## Launch

```bash
pnpm dev:prod > "$CLAUDE_JOB_DIR/tmp/dev-verify.log" 2>&1 &   # or a Bash background task
until grep -q "Local:" "$CLAUDE_JOB_DIR/tmp/dev-verify.log"; do sleep 0.5; done
grep "Local:" "$CLAUDE_JOB_DIR/tmp/dev-verify.log"
```

Ready means the `Local:` line printed AND the page actually renders (see Doctor — the first cold transform of App.vue can leave a blank page). If ports 5173+ are taken Vite picks the next one; read the URL from the log, never assume. Call it `BASE` in every script.

Teardown: stop the background task (or `kill %1`). Never kill by process name; another session's server may own the port.

Linked-SDK changes: re-pointing `apps/website/node_modules/@vois/weila-sdk-core` at a checkout and rebuilding does **not** refresh Vite's dep prebundle — delete `apps/website/node_modules/.vite` and restart the dev server, or the browser keeps serving the old `@vois_weila-sdk-core.js`. Before trusting a listener, prove which checkout owns it: `ps aux | rg vite`, then `lsof -p <pid> | rg cwd`; a foreign worktree's dev server can hold the port and serve its own prebundle (verify via `.vite/deps/_metadata.json`'s `src` path).

## Doctor

```js
await page.goto(`${BASE}/`, { timeout: 30000 })
await page.waitForTimeout(8000)
let snap = await page.snapshot()
if (!snap.includes('用户名/手机号') && !snap.includes('arco-menu')) {
  await page.goto(`${BASE}/`, { timeout: 30000 }) // first module-graph transform can stall a blank load
  await page.waitForTimeout(8000)
  snap = await page.snapshot()
}
console.log(snap.includes('用户名/手机号') || snap.includes('arco-menu') ? 'APP_OK' : 'APP_EMPTY')
console.log(snap.split('\n').slice(0, 20).join('\n'))
```

One retry is the allowance — the first cold transform of App.vue can stall the initial load without any error. Two empty snapshots in a row means a real break: read `grep -v "\[vite\] (client)" <logfile>` for server-side errors.

The blank-page trap also hits post-login navigation: after the 登录 click, wait for the URL to move off `#/login` and for the console sidebar (`.arco-menu`) to mount before driving further.

The Ego profile keeps its localStorage, so a session from an earlier run can still be valid. If the snapshot shows the console sidebar instead of the login form, you are already logged in; do not clear site storage to force the form.

## Drive

Login, with the shared driver handling the cold-transform retry, the already-logged-in case, and the consent checkbox:

```js
const driver = await import('/abs/path/to/weila-work/.claude/skills/lib/ego-driver.mjs')
const task = await taskSpace('weila verify <feature>')
const page = task.page('p1')
console.log(
  await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD),
)
console.log(await page.snapshot())
```

Manual form, when you need to drive the login UI itself:

```js
await page.fill('loc=css:input[placeholder="用户名/手机号"]', '$WEILA_QA_ACCOUNT')
await page.fill('loc=css:input[placeholder="密码"]', '$WEILA_QA_PASSWORD')
await page.click('text="我已阅读并同意"', { label: 'agree privacy terms' }) // login stays disabled until checked
await page.click('loc=role:button[name="登录"]', { label: 'submit login' })
await page.waitForFunction(() => location.hash.includes('#/contact/'), undefined, {
  timeout: 20000,
})
```

Navigation afterwards is by visible menu text or direct hash URL. Prefer `text=` and hash routes; snapshot refs go stale across reloads.

```js
await page.click('text=群组管理', { label: 'open group list' })
await page.goto(`${BASE}/#/contact/group`)
```

Evidence of what the app sent to the backend. Enable Network in the same script that acts and reads, since `page.events()` returns and clears the buffer:

```js
await page.cdp('Network.enable')
// ... exercise the page ...
const { pump, requests } = driver.makePump(page, null)
await pump(8, 250)
console.log(
  [...requests.values()]
    .filter((r) => r.url.includes('get-my-manage-group-list'))
    .map((r) => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`)
    .join('\n'),
)
```

Table rows, deterministically:

```js
console.log(
  await page.evaluate(() =>
    [...document.querySelectorAll('.arco-table td')].map((td) => td.textContent.trim()).join(' | '),
  ),
)
```

The pager lives under `.arco-pagination`; the plain CSS for a page button (`.arco-pagination-item:nth-of-type(2)`) matches both the `li` and its inner span, and ego requires exactly one match, so click pager page N by indexed xpath, `await page.click('xpath=(//li[normalize-space(.)="2"])[1]')`. `await page.snapshot()` shows the semantic tree when you need element roles or `loc=` hints.

Notes that cost an hour if unknown:

- Login creds: `$WEILA_QA_ACCOUNT` / `$WEILA_QA_PASSWORD`. Do not check 记住密码.
- Request logs and probes carry the real auth query values; `driver.scrubUrl` masks `token`/`sign`/`et`/`uuid`/`appid`, so print URLs through it. Snapshots and screenshots do not carry the query string.
- Arco's `@page-change` event and its pager UI are 1-based; the wire `page` param is 0-based (PR #4). UI page N sends `page=N-1`.
- A long-idle session silently bounces to `#/login`. Before asserting a failure after minutes of idle, run `await page.url()`; if it shows `#/login`, re-login and retry before concluding the page is broken.

## Backend probing

When an endpoint 404s, or you must find which host serves a documented route, probe instead of asking the human.

- Harvest a fresh auth query from a logged-in console. Auth rides in the query string (`appid`, `et`, `sign`, `uuid`, `token`), not headers. Capture one v2 request with `Network.enable` plus the pump (see Evidence), keep its full query string in-script, and swap only the host or path. Do not re-sign by hand.
- Probe from inside the page with `page.fetch` (same cookies, same proxy) or with Node's `fetch` for background requests: `await page.fetch("https://api.voischat.cn/v2/<path>?<harvested query>")` returns `{ ok, status, statusText, headers, body }`.
- Classify each response. A bare `404 page not found` means the route is absent. `HTTP 200` with an `errcode` means the route is live and the errcode is business logic, not a missing route.
- Keep a liveness control. Call `corp/user/get-selfinfo` with the same token on the same host. If it returns 200 and your target 404s, the route is missing on that host, not an auth or proxy problem.
- Sweep candidates before asking. Try the known hosts and local ports, then report a per-host classification.

Proxy targets live in `apps/website/vite.config.ts`, keyed on `NODE_ENV`. `pnpm dev:prod` (`NODE_ENV=production`) sends both `/v1` and `/v2` to `https://api.voischat.cn`; plain `pnpm dev` sends `/v1` to `http://demo.weila.hk` and `/v2` to `http://localhost:8090` (the local corp backend, usually not running). Read the file for current targets instead of trusting memory. The proxy is dev-only; packaged prod uses same-origin `/v2` or Electron `WEILA_API_BASE_URL`.

## Accounts and environments

Mine the ego profile instead of asking the human for accounts and hosts:

- The ego browser profile is a Chromium profile at `~/Library/Application Support/Citro Labs/ego lite`. Copy `Default/History` out and `sqlite3` the `urls` table (`select distinct ... from urls`) to enumerate the production hosts the user actually visits.
- On a logged-in page, dump `localStorage` and decrypt the credential blobs with CryptoJS AES, key `weila-frontend-key` (storage keys `temp-account`, `account-history-record`, `saved-credentials`) to recover console accounts.
- Console credentials and SDK credentials are different systems (see the SDK repo's verification skill, 第 3 层): a working web login does not imply a working SDK login.

## Evidence

Capture to `$CLAUDE_JOB_DIR/tmp/` (a per-job scratch dir that survives app teardown but not the job; for artifacts a human must see later, also copy under a path you name in the report):

- The request that proves the behavior: a scrubbed line from the pump, with method, URL, and status.
- The rendered result: extracted row text, or `await page.screenshot({ path: "/abs/path/$CLAUDE_JOB_DIR/tmp/<kebab-name>.png" })`. Screenshot paths must be absolute; the ego runtime rejects relative ones.
- Before/after equivalence: capture both the request line and the rows on the same page before the change, then after, and diff them yourself; identical rows with the intended request delta is the pass bar.
- Mock secrets must be plain literal dummies like `sk-test-0000`, never placeholder-shaped strings; the harness substitutes placeholder tokens with real values, which then land in screenshots.
- Scrub real `sign`/`token` query strings from anything you capture or share. Use `driver.scrubUrl`; the raw event log carries the real values.
- Which SDK build the page runs: read `WL_BUILD_ID` (the short git SHA of the build) from the runtime on a fresh page — evaluate the dep module's export — never text-search the prebundle or cache files, where multiple stamps legitimately coexist and once cost a day-long false investigation.

Proof standards: drive the real UI path (menu click or real route), never an internal setter; capture the action's request and the resulting visible state together; a claim about data equality needs the actual row values from both runs, not a 200 status alone. Mock-verified is a proxy, not proof: before handover, load the page with zero mocks and run every flow you shipped, in both locales when you changed i18n'd UI. If a blocker forced you to defer a verification, re-open the whole deferred list the moment it clears; the list is empty before merge.

## Cleanup

```js
await task.finish({ keep: [] })
```

Keeping Pages is the exception, only when the user explicitly asked for the result to stay in the browser. A failed flow leaves its TaskSpace open for debugging; the last output prints its id. Stop the dev-server background task you started. Do not delete `$CLAUDE_JOB_DIR/tmp/` — the evidence lives there. Leave any other session's server on 5173/5174 alone.

## Helpers

The drive stays on thin ego-browser primitives (goto/snapshot, fill/click with text and role selectors, CDP-network capture). Two techniques are not obvious and are worth reaching for directly:

- Mock a not-yet-deployed endpoint by arming a CDP Fetch interception before the navigation that fires the request:
  ```js
  const fixtureB64 = (await import('node:fs')).readFileSync('/abs/fixture.json').toString('base64')
  const { pump } = driver.makePump(page, (url) =>
    url.includes('<path fragment>') ? { bodyB64: fixtureB64 } : null,
  )
  await page.cdp('Fetch.enable', {
    patterns: [{ urlPattern: '*<path>*', requestStage: 'Request' }],
  })
  // navigate, then drain so paused requests get fulfilled:
  await driver.settlePump(page, pump)
  await page.cdp('Fetch.disable')
  ```
  The body must be the raw backend envelope `{errcode:0, errmsg, data:...}`, not the already-unwrapped shape. Keep the interception armed for the whole flow, across reloads. See `../verify-vip-edition-flags/verify-edition.mjs` for a working script.
- Measure layout stability before and after the interaction:
  ```js
  await page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect()
    return { x: r.x, width: r.width }
  }, '<selector>')
  ```
  When a control changes cell content in an Arco auto-fit table (mask/reveal, long value), assert the column width is unchanged by the toggle.
- Capture console errors: `page.on` does not exist in the ego runtime. `page.cdp('Runtime.enable')` before acting, then drain `page.events()` and filter `Runtime.exceptionThrown` and `Runtime.consoleAPICalled` with `type === 'error'`. `task.page(label)` only returns an already-created page — new labels need `task.newPage()`. `page.cdp('egoAutomated.disable')` before a reload suppresses the automation marker.

## Feature map

See `features/README.md`. Current entries: group list pagination, member list pagination, picker modal pager, dept list (pager missing — known gap, being fixed). Extend the map when you verify a feature it does not cover.
