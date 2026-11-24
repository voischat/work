# Dept list page

## Sub-features

- Dept manage page (`#/contact/dept`) lists managed departments.
- Endpoint returns `{ count, depts }` with server-side `page`/`size` (verified against the live API 2026-11-12).
- Pager follows the unified 0-based convention.

## How to get to it (user POV)

Login, click 部门管理 in the left menu.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.mjs') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify dept-list')
const page = task.page('p1')
console.log(
  await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD),
)

const { pump, requests } = driver.makePump(page, null)
await page.cdp('Network.enable') // once per script, before the action
await page.click('text=部门管理', { label: 'open dept list' })
await page.waitForTimeout(3000)
await pump(8, 250) // events buffer until read

console.log(
  [...requests.values()]
    .filter((r) => r.url.includes('get-my-manage-dept-list'))
    .map((r) => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`)
    .join('\n'),
)

// rows, deterministically; await page.snapshot() is the semantic alternative
console.log(
  await page.evaluate(() =>
    [...document.querySelectorAll('.arco-table td')].map((td) => td.textContent.trim()).join(' | '),
  ),
)

await task.finish({ keep: [] })
```

Pass: the initial request carries `page=0&size=10` and rows render. With more depts than one page, a pager click sends the next 0-based index.

## Gotchas

- Seed org has 1 dept; any pager added will show a single page. The wire-param check is the reliable assertion at this data volume.
- The endpoint is `get-my-manage-dept-list`, distinct from `get-my-manage-all-dept` (tree fetch, unpaginated by design).
