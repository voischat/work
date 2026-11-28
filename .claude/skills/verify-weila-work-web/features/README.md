# Feature map — weila-work-web

One file per user-facing feature. Each says how a user reaches it, how to drive it with ego-browser, and what end state proves it works. Drive the user path; a proof that stops at an internal state is not a proof.

## Driving convention

`BASE` is the `Local:` URL from the dev-server log. ego-browser runs one Node script per observation, piped to `ego-browser nodejs`. A verification is a sequence of scripts in one TaskSpace. Import the shared helpers by absolute path, because the embedded runtime has no shell cwd.

```js
const driver = await import('<repo>/.claude/skills/lib/ego-driver.ts') // <repo> = absolute path to the weila-work checkout
const task = await taskSpace('weila verify <feature>')
const page = task.page('p1')
// drive with page.goto / page.click / page.fill / page.evaluate, and capture
// requests with page.cdp("Network.enable") plus driver.makePump
await task.finish({ keep: [] })
```

| Feature                          | File                         | Status                            |
| -------------------------------- | ---------------------------- | --------------------------------- |
| Group list pagination            | `group-list-pagination.md`   | mapped, driven 2026-11-12         |
| Member list pagination           | `member-list-pagination.md`  | mapped                            |
| Chat session picker pager        | `chat-session-picker.md`     | mapped                            |
| Dept list page                   | `dept-list.md`               | mapped; pager wired 2026-11-29    |
| Org tree department multi-select | `org-tree-multi-select.md`   | mapped, driven 2026-11-17         |
| Member edit permissions          | `member-edit-permissions.md` | mapped, driven 2026-11-18         |
| Member table filters             | `member-table-filters.md`    | mapped, driven 2026-11-27         |

Add a row here when you map a feature. Keep journeys honest: if seed data lacks a precondition, record the failure in Gotchas instead of weakening the journey.
