# Group list pagination

## Sub-features

- First page loads on route entry with page state 0 (wire `page=0`).
- Arco pager click sends the next index (`page=1` for UI page 2) and renders that slice.
- Total count drives the pager's page count (13 groups, size 10 → 2 pages).

## How to get to it (user POV)

Login, then click 群组管理 in the left menu, or open `#/contact/group` directly. The table lists managed groups with an Arco pager below it.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.mjs') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify group-list-pagination')
const page = task.page('p1')
console.log(await driver.ensureLogin(page, BASE, '70009790', '123456'))

const { pump, requests } = driver.makePump(page, null)
await page.cdp('Network.enable') // once per script, before the action
await page.click('text=群组管理', { label: 'open group list' })
await page.waitForTimeout(3000)
await pump(8, 250) // events buffer until read

console.log([...requests.values()].filter(r => r.url.includes('get-my-manage-group-list'))
  .map(r => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`).join('\n'))

// rows, deterministically; await page.snapshot() is the semantic alternative
console.log(await page.evaluate(() => [...document.querySelectorAll('.arco-table td')].map(td => td.textContent.trim()).join(' | ')))

await page.click(`xpath=(//li[normalize-space(.)="2"])[1]`, { label: 'go to page 2' })
await page.waitForTimeout(2000)
await pump(6, 250)
console.log([...requests.values()].filter(r => r.url.includes('get-my-manage-group-list'))
  .map(r => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`).join('\n'))

await task.finish({ keep: [] })
```

Pass: first request shows `page=0&size=10` with rows (群聊1, 验证群01, …); after the pager click, a new request shows `page=1&size=10` and the rows change.

## Gotchas

- Verified 2026-11-20: the old backend clamp is gone. UI page 2 sends `page=1&size=10` and returns a distinct slice (验证群10–12 on this corp). Record what you see; do not "fix" the frontend.
- `count` comes from the response envelope and feeds `total` in the `:pagination` prop; if the pager shows fewer pages than expected, check `data?.count` rendering, not the fetch.
