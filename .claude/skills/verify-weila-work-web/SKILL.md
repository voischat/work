---
name: verify-weila-work-web
description: Drive the real Weila Work web console (packages/web, Vue 3 + Arco, https localhost dev server) through agent-browser to prove a change works — log in with the QA account, exercise a page or list like a user, capture requests and rendered rows as evidence, and discover whether and where a backend endpoint is deployed. Use whenever work needs runtime verification, a screenshot, a before/after data comparison, or proof that a page or endpoint works: any new or changed page, any mock-verified flow you are about to hand over, any user report of an errcode or a 404, and any check of which host or port serves a v2 endpoint.
---

# Verify weila-work-web

The app is a Vue 3 + TS admin console (`packages/web`) talking to the real corp backend at `https://api.voischat.cn/v2` through a Vite dev-server proxy. Login is by account and password over `POST /corp/auth/login`; no captcha on the password tab.

All commands run from the repo root. Work from a worktree for changes; verification drives whatever code the dev server you start serves.

## Launch

```bash
pnpm dev:prod > "$CLAUDE_JOB_DIR/tmp/dev-verify.log" 2>&1 &   # or a Bash background task
until grep -q "Local:" "$CLAUDE_JOB_DIR/tmp/dev-verify.log"; do sleep 0.5; done
grep "Local:" "$CLAUDE_JOB_DIR/tmp/dev-verify.log"
```

Ready means the `Local:` line printed AND the page actually renders (see Doctor — the first cold transform of App.vue can leave a blank page). If ports 5173+ are taken Vite picks the next one; read the URL from the log, never assume.

Teardown: stop the background task (or `kill %1`). Never kill by process name; another session's server may own the port.

## Doctor

```bash
agent-browser --session verify open "$(grep -oE 'https://localhost:[0-9]+' "$CLAUDE_JOB_DIR/tmp/dev-verify.log" | head -1)/" --ignore-https-errors
sleep 8
agent-browser --session verify snapshot -i -c | grep -q 'textbox "用户名/手机号"' && echo AUTH_PAGE_OK
```

If the snapshot is empty, reload once (`agent-browser --session verify open <same-url> --ignore-https-errors`) and wait 8s — the first module-graph transform can stall the initial load without any error. Two empty snapshots in a row means a real break: read `grep -v "\[vite\] (client)" <logfile>` for server-side errors.

The blank-page trap also hits post-login navigation: after `click` on 登录, verify the URL moved off `#/login` before driving further.

## Drive

Login (password tab is default):

```bash
agent-browser --session verify open "$BASE/" --ignore-https-errors
sleep 8
agent-browser --session verify snapshot -i -c          # refs: e23 account, e24 password, e16 privacy checkbox
agent-browser --session verify fill @e23 "70009790"
agent-browser --session verify fill @e24 "123456"
agent-browser --session verify check @e16              # login button stays disabled until checked
agent-browser --session verify snapshot -i -c          # re-read the 登录 button ref; it changes state
agent-browser --session verify find role button click --name "登录"
sleep 5
agent-browser --session verify get url                # expect #/contact/org
```

Navigation afterwards is by visible menu text (`find text "群组管理" click`) or direct hash URL (`open "$BASE/#/contact/group"`). Prefer text/route handles; snapshot refs go stale across reloads.

Evidence of what the app sent to the backend:

```bash
agent-browser --session verify network requests --filter "get-my-manage-group-list"
```

Table rows: `agent-browser --session verify snapshot -c | grep -E 'cell "' | sed 's/.*cell "//;s/".*//'`. The pager lives under `.arco-pagination` (snapshot `-s ".arco-pagination"`); pager buttons are `listitem` items, clickable by CSS `.arco-pagination-item:nth-of-type(N)`.

Notes that cost an hour if unknown:
- Login creds: `70009790` / `123456`. Do not check 记住密码.
- `network requests` shows query params with the token masked; that mask is agent-browser's, not the app's.
- Arco's `@page-change` event and its pager UI are 1-based; the wire `page` param is 0-based (PR #4). UI page N sends `page=N-1`.
- A long-idle session silently bounces to `#/login`. Before asserting a failure after minutes of idle, run `get url`; if it shows `#/login`, re-login and retry before concluding the page is broken.

## Backend probing

When an endpoint 404s, or you must find which host serves a documented route, probe instead of asking the human.

- Harvest a fresh auth query from a logged-in console. Auth rides in the query string (`appid`, `et`, `sign`, `uuid`, `token`), not headers. Capture one v2 request with `network har start` / reload / `network har stop`, then reuse its full query string and swap only the host or path. Do not re-sign by hand.
- Classify each response. A bare `404 page not found` means the route is absent. `HTTP 200` with an `errcode` means the route is live and the errcode is business logic, not a missing route.
- Keep a liveness control. Call `corp/user/get-selfinfo` with the same token on the same host. If it returns 200 and your target 404s, the route is missing on that host, not an auth or proxy problem.
- Sweep candidates before asking. Try the known hosts and local ports, then report a per-host classification.

Proxy targets live in `packages/web/vite.config.ts`, keyed on `NODE_ENV`. `pnpm dev:prod` (`NODE_ENV=production`) sends both `/v1` and `/v2` to `https://api.voischat.cn`; plain `pnpm dev` sends `/v1` to `http://demo.weila.hk` and `/v2` to `http://localhost:8090` (the local corp backend, usually not running). Read the file for current targets instead of trusting memory. The proxy is dev-only; packaged prod uses same-origin `/v2` or Electron `WEILA_API_BASE_URL`.

## Evidence

Capture to `$CLAUDE_JOB_DIR/tmp/` (a per-job scratch dir that survives app teardown but not the job; for artifacts a human must see later, also copy under a path you name in the report):

- The request that proves the behavior: full line from `network requests --filter <endpoint>` (method, URL with query params, status).
- The rendered result: row cells or `screenshot $CLAUDE_JOB_DIR/tmp/<kebab-name>.png`.
- Before/after equivalence: capture both the request line and the rows on the same page before the change, then after, and diff them yourself; identical rows with the intended request delta is the pass bar.
- Mock secrets must be plain literal dummies like `sk-test-0000`, never placeholder-shaped strings; the harness substitutes placeholder tokens with real values, which then land in screenshots.
- Scrub real `sign`/`token` query strings from anything you capture or share. A masked token in `network requests` is agent-browser's mask; HAR and probe output carry the real value.

Proof standards: drive the real UI path (menu click or real route), never an internal setter; capture the action's request and the resulting visible state together; a claim about data equality needs the actual row values from both runs, not a 200 status alone. Mock-verified is a proxy, not proof: before handover, load the page with zero mocks and run every flow you shipped, in both locales when you changed i18n'd UI. If a blocker forced you to defer a verification, re-open the whole deferred list the moment it clears; the list is empty before merge.

## Cleanup

```bash
agent-browser --session verify close
```

Stop the dev-server background task you started. Do not delete `$CLAUDE_JOB_DIR/tmp/` — the evidence lives there. Leave any other session's server on 5173/5174 alone.

## Helpers

The drive stays on three thin agent-browser primitives (open/snapshot, fill/click/find, network requests). Two techniques are not obvious and are worth reaching for directly:

- Mock a not-yet-deployed endpoint with `agent-browser --session verify network route "**/v2/<path>*" --body fixture.json --allow-origin <origin>`, installed BEFORE the navigation that fires the request. The body must be the raw backend envelope `{errcode:0, errmsg, data:...}`, not the already-unwrapped shape. Unroute when done. See `../verify-vip-edition-flags/SKILL.md` for a working script.
- Measure layout stability with `agent-browser --session verify get box "<selector>"`. Read the box before and after the interaction. When a control changes cell content in an Arco auto-fit table (mask/reveal, long value), assert the column width is unchanged by the toggle.

## Feature map

See `features/README.md`. Current entries: group list pagination, member list pagination, picker modal pager, dept list (pager missing — known gap, being fixed). Extend the map when you verify a feature it does not cover.
