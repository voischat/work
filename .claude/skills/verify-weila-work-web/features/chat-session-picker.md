# Chat session picker pager

## Sub-features

- Workbench chat launcher's picker modal lists managed groups with manual 上一页/下一页 buttons.
- Search switches page size to 100 and client-filters; search reset returns page state to 0.

## How to get to it (user POV)

Login, open the workbench chat page, act on the control that opens the session picker modal (创建会话 / 发起聊天 flow), and switch to the 群组 tab.

## Driving it with agent-browser

```bash
# after opening the modal and selecting the group tab:
agent-browser --session verify network requests --filter "get-my-manage-group-list" | tail -1
agent-browser --session verify find text "下一页" click
sleep 2
agent-browser --session verify network requests --filter "get-my-manage-group-list" | tail -1
agent-browser --session verify find text "上一页" click
```

Pass: initial `page=0`; 下一页 issues `page=1`; 上一页 returns to `page=0` and disables itself at index 0 (`:disabled` when page <= 0).

## Gotchas

- The modal opens from the chat flow; if the entry control is not on the current page, navigate to `#/workbench/chat` first and find the launcher.
- With search text present the request uses `size=100`; has-more arithmetic is `(page+1)*size < count` under 0-based indexing.
