---
name: apipost-doc-to-page
description: Turn a pasted Apipost (docs.apipost.net) API doc into a new page in the Weila Work web console. Render the SPA doc and extract its endpoints and types, probe every documented route against a reachable backend before writing code, build the auto-routed Vue page with its api module and locale keys, verify with mocks and then a zero-mock load, and re-raise open product decisions at merge. Use when the user pastes an Apipost doc URL, or asks to build a feature or page from an API doc.
---

# Apipost doc to page

The user pastes a `docs.apipost.net` link and asks for a new page. The doc is an SPA and a draft contract, not truth. Follow these steps in order.

## 1. Render the doc

Never `WebFetch` or plain-`fetch` an Apipost doc URL; it returns only the app shell. Open it in ego-browser and read the rendered tree, then walk the endpoint tree in the left nav (each endpoint is a row like `POST 创建应用`).

```js
const task = await taskSpace('weila apipost doc <slug>')
const page = task.page('p1')
await page.goto('<doc url>', { timeout: 30000 })
await page.waitForTimeout(3000)
console.log(await page.evaluate(() => document.body.textContent)) // host, path, query, body, response example
console.log(await page.snapshot()) // nav refs, to click sibling endpoints
```

If a page renders empty, capture the backing docs requests instead. `await page.cdp("Network.enable")` before the reload, then drain `page.events()` through the pump in `.claude/skills/lib/ego-driver.mjs` and read the request URLs and response bodies (`Network.getResponseBody` works while the document that received them is still loaded), or grep the app JS bundle for the docs API host. Do not spend long bundle-hunting; the rendered tree is faster. End the flow with `await task.finish({ keep: [] })`.

Extract, for every endpoint: HTTP method, full relative path, query params, request body, and the response example. Note the host shown in each example; a `localhost` example is the doc author's machine, not a deployment.

## 2. Treat the doc as a draft contract

Write down each fact you will rely on, and mark whether it is doc-derived or wire-observed. Then probe before coding (step 3). A doc path can be wrong. Example seen: a delete endpoint documented at `corp/apps/delete-app` was really served at `corp/api/manage/delete-app`, while the doc path returned 404. If a design note or a comment records a doc anomaly, that anomaly is a probe to run, never a comment to keep.

## 3. Probe every route against a reachable backend

- Pick the target host from `apps/website/vite.config.ts` (read it, do not trust memory). Under `pnpm dev:prod` both `/v1` and `/v2` go to `https://api.voischat.cn`; plain `pnpm dev` sends `/v2` to `http://localhost:8090` (local corp backend, usually not running).
- Get a live auth query. Auth rides in the query string (`appid`, `et`, `sign`, `uuid`, `token`), attached by the network layer, not headers. Harvest one from the logged-in console (enable `Network`, reload, drain the pump) and reuse its query, swapping only the host or path. Do not re-sign by hand.
- Run a liveness control. `corp/user/get-selfinfo` on the same host with the same token: 200 means the host and auth are fine.
- Classify. Bare `404 page not found` = route absent. `HTTP 200` with an `errcode` = route live, errcode is business logic (for example `45112 此功能需要终极版或更高版本`, an edition gate; or `40004`, app not owned).
- If a documented path 404s, probe sibling path variants in the same namespace before concluding the backend is uncompiled; prefer the variant that returns 200 plus errcode.
- If the route is genuinely absent, say so and stop to confirm the target with the user rather than wiring against a guess. Build and verify against mocks meanwhile (step 5).

Never switch the vite proxy target to chase a 404 between existing public hosts; `api.voischat.cn` and `voiswork.cn` are the same backend.

## 4. Build the page (weila-work conventions)

A workbench page is three auto-discovered pieces. No central route or menu registration.

- Page file `apps/website/src/pages/workbench/<name>.vue` becomes route `/workbench/<name>`. Start with `definePage({ meta: { name: 'submenu.<key>', roles: [255] } })`. `meta.name` is the i18n key the sidebar renders, so it must exist in **both** `apps/website/locales/zh-CN.yml` and `apps/website/locales/en.yml` (note: `locales/`, not `src/locales/`). A missing key renders the raw key text.
- Sidebar derives submenus from `router.getRoutes()` and filters on `meta.name`, the first path segment, and `meta.roles` against self info type. `meta.roles` hides the menu entry only; the URL still mounts, so add an in-page guard for anything sensitive.
- Put wire types in `src/api/<name>.ts` and keep them types-only, matching `src/api/contact.ts`. Model the row as a typed interface, not loose records.
- Auto-imported: `definePage`, `useI18n`, `useWeilaFetch`, `useWeilaMutation`, `useClipboard`, plus Vue/VueUse/Pinia/Router. Do not add bare `ref()`; use `shallowRef` and `deepRef` (AGENTS.md).
- `useWeilaFetch<T>(urlGetter, opts, tanstackOpts)` POSTs a relative `/v2` path and refetches on the url getter's deps. `useWeilaMutation<TData, TVar>(url, { onSuccess })` POSTs the body. The network layer unwraps a single-key `data` object and leaves a multi-key one wrapped, so a `{apps, count}` payload arrives as `{apps, count}`; do not pass `pick` for it.
- Errors: `errcode !== 0` throws and `App.vue`'s global hook toasts it. Do not add per-mutation `onError` toasts; that double-toasts.
- Pagination: the wire `page` is 0-based, the Arco pager is 1-based. Cross-ref [verify-weila-work-web](../verify-weila-work-web/SKILL.md) for the full pattern.
- Edition-gated endpoints: if step 3 showed `45112`, the page is edition-gated. `meta.roles` only gates by user role, and substring VIP graying cannot gate a path without the flag name, so the menu will show and toast for editions the backend rejects. Flag this as a product decision (step 6) and cross-ref [verify-vip-edition-flags](../verify-vip-edition-flags/SKILL.md).

## 5. Verify

Use [verify-weila-work-web](../verify-weila-work-web/SKILL.md) for the mechanics (login, drive, evidence, backend probing, mocks, box measurement).

- If the backend is absent, mock each endpoint with a CDP Fetch interception that fulfills `*<path>*` from the fixture, armed before the navigation that fires the request (cross-ref [verify-weila-work-web](../verify-weila-work-web/SKILL.md), Helpers, and the working script at `../verify-vip-edition-flags/verify-edition.mjs`). The body must be the raw envelope `{errcode:0, errmsg, data:...}`. Mock secrets must be plain literal dummies such as `sk-test-0000`, never placeholder-shaped strings.
- Exercise every flow you shipped: list, create, delete, reveal and copy, pagination.
- Then do one zero-mock load of every flow before handover. Mock-verified is a proxy, not proof.
- When a control changes cell content in an Arco auto-fit table (for example a mask/reveal toggle), measure the column box with `page.evaluate` getBoundingClientRect before and after and assert the width is unchanged.
- If a blocker deferred a verification, re-open the deferred list the moment it clears; the list is empty before merge.

## 6. Hand over

In the final report, list every product decision you made unilaterally (role gate, edition gate, omitted actions) as an open question, not a footnote. At the merge or handover gate, re-raise each still-unanswered decision and get an explicit ack before merging, because a review of the working code silently accepts whatever you defaulted.
