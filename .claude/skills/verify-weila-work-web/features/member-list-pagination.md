# Member list pagination

## Sub-features

- Member manage page (`#/contact/member`) lists org members through `MemberTable`.
- Dept member page (`#/contact/dept-<id>-<name>`) lists one dept's members, same table.
- Pager clicks send 0-based wire indexes; search filter does not reset the page (pre-existing quirk, preserved).

## How to get to it (user POV)

Login, click 成员管理, or open a department from 部门管理. The shared member table renders with its pager.

## Driving it with agent-browser

```bash
agent-browser --session verify open "$BASE/#/contact/member"
sleep 4
agent-browser --session verify network requests --filter "get-member-list" | tail -1
agent-browser --session verify snapshot -c | grep -E 'cell "' | sed 's/.*cell "//;s/".*//' | head -8
agent-browser --session verify click ".arco-pagination-item:nth-of-type(2)"
sleep 2
agent-browser --session verify network requests --filter "get-member-list" | tail -1
```

Pass: initial request `page=0&size=10`; pager click issues `page=1&size=10`.

## Gotchas

- Seed org has only 5 members, so the pager is a single page and the click step cannot fire. The request check (`page=0`) still proves the wire contract. To prove multi-page, filter or add members until count > 10, or record the gap here.
- Typing in the search box debounces 500ms and re-fetches with the `key` body field; the page ref is NOT reset by search (known behavior).
