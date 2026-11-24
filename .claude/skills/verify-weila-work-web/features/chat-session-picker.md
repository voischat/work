# Chat session picker pager

## Sub-features

- Workbench chat launcher's picker modal lists managed groups with manual 上一页/下一页 buttons.
- Search switches page size to 100 and client-filters; search reset returns page state to 0.

## How to get to it (user POV)

Login, open the workbench chat page, act on the control that opens the session picker modal (创建会话 / 发起聊天 flow), and switch to the 群组 tab.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.mjs') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify chat-session-picker')
const page = task.page('p1')
console.log(
  await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD),
)
await page.goto(`${BASE}/#/workbench/chat`)

// Enable Network before you open the picker, because the first request fires on tab open.
const { pump, requests } = driver.makePump(page, null)
await page.cdp('Network.enable')
function groupList() {
  return [...requests.values()]
    .filter((r) => r.url.includes('get-my-manage-group-list'))
    .map((r) => `${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`)
    .join('\n')
}

// now open the picker modal (see How to get to it) and select the 群组 tab:
await pump(8, 250)
console.log(groupList()) // initial page=0

await page.click('text=下一页')
await page.waitForTimeout(2000)
await pump(6, 250)
console.log(groupList()) // page=1

await page.click('text=上一页')
await page.waitForTimeout(2000)
await pump(6, 250)
console.log(groupList()) // back to page=0

await task.finish({ keep: [] })
```

Pass: initial `page=0`; 下一页 issues `page=1`; 上一页 returns to `page=0` and disables itself at index 0 (`:disabled` when page <= 0).

## Gotchas

- The modal opens from the chat flow; if the entry control is not on the current page, navigate to `#/workbench/chat` first and find the launcher.
- With search text present the request uses `size=100`; has-more arithmetic is `(page+1)*size < count` under 0-based indexing.
