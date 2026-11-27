# Member list pagination

## Sub-features

- Member manage page (`#/contact/member`) lists org members through `MemberTable`.
- Dept member page (`#/contact/dept-<id>-<name>`) lists one dept's members, same table.
- Pager clicks send 0-based wire indexes; a new search key resets the page to 0.

## How to get to it (user POV)

Login, click 成员管理, or open a department from 部门管理. The shared member table renders with its pager.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.ts') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify member-list-pagination')
const page = task.page('p1')
console.log(
  await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD),
)

const { pump, requests } = driver.makePump(page, null)
await page.cdp('Network.enable') // once per script, before the action
await page.goto(`${BASE}/#/contact/member`)
await page.waitForTimeout(4000)
await pump(8, 250) // events buffer until read

console.log(
  [...requests.values()]
    .filter((r) => r.url.includes('get-member-list'))
    .map((r) => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`)
    .join('\n'),
)

// rows, deterministically; await page.snapshot() is the semantic alternative
console.log(
  await page.evaluate(() =>
    [...document.querySelectorAll('.arco-table td')].map((td) => td.textContent.trim()).join(' | '),
  ),
)

// the click cannot fire while seed data fits one page (see Gotchas)
await page.click(`xpath=(//li[normalize-space(.)="2"])[1]`, { label: 'go to page 2' })
await page.waitForTimeout(2000)
await pump(6, 250)
console.log(
  [...requests.values()]
    .filter((r) => r.url.includes('get-member-list'))
    .map((r) => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`)
    .join('\n'),
)

await task.finish({ keep: [] })
```

Pass: initial request `page=0&size=10`; pager click issues `page=1&size=10`.

## Gotchas

- Seed org has only 5 members, so the pager is a single page and the click step cannot fire. The request check (`page=0`) still proves the wire contract. To prove multi-page, filter or add members until count > 10, or record the gap here.
- Typing in the search box debounces 500ms and re-fetches with the `key` body field; the page resets to 0 with the new key (fixed 2026-11-17, see the search-on-page-2 repro).
