# Group list pagination

## Sub-features

- First page loads on route entry with page state 0 (wire `page=0`).
- Arco pager click sends the next index (`page=1` for UI page 2) and renders that slice.
- Total count drives the pager's page count (13 groups, size 10 → 2 pages).

## How to get to it (user POV)

Login, then click 群组管理 in the left menu, or open `#/contact/group` directly. The table lists managed groups with an Arco pager below it.

## Driving it with agent-browser

```bash
agent-browser --session verify find text "群组管理" click   # after login
sleep 3
agent-browser --session verify network requests --filter "get-my-manage-group-list" | tail -1
agent-browser --session verify snapshot -c | grep -E 'cell "' | sed 's/.*cell "//;s/".*//'
agent-browser --session verify click ".arco-pagination-item:nth-of-type(2)"
sleep 2
agent-browser --session verify network requests --filter "get-my-manage-group-list" | tail -1
```

Pass: first request shows `page=0&size=10` with rows (群聊1, 验证群01, …); after the pager click, a new request shows `page=1&size=10` and the rows change.

## Gotchas

- The live backend still clamps `page=0` and `page=1` to the same first slice (1-based today, 0-based switch pending). A pager click to UI page 2 sends `page=1` and returns the same rows as page 1 until the backend flips. Record what you see; do not "fix" the frontend.
- `count` comes from the response envelope and feeds `total` in the `:pagination` prop; if the pager shows fewer pages than expected, check `data?.count` rendering, not the fetch.
