# Member table filters

## Sub-features

- Member manage page (`#/contact/member`) filters the list by 类型 (single-select, `member_types`) and 部门 (multi-select, `dept_ids`).
- Dept member page (`#/contact/dept-<id>-<name>`) filters by 类型 only.
- Both filters also filter client-side through Arco's `filterable.filter` callback; the same values are sent to the backend, which filters and returns a new `count`.

## How to get to it (user POV)

Login, click 成员管理. The 类型 and 部门 column headers show a filter icon. Pick an option, press 确定. The table reloads with the filtered rows and the pager count drops.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log. Arco mounts filter popups lazily and keeps closed ones in the DOM, so act on the visibly rendered `.arco-table-filters-content`.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.ts') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify member-table-filters')
const page = task.page('p1')
console.log(await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD))
await page.cdp('Network.enable')
await page.goto(`${BASE}/#/contact/member`)
await page.waitForTimeout(4000)
await page.events() // drop the initial-load requests

// open the 类型 filter
await page.evaluate(() => {
  const th = [...document.querySelectorAll('.arco-table-th')].find(t => (t.textContent || '').startsWith('类型'))
  th.querySelector('.arco-table-filters').click()
})
await page.waitForTimeout(700)

// pick 成员 and confirm, in the visible popup
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.arco-table-filters-content')].find(c => c.getClientRects().length)
  ;[...box.querySelectorAll('label')].find(l => l.textContent.trim() === '成员').click()
})
await page.evaluate(() => {
  const foot = [...document.querySelectorAll('.arco-table-filters-bottom')].find(f => f.getClientRects().length)
  ;[...foot.querySelectorAll('button')].find(b => b.textContent.trim() === '确定').click()
})
await page.waitForTimeout(3500)

// read the wire: POST body plus backend envelope
const events = await page.events()
const sent = events.find(e => e.method === 'Network.requestWillBeSent' && e.params.request.url.includes('get-member-list'))
const res = await page.cdp('Network.getRequestPostData', { requestId: sent.params.requestId })
console.log(res.postData) // {"member_types":[0],"key":""}
await task.finish({ keep: [] })
```

## Pass

- The filter request body carries `member_types` / `dept_ids` as **number** arrays: `{"member_types":[0],"key":""}`.
- The response envelope is `{"errcode":0,...}` and `data.count` changes from the unfiltered baseline (13 → 12 for 成员 on the QA org).
- 重置 then 确定 drops the key from the body and restores the baseline count.

## Gotchas

- Arco's change event hands back the filter option `value`s verbatim, and `TableFilterData.value` is typed `string`, so the raw `e.filters` is `{ member_types: ['0'] }`. The corp backend's JSON decoder rejects string arrays (and scalars) with `errcode 20 参数错误`; only number arrays are accepted. Convert at the request body (`toMemberListFilters`), not in the filter options.
- The client-side `filter` callback runs regardless of the backend result, so a broken wire still narrows the current page of rows; assert the request body and `errcode`, not the rendered rows alone.
- The 部门 filter's option labels are department names; pick one that exists in the QA org (cw) and check `dept_ids` is numeric.
