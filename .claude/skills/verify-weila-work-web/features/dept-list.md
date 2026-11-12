# Dept list page

## Sub-features

- Dept manage page (`#/contact/dept`) lists managed departments.
- Endpoint returns `{ count, depts }` with server-side `page`/`size` (verified against the live API 2026-11-12).
- Pager follows the unified 0-based convention.

## How to get to it (user POV)

Login, click 部门管理 in the left menu.

## Driving it with agent-browser

```bash
agent-browser --session verify find text "部门管理" click
sleep 3
agent-browser --session verify network requests --filter "get-my-manage-dept-list" | tail -1
agent-browser --session verify snapshot -c | grep -E 'cell "' | sed 's/.*cell "//;s/".*//' | head -6
```

Pass: the initial request carries `page=0&size=10` and rows render. With more depts than one page, a pager click sends the next 0-based index.

## Gotchas

- Seed org has 1 dept; any pager added will show a single page. The wire-param check is the reliable assertion at this data volume.
- The endpoint is `get-my-manage-dept-list`, distinct from `get-my-manage-all-dept` (tree fetch, unpaginated by design).
