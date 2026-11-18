# Member edit permissions

## Sub-features

- 部门管理员 toggle in the member edit dialog, owner-only.
- Department selector for owners.

## How to get to it (user POV)

通讯录 → 成员管理 → 编辑 on a member who is not already a 部门管理员 → 部门管理员.

## Driving it with agent-browser

Run `.claude/skills/verify-selfinfo-permission-recovery/scripts/check.sh --base "$BASE"`. It covers the owner state and the failed-refresh re-login regression. To check one dialog by hand, open `#/contact/member`, click a row's 编辑, and read the switch state.

## Gotchas

- The 部门管理员 form item is hidden when the edited member's type is 1, because that member is already a department admin. Pick another row.
- A non-owner session renders the switch disabled by design.
- The regression path needs an SPA re-login after a failed token refresh. A full reload masks the bug because it creates a new query client.
