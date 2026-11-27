# Org tree department multi-select

## Sub-features

- The add-member pickers on the group detail page (`添加群成员`) and the department detail page (`添加成员`) render `OrgTree` in multi mode.
- Each department row has a tri-state checkbox. Checking an unloaded department loads and expands it, then selects every selectable member.
- Each member row keeps one `<button>` with a visible check indicator and `aria-pressed` in multi mode.
- Solo mode (`user-track`, chat session picker) renders no department checkbox and no `aria-pressed`.
- `GroupSettings` renders `OrgTreeMemberItem` without `showCheckbox`, so its rows stay buttons.

## How to get to it (user POV)

Login, open 群组管理, click the zero-member group 验证群02 (id 80001120), then 添加群成员. For the department modal, open 部门管理, click cw (id 67), then 添加成员.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log. One TaskSpace drives every script below. It starts here and ends at `task.finish`. Each later script resumes the same TaskSpace by the id the first run prints, then re-obtains the page with `task.page("p1")`.

Open the group modal:

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.ts') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify org-tree-multi-select')
const page = task.page('p1')
console.log(
  await driver.ensureLogin(page, BASE, process.env.WEILA_QA_ACCOUNT, process.env.WEILA_QA_PASSWORD),
)

await page.goto(`${BASE}/#/contact/group-80001120-%E9%AA%8C%E8%AF%81%E7%BE%A402`)
await page.waitForTimeout(5000)
await page.click('loc=role:button[name="添加群成员"]', { label: 'open add-group-member modal' })
await page.waitForTimeout(2000)
```

Check the first department. Let `N` be the enabled member row count.

```js
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree__dept:nth-of-type(1) .org-tree-member-item:not(.org-tree-member-item--disabled)',
  ),
)
await page.click('.org-tree__dept:nth-of-type(1) .arco-checkbox')
await page.waitForTimeout(1000)
console.log(
  await page.evaluate(
    (sel) => document.querySelector(sel)?.className,
    '.org-tree__dept:nth-of-type(1) .arco-checkbox',
  ),
)
// arco-checkbox-checked
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree-member-item[aria-pressed="true"]',
  ),
)
// N
```

Partial, partial to all, all to none:

```js
await page.click('.org-tree__dept:nth-of-type(1) .org-tree-member-item:nth-of-type(1)')
console.log(
  await page.evaluate(
    (sel) => document.querySelector(sel)?.className,
    '.org-tree__dept:nth-of-type(1) .arco-checkbox',
  ),
)
// arco-checkbox-indeterminate
await page.click('.org-tree__dept:nth-of-type(1) .arco-checkbox')
await page.click('.org-tree__dept:nth-of-type(1) .arco-checkbox')
```

Load a collapsed department on check. Read the current department shape first.

```js
await page.evaluate(
  (sel) => document.querySelector(sel).scrollIntoView(),
  '.org-tree__dept:nth-of-type(2) .arco-checkbox',
)
await page.click('.org-tree__dept:nth-of-type(2) .arco-checkbox')
await page.waitForTimeout(2000)
console.log(
  await page.evaluate(
    (sel) => document.querySelector(sel)?.getAttribute('aria-expanded'),
    '.org-tree__dept:nth-of-type(2) .org-tree__dept-button',
  ),
)
// true
console.log(
  await page.evaluate(
    (sel) => document.querySelector(sel)?.className,
    '.org-tree__dept:nth-of-type(2) .arco-checkbox',
  ),
)
// arco-checkbox-checked when the department has selectable members
// arco-checkbox-disabled when the department is empty
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree__dept:nth-of-type(2) .org-tree-member-item:not(.org-tree-member-item--disabled)',
  ),
)
// M, the number of selectable members the department actually returned
```

The current seed data has cw empty, so the expected branch is `arco-checkbox-disabled` with 0 rows. To run the non-empty branch, use a department that still has selectable members and check it while collapsed.

Submit and capture the payload. Check the first department, then uncheck members until 2 remain, so the payload is small and still proves the department materialization.

```js
const fs = await import('node:fs')

// raw CDP events carry the POST body; makePump keeps only method, url, and status
const seen = new Map()
async function drain(rounds = 8, gapMs = 250) {
  for (let i = 0; i < rounds; i++) {
    if (i) await page.waitForTimeout(gapMs)
    for (const ev of await page.events()) {
      const p = ev.params || {}
      if (ev.method === 'Network.requestWillBeSent' && p.request) seen.set(p.requestId, p.request)
    }
  }
}

await page.cdp('Network.enable') // once per script, before the action
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree-member-item[aria-pressed="true"]',
  ),
)
await page.click('.arco-modal-footer .arco-btn-primary')
await page.waitForTimeout(3000)
await drain(8, 250) // events buffer until read

const add = [...seen.values()].find((r) => r.url.includes('add-group-members'))
fs.writeFileSync(
  '/tmp/add-members.json',
  JSON.stringify(
    {
      method: add?.method,
      url: add ? driver.scrubUrl(add.url) : null, // scrub auth before sharing
      postData: add?.postData,
    },
    null,
    2,
  ),
)
console.log(add?.postData)
```

Pass: the body is `{ group_id, user_ids }` with exactly the 2 user ids still selected.

Reopen and assert the added members are disabled. The first department is already expanded, so do not click its header; that would collapse it.

```js
await page.click('loc=role:button[name="添加群成员"]', { label: 'reopen add-group-member modal' })
await page.waitForTimeout(2000)
await page.evaluate(
  (sel) => document.querySelector(sel).scrollIntoView(),
  '.org-tree__dept:nth-of-type(1) .org-tree-member-item--disabled',
)
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree__dept:nth-of-type(1) .org-tree-member-item--disabled',
  ),
)
// at least 2, including the submitted ids
```

If every member of that department is now in the group, its checkbox must be `arco-checkbox-disabled`. Otherwise it stays enabled and unchecked.

Cleanup: close the modal, select each added row, close the edit modal, click 删除, then 提交. Confirm the group shows 暂无数据.

Solo and shared-row regressions:

```js
await page.goto(`${BASE}/#/workbench/user-track`)
await page.waitForTimeout(10000)
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree__dept-row .arco-checkbox',
  ),
)
// 0
console.log(
  await page.evaluate(
    (sel) => document.querySelectorAll(sel).length,
    '.org-tree-member-item__check',
  ),
)
// 0
console.log(
  await page.evaluate(
    (sel) => document.querySelector(sel)?.getAttribute('aria-pressed'),
    '.org-tree-member-item',
  ),
)
// no value
```

For `GroupSettings`, open a group chat, click 群组设置, then `await page.evaluate(sel => document.querySelectorAll(sel).length, 'button.org-tree-member-item')` equals the member rows and `await page.evaluate(sel => document.querySelectorAll(sel).length, '.org-tree-member-item__check')` is 0.

Keyboard: focus `.org-tree__dept:nth-of-type(1) .arco-checkbox input` and press Space, and expect the department to become checked. Focus a member row button and press Space to toggle that row.

```js
await page.evaluate(
  (sel) => document.querySelector(sel).focus(),
  '.org-tree__dept:nth-of-type(1) .arco-checkbox input',
)
await page.keyboard.press('Space')
await page.evaluate(
  (sel) => document.querySelector(sel).focus(),
  '.org-tree__dept:nth-of-type(1) .org-tree-member-item:nth-of-type(1)',
)
await page.keyboard.press('Space')

await task.finish({ keep: [] })
```

## Gotchas

- The corp has two departments, 测试企业 and cw. The group detail test group 验证群02 must start with 0 members and be left at 0.
- Member and department counts drift as people move between departments. Derive every expected count from the DOM or the network response instead of hard-coding it.
- The department modal's target department has its own members disabled. Use it for the disabled and empty states, not for a submit unless membership can be restored.
- The member row is a button with `aria-pressed`, not a native checkbox. Query `aria-pressed`, not `:checked`.
- An unexpanded department is `unloaded`: its checkbox is enabled and a click loads it. A department whose members are all disabled becomes `empty` and its checkbox is disabled.
- The first transform of a heavy workbench page can leave it blank. Reload once and wait 10 seconds before calling it a break.
- The modal body is a scroll container. Call `await page.evaluate(sel => document.querySelector(sel).scrollIntoView(), sel)` before clicking a control near the bottom; otherwise the fixed footer intercepts the click.
- The first department is auto-expanded on open. Do not click its header before counting its rows; that collapses it.
