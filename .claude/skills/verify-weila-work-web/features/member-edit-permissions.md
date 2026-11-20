# Member edit permissions

## Sub-features

- 部门管理员 toggle in the member edit dialog, owner-only.
- Department selector for owners.

## How to get to it (user POV)

通讯录 → 成员管理 → 编辑 on a member who is not already a 部门管理员 → 部门管理员.

## Driving it with ego-browser

`BASE` is the `Local:` URL from the dev-server log. Run `.claude/skills/verify-selfinfo-permission-recovery/scripts/check.sh --base "$BASE"`. It covers the owner state and the failed-refresh re-login regression.

To check one dialog by hand, run one script that opens `#/contact/member`, clicks a row's 编辑, and reads the switch state:

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.mjs') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify member-edit-permissions')
const page = task.page('p1')
console.log(await driver.ensureLogin(page, BASE, '70009790', '123456'))

await page.goto(`${BASE}/#/contact/member`)
// the 编辑 label repeats per row, so index the match
await page.click('xpath=(//*[text()="编辑"])[1]', { label: 'open the first member\'s edit dialog' })

// the 部门管理员 switch line carries its checked and disabled state
const snap = await page.snapshot()
console.log(snap.split('\n').filter(line => line.includes('部门管理员')).join('\n'))

await task.finish({ keep: [] })
```

## Gotchas

- The 部门管理员 form item is hidden when the edited member's type is 1, because that member is already a department admin. Pick another row.
- A non-owner session renders the switch disabled by design.
- The regression path needs an SPA re-login after a failed token refresh. A full reload masks the bug because it creates a new query client.
